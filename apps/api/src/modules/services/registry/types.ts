export type WidgetParamType = 'integer' | 'string';
export type ProviderType = 'none' | 'oauth' | 'credentials';

export interface WidgetContext {
  config: Record<string, string | number>;
}

export interface WidgetParam {
  name: string;
  type: WidgetParamType;
  defaultValue?: string | number;
  required: boolean;
}

export interface Widget {
  id: string;
  params: WidgetParam[];
  name: string;
  description: string;
  defaultRefreshRate: number;
  minRefreshRate: number;
  getWidgetData: (ctx: WidgetContext) => Promise<unknown>;
}

/** One field a `credentials` service asks the user to fill in. */
export interface CredentialField {
  name: string;
  label: string;
  /** Hidden while typing and never sent back to the browser. */
  secret: boolean;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  providerType: ProviderType;
  /** Provider of the linked account, for `oauth` services. Defaults to `id`. */
  oauthProviderId?: string;
  /** Fields to fill in, for `credentials` services. */
  credentialFields?: CredentialField[];
  widgets: Widget[];
}
