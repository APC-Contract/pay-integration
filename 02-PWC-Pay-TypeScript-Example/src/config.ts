import 'dotenv/config';
import { createPrivateKey, createPublicKey } from 'crypto';
import { readFileSync } from 'fs';

const required = ['API', 'MCH_NO', 'APP_ID', 'PRIVATE_KEY', 'PLATFORM_PUBLIC_KEY'] as const;

export const config = Object.fromEntries(
  required.map((key) => {
    const value = process.env[key];
    if (!value) throw new Error(`Missing ${key} in .env`);
    return [key, value];
  }),
) as Record<(typeof required)[number], string>;

if (!config.API.startsWith('https://')) throw new Error('API must use https://');

// Keys are loaded once at startup; PRIVATE_KEY_PASSPHRASE unlocks an encrypted private key.
export const privateKey = createPrivateKey({ key: readFileSync(config.PRIVATE_KEY), passphrase: process.env.PRIVATE_KEY_PASSPHRASE });
export const platformPublicKey = createPublicKey(readFileSync(config.PLATFORM_PUBLIC_KEY));

export const env = process.env;
