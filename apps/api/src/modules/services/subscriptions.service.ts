import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DATABASE, type Database } from '../../database/database.module.js';
import { accounts, serviceSubscriptions } from '../../database/schema/index.js';
import {
  CredentialsCipher,
  type ServiceCredentials,
} from './credentials.service.js';
import { ServiceRegistry } from './registry/registry.js';
import type { Service, Widget } from './registry/types.js';
import {
  assertSubscribable,
  credentialsToStore,
  hasGrantedScopes,
  providerOf,
} from './subscriptions.rules.js';
import { parseScopes } from '../auth/custom/oauth/tokens.js';

export type WidgetSummary = Pick<
  Widget,
  | 'id'
  | 'name'
  | 'description'
  | 'params'
  | 'defaultRefreshRate'
  | 'minRefreshRate'
>;

export interface ServiceSummary {
  id: string;
  name: string;
  description: string;
  providerType: Service['providerType'];
  oauthProviderId: string;
  oauthScopes: string[];
  credentialFields: Service['credentialFields'];
  widgets: WidgetSummary[];
  /** Always false for a service that needs no account: it has no subscription. */
  subscribed: boolean;
  /** Its widgets can be added: available by default, or subscribed. */
  available: boolean;
  /** For an `oauth` service, the linked account granted every scope it needs. */
  accessGranted: boolean;
  hasCredentials: boolean;
}

interface SummaryState {
  subscribed: boolean;
  accessGranted: boolean;
  hasCredentials: boolean;
}

function toSummary(
  service: Service,
  { subscribed, accessGranted, hasCredentials }: SummaryState,
): ServiceSummary {
  const byDefault = service.providerType === 'none';
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    providerType: service.providerType,
    oauthProviderId: providerOf(service),
    oauthScopes: service.oauthScopes ?? [],
    credentialFields: service.credentialFields,
    widgets: service.widgets.map((widget) => ({
      id: widget.id,
      name: widget.name,
      description: widget.description,
      params: widget.params,
      defaultRefreshRate: widget.defaultRefreshRate,
      minRefreshRate: widget.minRefreshRate,
    })),
    subscribed: !byDefault && subscribed,
    available: byDefault || subscribed,
    accessGranted: service.providerType !== 'oauth' || accessGranted,
    hasCredentials,
  };
}

@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly registry: ServiceRegistry,
    private readonly cipher: CredentialsCipher,
  ) {}

  private service(serviceId: string): Service {
    const service = this.registry.getOne(serviceId);
    if (!service) {
      throw new NotFoundException({
        code: 'SERVICE_NOT_FOUND',
        message: `Unknown service: ${serviceId}`,
      });
    }
    return service;
  }

  async list(userId: string): Promise<ServiceSummary[]> {
    const rows = await this.db
      .select()
      .from(serviceSubscriptions)
      .where(eq(serviceSubscriptions.userId, userId));
    const byService = new Map(rows.map((row) => [row.serviceId, row]));

    const linked = await this.db
      .select({ providerId: accounts.providerId, scope: accounts.scope })
      .from(accounts)
      .where(eq(accounts.userId, userId));
    const scopesByProvider = new Map(
      linked.map((row) => [row.providerId, parseScopes(row.scope)]),
    );

    return this.registry.getAll().map((service) =>
      toSummary(service, {
        subscribed: byService.has(service.id),
        accessGranted: hasGrantedScopes(
          service,
          scopesByProvider.get(providerOf(service)) ?? null,
        ),
        hasCredentials: byService.get(service.id)?.credentials != null,
      }),
    );
  }

  async subscribe(
    userId: string,
    serviceId: string,
    body: unknown,
  ): Promise<ServiceSummary> {
    const service = this.service(serviceId);
    assertSubscribable(service);
    const credentials = credentialsToStore(
      service,
      body,
      await this.linkedScopes(userId, service),
    );

    await this.db
      .insert(serviceSubscriptions)
      .values({
        id: randomUUID(),
        userId,
        serviceId,
        credentials: credentials && this.cipher.encrypt(credentials),
      })
      .onConflictDoUpdate({
        target: [serviceSubscriptions.userId, serviceSubscriptions.serviceId],
        set: {
          credentials: credentials && this.cipher.encrypt(credentials),
          updatedAt: new Date(),
        },
      });

    return toSummary(service, {
      subscribed: true,
      accessGranted: true,
      hasCredentials: credentials !== null,
    });
  }

  async unsubscribe(userId: string, serviceId: string): Promise<void> {
    assertSubscribable(this.service(serviceId));
    await this.db
      .delete(serviceSubscriptions)
      .where(
        and(
          eq(serviceSubscriptions.userId, userId),
          eq(serviceSubscriptions.serviceId, serviceId),
        ),
      );
  }

  async credentialsOf(
    userId: string,
    serviceId: string,
  ): Promise<ServiceCredentials | null> {
    const [row] = await this.db
      .select()
      .from(serviceSubscriptions)
      .where(
        and(
          eq(serviceSubscriptions.userId, userId),
          eq(serviceSubscriptions.serviceId, serviceId),
        ),
      );
    return row?.credentials ? this.cipher.decrypt(row.credentials) : null;
  }

  private async linkedScopes(
    userId: string,
    service: Service,
  ): Promise<string[] | null> {
    if (service.providerType !== 'oauth') return null;
    const [row] = await this.db
      .select({ scope: accounts.scope })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.providerId, providerOf(service)),
        ),
      );
    if (!row) {
      return null;
    }

    return parseScopes(row.scope);
  }
}
