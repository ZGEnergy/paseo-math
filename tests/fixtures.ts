export const theme = {
  colors: {
    surface0: "#0d1117", surface1: "#161b22", surface2: "#21262d", border: "#30363d",
    foreground: "#e6edf3", foregroundMuted: "#8b949e", accent: "#2f81f7", accentForeground: "#ffffff",
    statusSuccess: "#3fb950", statusWarning: "#d29922", statusDanger: "#f85149",
  },
};

export function props(text: string, phase: "streaming" | "complete" = "complete") {
  return {
    agentId: "agent-1",
    item: { type: "plugin" as const, kind: "math-message", version: 2, data: { text, phase } },
    timestamp: new Date(0),
    theme,
    host: { id: "host-1", label: "Host" },
    layout: { compact: false, platform: "web" as const },
  };
}
