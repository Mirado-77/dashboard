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
import type { Service } from './registry/types.js';
import { credentialsToStore, providerOf } from './subscriptions.rules.js';

export interface ServiceSummary {
  id: string;
  name: string;
  description: string;
  providerType: Service['providerType'];
  credentialFields: Service['credentialFields'];
  subscribed: boolean;
  /** Whether credentials are stored, never what they contain. */
  hasCredentials: boolean;
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

    return this.registry.getAll().map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      providerType: service.providerType,
      credentialFields: service.credentialFields,
      subscribed: byService.has(service.id),
      hasCredentials: byService.get(service.id)?.credentials != null,
    }));
  }

  async subscribe(
    userId: string,
    serviceId: string,
    body: unknown,
  ): Promise<ServiceSummary> {
    const service = this.service(serviceId);
    const credentials = credentialsToStore(
      service,
      body,
      await this.hasLinkedAccount(userId, service),
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

    return {
      id: service.id,
      name: service.name,
      description: service.description,
      providerType: service.providerType,
      credentialFields: service.credentialFields,
      subscribed: true,
      hasCredentials: credentials !== null,
    };
  }

  async unsubscribe(userId: string, serviceId: string): Promise<void> {
    this.service(serviceId);
    await this.db
      .delete(serviceSubscriptions)
      .where(
        and(
          eq(serviceSubscriptions.userId, userId),
          eq(serviceSubscriptions.serviceId, serviceId),
        ),
      );
  }

  /** Decrypted credentials, for the widgets of a service. Never for a route. */
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

  private async hasLinkedAccount(
    userId: string,
    service: Service,
  ): Promise<boolean> {
    if (service.providerType !== 'oauth') return false;
    const [row] = await this.db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.providerId, providerOf(service)),
        ),
      );
    return row !== undefined;
  }
}
