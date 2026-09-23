import { Injectable } from '@nestjs/common';
import type { Service, Widget } from './types.js';

@Injectable()
export class ServiceRegistry {
  private readonly servicesList: Map<string, Service>;
  constructor(services: Service[]) {
    this.servicesList = new Map<string, Service>();

    for (const service of services) {
      const seenWidgetIds = new Set<string>();

      if (this.servicesList.has(service.id))
        throw new Error(`Duplicate service id: ${service.id}`);
      this.servicesList.set(service.id, service);
      for (const widget of service.widgets) {
        if (seenWidgetIds.has(widget.id)) {
          throw new Error(`Duplicate widget in the same service: ${widget.id}`);
        } else {
          seenWidgetIds.add(widget.id);
        }
      }
    }
  }

  getAll(): Service[] {
    return Array.from(this.servicesList.values());
  }

  getOne(id: string): Service | undefined {
    const result = this.servicesList.get(id);
    return result;
  }

  getWidget(serviceId: string, widgetId: string): Widget | undefined {
    const service = this.getOne(serviceId);
    const result = service?.widgets.find((w) => w.id === widgetId);
    return result;
  }
}
