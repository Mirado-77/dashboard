// Mirrors apps/api/src/modules/services/subscriptions.service.ts.

export type ProviderType = "none" | "oauth" | "credentials";

export interface CredentialField {
  name: string;
  label: string;
  secret: boolean;
}

export type WidgetParamType = "integer" | "string";

export interface WidgetParam {
  name: string;
  type: WidgetParamType;
  defaultValue?: string | number;
  required: boolean;
}

export interface WidgetSummary {
  id: string;
  name: string;
  description: string;
  params: WidgetParam[];
  /** In seconds. */
  defaultRefreshRate: number;
  minRefreshRate: number;
}

export interface ServiceSummary {
  id: string;
  name: string;
  description: string;
  providerType: ProviderType;
  credentialFields?: CredentialField[];
  widgets: WidgetSummary[];
  subscribed: boolean;
  /** Whether credentials are stored, never what they contain. */
  hasCredentials: boolean;
}
