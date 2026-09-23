import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

export interface SecretBox {
  encrypt(plain: string): string;
  decrypt(payload: string): string;
}

/**
 * AES-256-GCM with a key derived from the application secret.
 *
 * `purpose` separates the keys: two boxes built from the same secret with a
 * different purpose cannot read each other, so a leak stays contained.
 */
export function createSecretBox(
  secret: string,
  purpose = 'secret-box',
): SecretBox {
  if (secret.length < 32) {
    throw new Error('Auth secret must be at least 32 characters');
  }
  const key = Buffer.from(
    hkdfSync('sha256', secret, 'dashboard-auth', purpose, 32),
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
