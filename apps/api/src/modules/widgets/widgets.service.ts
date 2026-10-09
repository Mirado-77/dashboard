import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, asc, eq, gt, max, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { DATABASE, type Database } from '../../database/database.module.js';
import {
  serviceSubscriptions,
  widgetInstances,
} from '../../database/schema/index.js';
import { ProviderTokens } from '../services/provider-tokens.service.js';
import { WidgetDataError } from '../services/registry/errors.js';
import { ServiceRegistry } from '../services/registry/registry.js';
import type {
  Service,
  Widget,
  WidgetContext,
} from '../services/registry/types.js';
import { configFor, moveTo, refreshRateFor } from './widgets.rules.js';
import { TtlCache } from '../../common/ttl-cache.js';
import { AuthError } from '../auth/custom/errors.js';
import { memoryRateLimiter } from '../auth/custom/rate-limit.js';
import { HttpException, HttpStatus } from '@nestjs/common';

function cacheKey(
  scope: string,
  row: { serviceId: string; widgetId: string },
  config: Record<string, string | number>,
): string {
  return `${scope}:${row.serviceId}/${row.widgetId}:${JSON.stringify(
    Object.entries(config).sort(),
  )}`;
}

const widgetBodySchema = z.object({
  serviceId: z.string().trim(),
  widgetId: z.string().trim(),
  config: z.record(z.string(), z.unknown()),
  refreshRate: z.int().optional(),
});

const widgetUpdateSchema = z.object({
  config: z.record(z.string(), z.unknown()).optional(),
  refreshRate: z.int().optional(),
  position: z.int().min(0).optional(),
});

/** A full dashboard reloads in one burst, so this is per minute, not per second. */
export const DATA_LIMIT = { window: 60, max: 300 };

@Injectable()
export class WidgetsService {
  private readonly logger = new Logger(WidgetsService.name);
  private readonly cache = new TtlCache<unknown>();
  private readonly limiter = memoryRateLimiter();

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly registry: ServiceRegistry,
    private readonly tokens: ProviderTokens,
  ) {}

  private widget(serviceId: string, widgetId: string): Widget {
    const widget = this.registry.getWidget(serviceId, widgetId);
    if (!widget) {
      throw new NotFoundException({
        code: 'WIDGET_NOT_FOUND',
        message: `Unknown widget: ${serviceId}/${widgetId}`,
      });
    }
    return widget;
  }

  /** Null for a service available by default, which has no subscription. */
  private async subscriptionFor(
    userId: string,
    serviceId: string,
  ): Promise<string | null> {
    if (this.registry.getOne(serviceId)?.providerType === 'none') return null;

    const [subscription] = await this.db
      .select({ id: serviceSubscriptions.id })
      .from(serviceSubscriptions)
      .where(
        and(
          eq(serviceSubscriptions.userId, userId),
          eq(serviceSubscriptions.serviceId, serviceId),
        ),
      );
    if (!subscription) {
      throw new BadRequestException({
        code: 'NOT_SUBSCRIBED',
        message: 'Subscribe to this service first',
      });
    }
    return subscription.id;
  }

  /** A refresh token Google or GitHub no longer accepts is a 401, not a 500. */
  private async tokenFor(userId: string, service: Service) {
    try {
      return await this.tokens.forService(userId, service);
    } catch (error) {
      if (
        error instanceof AuthError &&
        error.code === 'PROVIDER_REAUTH_REQUIRED'
      ) {
        throw new UnauthorizedException({
          code: error.code,
          message: error.message,
        });
      }
      throw error;
    }
  }

  /** Someone else's widget gets the same 404 as a missing one. */
  private async instance(userId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(widgetInstances)
      .where(
        and(eq(widgetInstances.id, id), eq(widgetInstances.userId, userId)),
      );
    if (!row) {
      throw new NotFoundException({
        code: 'WIDGET_INSTANCE_NOT_FOUND',
        message: 'This widget does not exist',
      });
    }
    return row;
  }

  async list(userId: string, db: Pick<Database, 'select'> = this.db) {
    const rows = await db
      .select()
      .from(widgetInstances)
      .where(eq(widgetInstances.userId, userId))
      .orderBy(asc(widgetInstances.position));

    return rows;
  }

  async create(userId: string, body: unknown) {
    const result = widgetBodySchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException({
        code: 'INVALID_WIDGET',
        message:
          'Expected serviceId, widgetId, config and an optional integer refreshRate',
      });
    }
    const input = result.data;
    const widget = this.widget(input.serviceId, input.widgetId);
    const subscriptionId = await this.subscriptionFor(userId, input.serviceId);

    const config = configFor(widget, input.config);
    const refreshRate = refreshRateFor(widget, input.refreshRate);

    const [last] = await this.db
      .select({ position: max(widgetInstances.position) })
      .from(widgetInstances)
      .where(eq(widgetInstances.userId, userId));

    const [created] = await this.db
      .insert(widgetInstances)
      .values({
        id: randomUUID(),
        userId,
        subscriptionId,
        serviceId: input.serviceId,
        widgetId: input.widgetId,
        config,
        refreshRate,
        position: (last?.position ?? -1) + 1,
      })
      .returning();
    return created;
  }

  async update(userId: string, id: string, body: unknown) {
    const result = widgetUpdateSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException({
        code: 'INVALID_WIDGET',
        message:
          'Expected a config, an integer refreshRate and/or a position from 0',
      });
    }
    const input = result.data;
    const row = await this.instance(userId, id);
    const widget = this.widget(row.serviceId, row.widgetId);

    const values = {
      config:
        input.config === undefined
          ? row.config
          : configFor(widget, input.config),
      refreshRate:
        input.refreshRate === undefined
          ? row.refreshRate
          : refreshRateFor(widget, input.refreshRate),
      updatedAt: new Date(),
    };

    return this.db.transaction(async (tx) => {
      if (input.position !== undefined) {
        const order = (await this.list(userId, tx)).map((other) => other.id);
        const next = moveTo(order, id, input.position);
        // Only the widgets between the old and the new place change.
        for (const [position, otherId] of next.entries()) {
          if (otherId !== id && order[position] !== otherId) {
            await tx
              .update(widgetInstances)
              .set({ position })
              .where(eq(widgetInstances.id, otherId));
          }
        }
        Object.assign(values, { position: next.indexOf(id) });
      }

      const [updated] = await tx
        .update(widgetInstances)
        .set(values)
        .where(
          and(eq(widgetInstances.id, id), eq(widgetInstances.userId, userId)),
        )
        .returning();
      return updated;
    });
  }

  /** Shifts the widgets after it so positions stay 0..n-1, as dnd-kit expects. */
  async remove(userId: string, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [deleted] = await tx
        .delete(widgetInstances)
        .where(
          and(eq(widgetInstances.id, id), eq(widgetInstances.userId, userId)),
        )
        .returning({ position: widgetInstances.position });
      if (!deleted) {
        throw new NotFoundException({
          code: 'WIDGET_INSTANCE_NOT_FOUND',
          message: 'This widget does not exist',
        });
      }

      await tx
        .update(widgetInstances)
        .set({ position: sql`${widgetInstances.position} - 1` })
        .where(
          and(
            eq(widgetInstances.userId, userId),
            gt(widgetInstances.position, deleted.position),
          ),
        );
    });
  }

  async data(userId: string, id: string): Promise<{ data: unknown }> {
     const wait = this.limiter.consume(`data:${userId}`, DATA_LIMIT);
    if (wait !== null) {
      throw new HttpException(
        {
          code: 'TOO_MANY_REQUESTS',
          message: `Too many refreshes, retry in ${wait} seconds`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }
    const row = await this.instance(userId, id);
    const widget = this.widget(row.serviceId, row.widgetId);
    const config = configFor(widget, row.config);
    const service = this.registry.getOne(row.serviceId);
    // Data of a service tied to an account must never be shared between users.
    const scope = service?.providerType === 'none' ? 'shared' : userId;

    // Outside the try: a missing link is the user's to fix, not a 502.
    const ctx: WidgetContext = { config };
    if (service?.providerType === 'oauth') {
      const token = await this.tokenFor(userId, service);
      if (!token) {
        throw new BadRequestException({
          code: 'PROVIDER_NOT_LINKED',
          message: `Link your ${service.name} account again`,
        });
      }
      ctx.accessToken = token.accessToken;
    }

    try {
      return {
        data: await this.cache.get(
          cacheKey(scope, row, config),
          widget.minRefreshRate,
          () => widget.getWidgetData(ctx),
        ),
      };
    } catch (error) {
      const known = error instanceof WidgetDataError;
      if (!known) {
        this.logger.error(
          `${row.serviceId}/${row.widgetId} failed`,
          error instanceof Error ? error.stack : String(error),
        );
      }
      throw new BadGatewayException({
        code: 'WIDGET_DATA_UNAVAILABLE',
        message: known ? error.message : 'The service could not be reached',
      });
    }
  }
}
