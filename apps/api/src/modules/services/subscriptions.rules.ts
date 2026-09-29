import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import type { ServiceCredentials } from './credentials.service.js';
import type { CredentialField, Service } from './registry/types.js';

export function buildCredentialsSchema(fields: CredentialField[]) {
  const shape: Record<string, z.ZodString> = {};
  for (const field of fields) {
    shape[field.name] = z.string().trim().min(1).max(500);
  }
  return z.strictObject(shape);
}

/** Provider the user must have linked to subscribe to an `oauth` service. */
export function providerOf(service: Service): string {
  return service.oauthProviderId ?? service.id;
}

/**
 * Credentials to store for a subscription, or null when the service needs
 * none. Throws when the request does not match what the service expects.
 */
export function credentialsToStore(
  service: Service,
  body: unknown,
  hasLinkedAccount: boolean,
): ServiceCredentials | null {
  if (service.providerType === 'oauth' && !hasLinkedAccount) {
    throw new BadRequestException({
      code: 'PROVIDER_NOT_LINKED',
      message: `Link your ${service.name} account first`,
    });
  }

  if (service.providerType !== 'credentials') {
    return null;
  }

  const result = buildCredentialsSchema(
    service.credentialFields ?? [],
  ).safeParse(body ?? {});
  if (!result.success) {
    throw new BadRequestException({
      code: 'INVALID_CREDENTIALS',
      message: `This service expects: ${(service.credentialFields ?? [])
        .map((field) => field.name)
        .join(', ')}`,
    });
  }
  return result.data;
}
