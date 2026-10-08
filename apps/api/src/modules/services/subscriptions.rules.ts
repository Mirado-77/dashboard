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

/** A service that needs no account is available by default, unsubscribed. */
export function assertSubscribable(service: Service): void {
  if (service.providerType === 'none') {
    throw new BadRequestException({
      code: 'NO_SUBSCRIPTION_NEEDED',
      message: `${service.name} is available by default`,
    });
  }
}

/** Whether the linked account granted every scope the service needs. */
export function hasGrantedScopes(
  service: Service,
  linkedScopes: string[] | null,
): boolean {
  if (linkedScopes === null) return false;
  return (service.oauthScopes ?? []).every((scope) =>
    linkedScopes.includes(scope),
  );
}

/**
 * Credentials to store for a subscription, or null when the service needs
 * none. Throws when the request does not match what the service expects.
 */
export function credentialsToStore(
  service: Service,
  body: unknown,
  linkedScopes: string[] | null,
): ServiceCredentials | null {
  if (service.providerType === 'oauth' && linkedScopes === null) {
    throw new BadRequestException({
      code: 'PROVIDER_NOT_LINKED',
      message: `Link your ${service.name} account first`,
    });
  }

  if (
    service.providerType === 'oauth' &&
    !hasGrantedScopes(service, linkedScopes)
  ) {
    throw new BadRequestException({
      code: 'PROVIDER_SCOPE_MISSING',
      message: `Allow access to your ${service.name} first`,
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
