/**
 * Development seed: creates verified test accounts. Safe to run several times,
 * existing emails are left untouched.
 *
 *   bun run dev:seed        (from the repository root)
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { CREDENTIAL_PROVIDER } from '../modules/auth/custom/context.js';
import { generateId, scryptHasher } from '../modules/auth/custom/crypto.js';
import { drizzleStore } from '../modules/auth/custom/store/drizzle.js';
import type { UserRole } from '../modules/auth/auth.contract.js';
import * as schema from './schema/index.js';

interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

const users: SeedUser[] = [
  { name: 'Rick', email: 'rick@citadel.io', password: 'wubbalubba', role: 'admin' },
  { name: 'Morty', email: 'morty@citadel.io', password: 'aw-geez-rick', role: 'user' },
  { name: 'Summer', email: 'summer@citadel.io', password: 'whatever-grandpa', role: 'user' },
];

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database');
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: 'drizzle' });
    const store = drizzleStore(db);

    for (const seed of users) {
      if (await store.users.findByEmail(seed.email)) {
        console.log(`skip    ${seed.email} (already exists)`);
        continue;
      }
      const password = await scryptHasher.hash(seed.password);
      await store.transaction(async (tx) => {
        const user = await tx.users.create({
          id: generateId(),
          name: seed.name,
          email: seed.email,
          emailVerified: true,
          image: null,
          role: seed.role,
          banned: false,
          banReason: null,
        });
        await tx.accounts.create({
          id: generateId(),
          userId: user.id,
          providerId: CREDENTIAL_PROVIDER,
          accountId: user.id,
          password,
          accessToken: null,
          refreshToken: null,
          idToken: null,
          accessTokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          scope: null,
        });
      });
      console.log(`created ${seed.email} / ${seed.password} (${seed.role})`);
    }
  } finally {
    await pool.end();
  }
}

function isConnectionRefused(error: unknown): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if ((current as NodeJS.ErrnoException).code === 'ECONNREFUSED') return true;
    current = current.cause;
  }
  return false;
}

try {
  await main();
} catch (error) {
  if (isConnectionRefused(error)) {
    console.error('Database unreachable. Start it with: docker compose up -d db');
  } else {
    console.error(error);
  }
  process.exit(1);
}
