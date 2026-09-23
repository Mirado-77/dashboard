import {
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

export { createSecretBox, type SecretBox } from '../../../common/secret-box.js';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

const SCRYPT_PARAMS: ScryptOptions = {
  N: 16384,
  r: 16,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};
const KEY_LENGTH = 64;

function deriveKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      SCRYPT_PARAMS,
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

/** Default hasher: scrypt, stored as `salt:key` in hex. */
export const scryptHasher: PasswordHasher = {
  async hash(password) {
    const salt = randomBytes(16).toString('hex');
    const key = await deriveKey(password, salt);
    return `${salt}:${key.toString('hex')}`;
  },
  async verify(password, hash) {
    const [salt, key] = hash.split(':');
    if (!salt || !key) return false;
    const expected = Buffer.from(key, 'hex');
    const actual = await deriveKey(password, salt);
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  },
};

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function generateId(): string {
  return crypto.randomUUID();
}

/** PKCE S256 challenge of a code verifier. */
export function codeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}
