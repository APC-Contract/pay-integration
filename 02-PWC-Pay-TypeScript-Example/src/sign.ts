import { createSign, createVerify, KeyObject, randomBytes } from 'crypto';

function valueText(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value) || (value && typeof value === 'object')) return JSON.stringify(sortJson(value));
  return String(value);
}

function sortJson(value: unknown, depth = 0): unknown {
  if (depth > 32) throw new Error('JSON nested too deep');
  if (Array.isArray(value)) return value.map((v) => sortJson(v, depth + 1));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => [k, sortJson(v, depth + 1)]));
}

export function canonical(fields: Record<string, unknown>, uri = ''): string {
  const parts = Object.keys(fields)
    .filter((key) => key !== 'sign' && fields[key] !== null && fields[key] !== undefined && fields[key] !== '')
    .sort()
    .map((key) => `${key}=${encodeURIComponent(valueText(fields[key])).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`);
  if (uri) parts.push(`uri=${encodeURIComponent(uri)}`);
  return parts.join('&');
}

export function reqTime(): string {
  return new Date().toISOString();
}

export function nonce(): string {
  return randomBytes(16).toString('hex');
}

export function sign(key: KeyObject, text: string): string {
  return createSign('RSA-SHA256').update(text).sign(key, 'base64');
}

export function verify(key: KeyObject, text: string, signature: string): boolean {
  return createVerify('RSA-SHA256').update(text).verify(key, signature, 'base64');
}
