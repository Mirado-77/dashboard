import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { buildConfigSchema } from './registry/params.js';
import type { Widget } from './registry/types.js';

export type WidgetConfig = Record<string, string | number>;

const MAX_REFRESH_RATE = 86_400;

const rawConfig = z.record(z.string(), z.unknown());
const refreshRate = z.number().int().positive().max(MAX_REFRESH_RATE);

const createWidgetSchema = z.strictObject({
  serviceId: z.string().min(1),
  widgetId: z.string().min(1),
  config: rawConfig.default({}),
  refreshRate: refreshRate.optional(),
});

const updateWidgetSchema = z.strictObject({
  config: rawConfig.optional(),
  refreshRate: refreshRate.optional(),
  position: z.number().int().min(0).optional(),
});

export type CreateWidgetBody = z.infer<typeof createWidgetSchema>;
export type UpdateWidgetBody = z.infer<typeof updateWidgetSchema>;

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    throw new BadRequestException({
      code: 'INVALID_WIDGET',
      message: result.error.issues
        .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
        .join(', '),
    });
  }
  return result.data;
}

export function parseCreateWidget(body: unknown): CreateWidgetBody {
  return parseBody(createWidgetSchema, body);
}

export function parseUpdateWidget(body: unknown): UpdateWidgetBody {
  return parseBody(updateWidgetSchema, body);
}

export function configToStore(widget: Widget, config: unknown): WidgetConfig {
  const result = buildConfigSchema(widget.params).safeParse(config ?? {});
  const blank =
    result.success &&
    widget.params.some(
      (param) =>
        param.required &&
        param.type === 'string' &&
        String(result.data[param.name]).trim() === '',
    );

  if (!result.success || blank) {
    throw new BadRequestException({
      code: 'INVALID_WIDGET_CONFIG',
      message: `This widget expects: ${widget.params
        .map((param) => `${param.name} (${param.type})`)
        .join(', ')}`,
    });
  }
  return result.data as WidgetConfig;
}

export function refreshRateToStore(widget: Widget, asked?: number): number {
  if (asked === undefined) return widget.defaultRefreshRate;
  if (asked < widget.minRefreshRate) {
    throw new BadRequestException({
      code: 'REFRESH_RATE_TOO_LOW',
      message: `This widget refreshes every ${widget.minRefreshRate} seconds at most`,
    });
  }
  return asked;
}

export function moveTo(ids: string[], id: string, position: number): string[] {
  const others = ids.filter((other) => other !== id);
  const index = Math.min(Math.max(position, 0), others.length);
  return [...others.slice(0, index), id, ...others.slice(index)];
}
