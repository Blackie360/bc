import { randomUUID } from "node:crypto";

export function createId() {
  return randomUUID();
}

export function buildReference() {
  return `BC-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}
