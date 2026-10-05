import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DATABASE, type Database } from '../../database/database.module.js';
import { widgetInstances } from '../../database/schema/index.js';
import { WidgetDataError } from './registry/errors.js';
import { ServiceRegistry } from './registry/registry.js';
import type { Widget } from './registry/types.js';
import { SubscriptionsService } from './subscriptions.service.js';
import {
  configToStore,
  moveTo,
  parseCreateWidget,
  parseUpdateWidget,
  refreshRateToStore,
  type WidgetConfig,
} from './widgets.rules.js';

export interface WidgetInstance {
  id: string;
  serviceId: string;
  widgetId: string;
  config: WidgetConfig;
  refreshRate: number;
  position: number;
}

function toInstance(row: typeof widgetInstances.$inferSelect): WidgetInstance {
  return {
    id: row.id,
    serviceId: row.serviceId,
    widgetId: row.widgetId,
    config: row.config,
    refreshRate: row.refreshRate,
    position: row.position,
  };
}

@Injectable()
export class WidgetsService {
  private readonly logger = new Logger(WidgetsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly registry: ServiceRegistry,
    private readonly subscriptions: SubscriptionsService,
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

  private async instance(userId: string, id: string): Promise<WidgetInstance> {
    const [row] = await this.db
      .select()
      .from(widgetInstances)
      .where(
        and(eq(widgetInstances.id, id), eq(widgetInstances.userId, userId)),
      );
    if (!row) {
      throw new NotFoundException({
        code: 'WIDGET_INSTANCE_NOT_FOUND',
        message: `Unknown widget instance: ${id}`,
      });
    }
    return toInstance(row);
  }

  async list(userId: string): Promise<WidgetInstance[]> {
    const rows = await this.db
      .select()
      .from(widgetInstances)
      .where(eq(widgetInstances.userId, userId))
      .orderBy(asc(widgetInstances.position), asc(widgetInstances.createdAt));
    return rows.map(toInstance);
  }

  async create(userId: string, body: unknown): Promise<WidgetInstance> {
    const asked = parseCreateWidget(body);
    const widget = this.widget(asked.serviceId, asked.widgetId);
    if (!(await this.subscriptions.isSubscribed(userId, asked.serviceId))) {
      throw new BadRequestException({
        code: 'SERVICE_NOT_SUBSCRIBED',
        message: `Subscribe to ${asked.serviceId} first`,
      });
    }

    const instance: WidgetInstance = {
      id: randomUUID(),
      serviceId: asked.serviceId,
      widgetId: asked.widgetId,
      config: configToStore(widget, asked.config),
      refreshRate: refreshRateToStore(widget, asked.refreshRate),
      position: (await this.list(userId)).length,
    };
    await this.db.insert(widgetInstances).values({ ...instance, userId });
    return instance;
  }

  async update(
    userId: string,
    id: string,
    body: unknown,
  ): Promise<WidgetInstance> {
    const asked = parseUpdateWidget(body);
    const current = await this.instance(userId, id);
    const widget = this.widget(current.serviceId, current.widgetId);

    const order = (await this.list(userId)).map((instance) => instance.id);
    const next: WidgetInstance = {
      ...current,
      config:
        asked.config === undefined
          ? current.config
          : configToStore(widget, asked.config),
      refreshRate:
        asked.refreshRate === undefined
          ? current.refreshRate
          : refreshRateToStore(widget, asked.refreshRate),
    };
    const nextOrder =
      asked.position === undefined ? order : moveTo(order, id, asked.position);
    next.position = nextOrder.indexOf(id);

    await this.db.transaction(async (tx) => {
      for (const [position, instanceId] of nextOrder.entries()) {
        if (instanceId === id || order[position] === instanceId) continue;
        await tx
          .update(widgetInstances)
          .set({ position })
          .where(eq(widgetInstances.id, instanceId));
      }
      await tx
        .update(widgetInstances)
        .set({
          config: next.config,
          refreshRate: next.refreshRate,
          position: next.position,
          updatedAt: new Date(),
        })
        .where(eq(widgetInstances.id, id));
    });
    return next;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.instance(userId, id);
    await this.db.delete(widgetInstances).where(eq(widgetInstances.id, id));
  }

  async data(userId: string, id: string): Promise<{ data: unknown }> {
    const instance = await this.instance(userId, id);
    const widget = this.widget(instance.serviceId, instance.widgetId);
    const config = configToStore(widget, instance.config);

    try {
      return { data: await widget.getWidgetData({ config }) };
    } catch (error) {
      const known = error instanceof WidgetDataError;
      if (!known) {
        this.logger.error(
          `${instance.serviceId}/${instance.widgetId} failed`,
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
