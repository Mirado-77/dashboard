// Mirrors apps/api/src/modules/services/subscriptions.service.ts.

export type ProviderType = "none" | "oauth" | "credentials";

export interface CredentialField {
  name: string;
  label: string;
  secret: boolean;
}

export interface ServiceSummary {
  id: string;
  name: string;
  description: string;
  providerType: ProviderType;
  credentialFields?: CredentialField[];
  subscribed: boolean;
  /** Whether credentials are stored, never what they contain. */
  hasCredentials: boolean;
}
