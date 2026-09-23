import { z } from 'zod';
import type { WidgetParam } from './types.js';

function paramSchema(param: WidgetParam): z.ZodType {
  if (param.type === 'integer') {
    const base = z.coerce.number().int();
    if (typeof param.defaultValue === 'number') {
      return base.default(param.defaultValue);
    }
    return param.required ? base : base.optional();
  }

  const base = z.string();
  if (typeof param.defaultValue === 'string') {
    return base.default(param.defaultValue);
  }
  return param.required ? base : base.optional();
}

/**
 * Schema of the configuration a widget instance must provide.
 *
 * Strict: an unknown key is rejected rather than stored, so a typo in a
 * parameter name surfaces instead of silently disabling it.
 */
export function buildConfigSchema(params: WidgetParam[]) {
  const shape: Record<string, z.ZodType> = {};
  for (const param of params) {
    shape[param.name] = paramSchema(param);
  }
  return z.strictObject(shape);
}
