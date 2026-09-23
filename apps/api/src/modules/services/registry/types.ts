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

export interface Service {
  id: string;
  name: string;
  description: string;
  providerType: ProviderType;
  widgets: Widget[];
}
