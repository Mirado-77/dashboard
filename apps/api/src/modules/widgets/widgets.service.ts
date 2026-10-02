import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, gt, max, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { DATABASE, type Database } from '../../database/database.module.js';
import {
  serviceSubscriptions,
  widgetInstances,
} from '../../database/schema/index.js';
import { ServiceRegistry } from '../services/registry/registry.js';
import type { Widget } from '../services/registry/types.js';
import { configFor, refreshRateFor } from './widgets.rules.js';

const widgetBodySchema = z.object({
  serviceId: z.string().trim(),
  widgetId: z.string().trim(),
  config: z.record(z.string(), z.unknown()),
  refreshRate: z.int().optional(),
});

const widgetUpdateSchema = z.object({
  config: z.record(z.string(), z.unknown()).optional(),
  refreshRate: z.int().optional(),
});

@Injectable()
export class WidgetsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly registry: ServiceRegistry,
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

  async list(userId: string) {
    const rows = await this.db
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

    const [subscription] = await this.db
      .select({ id: serviceSubscriptions.id })
      .from(serviceSubscriptions)
      .where(
        and(
          eq(serviceSubscriptions.userId, userId),
          eq(serviceSubscriptions.serviceId, input.serviceId),
        ),
      );
    if (!subscription) {
      throw new BadRequestException({
        code: 'NOT_SUBSCRIBED',
        message: 'Subscribe to this service first',
      });
    }

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
        subscriptionId: subscription.id,
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
        message: 'Expected a config and/or an integer refreshRate',
      });
    }
    const input = result.data;
    const row = await this.instance(userId, id);
    const widget = this.widget(row.serviceId, row.widgetId);

    const [updated] = await this.db
      .update(widgetInstances)
      .set({
        config:
          input.config === undefined
            ? row.config
            : configFor(widget, input.config),
        refreshRate:
          input.refreshRate === undefined
            ? row.refreshRate
            : refreshRateFor(widget, input.refreshRate),
        updatedAt: new Date(),
      })
      .where(
        and(eq(widgetInstances.id, id), eq(widgetInstances.userId, userId)),
      )
      .returning();
    return updated;
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
}
