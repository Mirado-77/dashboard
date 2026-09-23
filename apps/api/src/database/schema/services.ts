import { index, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { timestamps } from './columns.js';
import { users } from './auth.js';

/**
 * A user subscribed to a service of the registry.
 *
 * `serviceId` has no foreign key: services live in the code, not in the
 * database. The API checks it against the registry before inserting.
 *
 * OAuth services keep their tokens in `account`, so `credentials` only holds
 * the secrets of services asking for a username and a password. It is
 * encrypted before it gets here.
 */
export const serviceSubscriptions = pgTable(
  'service_subscription',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    serviceId: text('service_id').notNull(),
    credentials: text('credentials'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('service_subscription_user_service_idx').on(
      table.userId,
      table.serviceId,
    ),
    index('service_subscription_user_id_idx').on(table.userId),
  ],
);
