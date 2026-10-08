import { index, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { timestamps } from './columns.js';
import { users } from './auth.js';
import { serviceSubscriptions } from './services.js';

/**
 * A widget the user placed on their dashboard.
 *
 * Tied to the subscription so that unsubscribing from a service removes its
 * widgets. Null for a service that needs no account: it has no subscription.
 * `serviceId` and `widgetId` are checked against the registry, like
 * subscriptions.
 *
 * `position` is the index in the dashboard order, as `@dnd-kit/sortable`
 * handles it. Not unique: a reorder rewrites several rows at once.
 */
export const widgetInstances = pgTable(
  'widget_instance',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subscriptionId: text('subscription_id').references(
      () => serviceSubscriptions.id,
      { onDelete: 'cascade' },
    ),
    serviceId: text('service_id').notNull(),
    widgetId: text('widget_id').notNull(),
    config: jsonb('config').$type<Record<string, string | number>>().notNull(),
    /** In seconds. */
    refreshRate: integer('refresh_rate').notNull(),
    position: integer('position').notNull(),
    ...timestamps,
  },
  (table) => [index('widget_instance_user_id_idx').on(table.userId)],
);
