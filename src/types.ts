export type ConnectionState = "online" | "offline" | "review" | "error" | "timeout" | "unknown";

export type NayeStatus = {
  system?: string;
  status?: string;
  host?: string;
  port?: number;
  timestamp?: string;
  openClawGateway?: string;
  purpose?: string;
};

export type OpenClawStatus = {
  component?: string;
  bridge?: {
    ok?: boolean;
    exitCode?: number | null;
    timedOut?: boolean;
    stdout?: string;
    stderr?: string;
    statusDetected?: string;
  };
};

export type OpenClawConfigSummary = {
  component?: string;
  config?: {
    found?: boolean;
    configPath?: string;
    sanitized?: {
      gateway?: {
        authMode?: string;
      };
      pluginsPresent?: boolean;
      channelsPresent?: boolean;
      webPresent?: boolean;
      secretsRedacted?: boolean;
      [key: string]: unknown;
    };
  };
};

export type NodeProfile = Record<string, unknown>;
export type ActiveSessions = unknown;


export type ChatRequest = {
  message: string;
  sessionId?: string | null;
};

export type ChatResponse = {
  ok?: boolean;
  id?: string;
  timestamp?: string;
  source?: string;
  mode?: string;
  reply?: string;
  bridge?: {
    ok?: boolean;
    statusDetected?: string;
    timedOut?: boolean;
  };
};

export type DesktopContext = {
  appName: string;
  appVersion: string;
  mode: "development" | "production";
  apiBaseUrl: string;
  renderer: string;
};

export type SystemSnapshot = {
  desktopContext?: DesktopContext | null;
  status?: NayeStatus | null;
  openClawStatus?: OpenClawStatus | null;
  openClawConfig?: OpenClawConfigSummary | null;
  nodeProfile?: NodeProfile | null;
  activeSessions?: ActiveSessions | null;
  lastUpdated?: string | null;
  loading: boolean;
  error?: string | null;
  warnings?: string[];
};

declare global {
  interface Window {
    nayeDesktop?: {
      getDesktopContext: () => Promise<DesktopContext>;
      getStatus: () => Promise<NayeStatus>;
      getOpenClawStatus: () => Promise<OpenClawStatus>;
      getOpenClawConfig: () => Promise<OpenClawConfigSummary>;
      getNodeProfile: () => Promise<NodeProfile>;
      getActiveSessions: () => Promise<ActiveSessions>;
      sendChat: (payload: ChatRequest) => Promise<ChatResponse>;
    };
  }
}
