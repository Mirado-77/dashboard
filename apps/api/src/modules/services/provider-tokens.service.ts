import { Inject, Injectable } from '@nestjs/common';
import {
  AUTH_INSTANCE,
  type AuthInstance,
  type ProviderAccessToken,
} from '../auth/auth.contract.js';
import { providerOf } from './subscriptions.rules.js';
import type { Service } from './registry/types.js';

/**
 * Access tokens of the linked accounts, for the widgets of `oauth` services.
 *
 * The token is refreshed when needed by the auth module, and it never leaves
 * the API: widgets call the third-party service from here.
 */
@Injectable()
export class ProviderTokens {
  constructor(@Inject(AUTH_INSTANCE) private readonly auth: AuthInstance) {}

  forService(
    userId: string,
    service: Service,
  ): Promise<ProviderAccessToken | null> {
    if (service.providerType !== 'oauth') return Promise.resolve(null);
    return this.auth.api.getAccessToken({
      userId,
      providerId: providerOf(service),
    });
  }
}
