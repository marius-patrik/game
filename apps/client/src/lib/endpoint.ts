type Overrides = { __API__?: string; __WS__?: string };

export function resolveApiBase(): string {
  if (typeof window === "undefined") return "http://localhost:2567";
  const override = (window as unknown as Overrides).__API__;
  if (override) return override;
  const { protocol, hostname, port, origin } = window.location;
  if (port === "3000" && (hostname === "localhost" || hostname === "127.0.0.1")) {
    return `${protocol}//${hostname}:2567`;
  }
  return origin;
}

export function resolveWsEndpoint(): string {
  if (typeof window === "undefined") return "ws://localhost:2567";
  const override = (window as unknown as Overrides).__WS__;
  if (override) return override;
  const { protocol, hostname, port, host } = window.location;
  if (port === "3000" && (hostname === "localhost" || hostname === "127.0.0.1")) {
    return `ws://${hostname}:2567`;
  }
  const wsProto = protocol === "https:" ? "wss:" : "ws:";
  return `${wsProto}//${host}`;
}
