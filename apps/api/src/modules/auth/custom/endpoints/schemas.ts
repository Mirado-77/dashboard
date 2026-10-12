import { z } from 'zod';

// RFC 5321 caps an address at 254 characters. Trimmed before the format check
// so a pasted address with spaces is accepted.
export const email = z.string().trim().toLowerCase().max(254).pipe(z.email());

/** Upper bound before hashing; the configured policy is checked separately. */
export const password = z.string().max(1024);

export const callbackURL = z.string().max(2048).optional();

export const token = z.string().max(256);

export const providerId = z.string().min(1).max(50);
