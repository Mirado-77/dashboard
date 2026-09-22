import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

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

export interface SecretBox {
  encrypt(plain: string): string;
  decrypt(payload: string): string;
}

/** AES-256-GCM with a key derived from the auth secret. */
export function createSecretBox(secret: string): SecretBox {
  if (secret.length < 32) {
    throw new Error('Auth secret must be at least 32 characters');
  }
  const key = Buffer.from(
    hkdfSync('sha256', secret, 'dashboard-auth', 'secret-box', 32),
  );

  return {
    encrypt(plain) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([
        cipher.update(plain, 'utf8'),
        cipher.final(),
      ]);
      return ['v1', iv, cipher.getAuthTag(), data]
        .map((part) =>
          typeof part === 'string' ? part : part.toString('base64url'),
        )
        .join('.');
    },
    decrypt(payload) {
      const [version, iv, tag, data] = payload.split('.');
      if (version !== 'v1' || !iv || !tag || !data) {
        throw new Error('Malformed encrypted payload');
      }
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(iv, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(data, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    },
  };
}
