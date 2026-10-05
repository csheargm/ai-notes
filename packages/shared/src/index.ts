export type ISODateString = string;

export function createId(prefix = "id"): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `${prefix}_${uuid}`
    : `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function nowIso(): ISODateString {
  return new Date().toISOString();
}
