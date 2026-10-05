import { z } from 'zod';
import type { WidgetParam } from './types.js';

const MAX_STRING_LENGTH = 500;

// Not z.coerce: it turns "", "  " and null into 0.
const integer = z
  .union([
    z.number(),
    z
      .string()
      .regex(/^-?\d+$/)
      .transform(Number),
  ])
  .pipe(z.number().int());

function paramSchema(param: WidgetParam): z.ZodType {
  if (param.type === 'integer') {
    if (typeof param.defaultValue === 'number') {
      return integer.default(param.defaultValue);
    }
    return param.required ? integer : integer.optional();
  }

  const text = z.string().trim().max(MAX_STRING_LENGTH);
  const base = param.required ? text.min(1) : text;
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
