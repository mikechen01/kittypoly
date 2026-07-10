export interface Session {
  code: string;
  reconnectToken: string;
  playerId: string;
}

const SESSION_KEY = "kittypoly.session";

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const value: unknown = JSON.parse(raw);
    if (!isSession(value)) return null;
    return value;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

function isSession(value: unknown): value is Session {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.code === "string" &&
    typeof candidate.reconnectToken === "string" &&
    typeof candidate.playerId === "string"
  );
}
