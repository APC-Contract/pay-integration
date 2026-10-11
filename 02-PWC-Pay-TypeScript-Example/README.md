# Payout TypeScript Examples

Minimal Node.js examples for the Payout merchant API.

**Warning:** `create-payout.ts` sends a real payout on every run. Never run it with unedited `.env` values.

## Requirements

- Node.js 18 or newer
- Merchant private key
- Platform public key
- Merchant number and app ID from the portal

## Setup

```bash
npm ci
cp .env.example .env
```

Edit `.env` with your real values. `.env` and `keys/` are git-ignored; keep them out of version control and CI logs.

## Run

```bash
npx ts-node src/balance.ts
npx ts-node src/currency.ts
npx ts-node src/create-payout.ts
npx ts-node src/query-payout.ts
npx ts-node src/notify-server.ts
```

`create-payout.ts` reads payout parameters from `.env`. Set a new `PAYOUT_MCH_ORDER_NO` for each payout and reuse the same value when retrying: the platform returns the existing order instead of paying twice. `notify-server.ts` accepts callbacks for that same order number. After a timeout or `4001`, run `query-payout.ts` before retrying.

`query-payout.ts` reads `PAYOUT_MCH_ORDER_NO` or `PAYOUT_ORDER_ID` from `.env`.

`notify-server.ts` is a reference callback receiver: it verifies the platform signature, checks `mchNo`, `appId`, amount and currency, deduplicates by `notifyId`, then replies `success`. Point `PAYOUT_NOTIFY_URL` at it through a public HTTPS endpoint.

Every successful response is verified with the platform public key; a missing or invalid signature aborts the run. By default each script prints only what it is for: balance figures, the currency list, or the order number and status. Set `DEBUG=1` to also print the canonical string, the signed request body, the raw response and the full `data`; that output contains payee details, so do not paste it into tickets or chat.

## Keys

Generate a merchant key pair if you do not already have one:

```bash
mkdir -p keys
(umask 077 && openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 | openssl pkcs8 -topk8 -nocrypt -out keys/private.pem)
openssl pkey -in keys/private.pem -pubout -out keys/public.pem
openssl pkey -pubin -in keys/public.pem -outform DER | openssl dgst -sha256
```

Upload `keys/public.pem` in the portal and keep `keys/private.pem` secret. To store the private key encrypted, drop `-nocrypt` and set `PRIVATE_KEY_PASSPHRASE` in `.env`.
