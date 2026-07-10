import { randomBytes } from "node:crypto";

export function generateReconnectToken(): string {
  return randomBytes(32).toString("hex");
}
