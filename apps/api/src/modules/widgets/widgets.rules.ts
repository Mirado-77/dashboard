import { BadRequestException } from '@nestjs/common';
import { buildConfigSchema } from '../services/registry/params.js';
import type { Widget } from '../services/registry/types.js';

export const MAX_REFRESH_RATE = 24 * 60 * 60;

/** The configuration to store, with the defaults filled in. */
export function configFor(
  widget: Widget,
  config: unknown,
): Record<string, string | number> {
  const result = buildConfigSchema(widget.params).safeParse(config);
  if (!result.success) {
    throw new BadRequestException({
      code: 'INVALID_WIDGET_CONFIG',
      message: `This widget expects: ${widget.params
        .map((param) => `${param.name} (${param.type})`)
        .join(', ')}`,
    });
  }
  return result.data as Record<string, string | number>;
}

export function refreshRateFor(widget: Widget, refreshRate?: number): number {
  if (refreshRate === undefined) return widget.defaultRefreshRate;
  if (refreshRate < widget.minRefreshRate || refreshRate > MAX_REFRESH_RATE) {
    throw new BadRequestException({
      code: 'INVALID_REFRESH_RATE',
      message: `The refresh rate must be between ${widget.minRefreshRate} and ${MAX_REFRESH_RATE} seconds`,
    });
  }
  return refreshRate;
}

export function moveTo(ids: string[], id: string, position: number): string[] {
  const others = ids.filter((other) => other !== id);
  const index = Math.min(Math.max(position, 0), others.length);
  return [...others.slice(0, index), id, ...others.slice(index)];
}
