import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSecretBox, type SecretBox } from '../../common/secret-box.js';
import type { Env } from '../../config/env.js';

export type ServiceCredentials = Record<string, string>;

/**
 * Encrypts the credentials a user gives for a third-party service.
 *
 * The key is derived from AUTH_SECRET with its own purpose, so it is not the
 * one protecting the OAuth tokens. Nothing decrypted here ever leaves the API.
 */
@Injectable()
export class CredentialsCipher {
  private readonly box: SecretBox;

  constructor(config: ConfigService<Env, true>) {
    this.box = createSecretBox(
      config.get('AUTH_SECRET', { infer: true }),
      'service-credentials',
    );
  }

  encrypt(credentials: ServiceCredentials): string {
    return this.box.encrypt(JSON.stringify(credentials));
  }

  decrypt(payload: string): ServiceCredentials {
    const parsed: unknown = JSON.parse(this.box.decrypt(payload));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed) ||
      Object.values(parsed).some((value) => typeof value !== 'string')
    ) {
      throw new Error('Malformed credentials payload');
    }
    return parsed as ServiceCredentials;
  }
}
