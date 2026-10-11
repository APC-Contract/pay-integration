# Payout API Reference

Updated 2026-09-12

## 1. Overview

The merchant API creates and queries payout orders.

Base URL example: `https://pwc-pay-api.chiachair.com/v1`

Your reverse proxy may expose a version prefix such as `/v1`, but the signed `uri` is always the backend path, for example `/payout/create`.

Before calling the API, create a merchant app in the portal with:

| Item | Description |
|---|---|
| Merchant number | `mchNo`, assigned by the platform. |
| App ID | `appId`, assigned by the platform. |
| Merchant public key | Uploaded in the portal. The matching private key signs requests. |
| Platform public key | Downloaded from the portal. Used to verify platform responses and callbacks. |
| IP whitelist | Server egress IPs allowed to call the merchant API. |
| Currency whitelist | Fiat currencies allowed for the app. |

Requests from non-whitelisted IPs are refused with `1002`. Requests for currencies not enabled for the app are refused with `3003`.

## 2. Common Request Fields

Every request body is a JSON object and includes these common fields:

| Field | Type | Required | Description |
|---|---:|:---:|---|
| `mchNo` | string | Yes | Merchant number. |
| `appId` | string | Yes | App ID. |
| `reqTime` | string | Yes | UTC RFC 3339 timestamp with milliseconds, within ±5 minutes of platform time. |
| `nonceStr` | string | Yes | Random nonce, recommended 32 characters. Unique per app within the `reqTime` window; a reused nonce is refused with `1003`. |
| `sign` | string | Yes | Base64 RSA-SHA256 signature. |

## 3. Common Response Envelope

All merchant API responses use the same JSON envelope.

| Field | Type | Description |
|---|---:|---|
| `code` | integer | `0` means success. Non-zero means failure. |
| `msg` | string | Fixed message for `code`. |
| `requestId` | string | Platform request ID for support and troubleshooting. |
| `data` | object | Response data. Empty object on failures. |
| `sign` | string | Present only on successful merchant API responses with non-empty `data`. |

Verify `sign` with the platform public key before trusting successful response data.

## 4. Signing Rules

### 4.1 Canonical String

1. Take every top-level JSON field.
2. Drop `sign`.
3. Drop fields whose value is `null` or an empty string.
4. Sort remaining field names in ASCII order.
5. Render each field as `key=value`.
6. Percent-encode values according to RFC 3986. Keep `A-Z`, `a-z`, `0-9`, `-`, `.`, `_`, `~`; encode all other bytes as uppercase `%XX`.
7. Join fields with `&`.
8. For requests only, append `uri=<path>` as the last field, where `<path>` is the backend path such as `/payout/create`.

Object or array values are serialized as compact JSON before percent-encoding. Object keys are sorted. Non-ASCII characters are not escaped.

### 4.2 Signature Algorithm

| Item | Value |
|---|---|
| Algorithm | SHA256withRSA |
| Padding | PKCS#1 v1.5 |
| Input bytes | UTF-8 bytes of the canonical string |
| Output | Standard Base64 |

### 4.3 Platform Response Verification

For successful responses with non-empty `data`, verify `sign` over the top-level fields inside `data`. Do not append `uri`.

`data` also carries `nonceStr`, the nonce of your request. After verifying `sign`, check that it equals the nonce you sent; a mismatch means the response belongs to another request.

### 4.4 Callback Verification

For callbacks, verify `sign` over the callback body fields. Do not append `uri`.

## 5. Endpoints

### 5.1 POST `/balance/query`

Returns the merchant USDT wallet balance.

#### Request Parameters

No business parameters. Only common request fields are required.

#### Response `data`

| Field | Type | Description |
|---|---:|---|
| `usable` | string | Available USDT balance. |
| `locked` | string | Locked USDT balance. |
| `total` | string | Total USDT balance. |

### 5.2 POST `/currency/query`

Returns fiat currencies currently available to the app.

#### Request Parameters

| Field | Type | Required | Description |
|---|---:|:---:|---|
| `fiatCurrency` | string | No | Optional ISO 4217 currency code. If present, returns only that currency or `3003`. |

Common request fields are also required.

#### Response `data`

| Field | Type | Description |
|---|---:|---|
| `fiatCurrencies` | array | Available currency objects. |

Each `fiatCurrencies` item:

| Field | Type | Description |
|---|---:|---|
| `currency` | string | ISO 4217 fiat currency code. |
| `decimals` | integer | Required decimal places for amounts in this currency. |
| `exchangeRate` | string | Market rate, fiat per USDT. |
| `feeRate` | string | Merchant fee rate as a fraction. |
| `fixedFee` | string | Fixed per-order fee in the fiat currency. |
| `adjustedExchangeRate` | string | `exchangeRate / (1 + feeRate)`. |
| `minAmount` | string | Minimum fiat amount per order. |
| `maxAmount` | string | Maximum fiat amount per order. |
| `rateUpdatedAt` | string | UTC RFC 3339 timestamp of the rate. |

Order cost is calculated as `fiatAmount / adjustedExchangeRate + fixedFee / exchangeRate`, rounded up to 18 USDT decimal places. The rates and fees are locked when the order is created.

### 5.3 POST `/payout/create`

Creates a payout order.

#### Request Parameters

| Field | Type | Required | Description |
|---|---:|:---:|---|
| `mchOrderNo` | string | Yes | Merchant order number. Must be unique per merchant app. 1-64 characters: letters, digits, underscore, or hyphen. |
| `fiatAmount` | string | Yes | Fiat payout amount. Must use exactly the currency decimal places. |
| `fiatCurrency` | string | Yes | ISO 4217 fiat currency code. |
| `qrContent` | string | Yes | Payee QR code content. |
| `userEmail` | string | Yes | Payee email registered with the payout channel. |
| `notifyUrl` | string | Yes | Merchant callback URL. |
| `extParam` | string | No | Merchant extension field, returned in query results and callbacks when present. |

Common request fields are also required.

#### Idempotency

Repeating the same `mchOrderNo` with the same business parameters returns the same order. Repeating it with different business parameters returns `3002`.

Errors `3001` and `3010` create no order. Fix the problem and retry with the same `mchOrderNo`.

Every retry is a new request: keep `mchOrderNo` and the business parameters, but send a fresh `reqTime` and `nonceStr` and recompute `sign`. Resending the identical signed body is refused with `1003`.

#### Response `data`

| Field | Type | Description |
|---|---:|---|
| `payoutOrderId` | string | Platform payout order ID. |
| `mchOrderNo` | string | Merchant order number. |
| `status` | string | Current order status. Initial successful create status is `ACCEPTED`. |
| `fiatAmount` | string | Fiat payout amount. |
| `fiatCurrency` | string | ISO 4217 fiat currency code. |
| `exchangeRate` | string | Locked market rate. |
| `feeRate` | string | Locked fee rate. |
| `fixedFee` | string | Locked fixed fee. |
| `adjustedExchangeRate` | string | Locked adjusted exchange rate. |
| `usdtAmount` | string | Locked USDT cost. |
| `bankCode` | string | Decoded payee bank or wallet code. |
| `bankName` | string | Decoded payee bank or wallet name. |
| `bankAccountNoMasked` | string | Masked payee account number. |
| `bankAccountName` | string | Payee account name. |

### 5.4 POST `/payout/query`

Queries one payout order.

#### Request Parameters

Provide at least one identifier.

| Field | Type | Required | Description |
|---|---:|:---:|---|
| `mchOrderNo` | string | Conditional | Merchant order number. 1-64 characters: letters, digits, underscore, or hyphen. |
| `payoutOrderId` | string | Conditional | Platform payout order ID. |

Common request fields are also required.

#### Response `data`

| Field | Type | Description |
|---|---:|---|
| `payoutOrderId` | string | Platform payout order ID. |
| `mchOrderNo` | string | Merchant order number. |
| `fiatAmount` | string | Fiat payout amount. |
| `exchangeRate` | string | Locked market rate. |
| `feeRate` | string | Locked fee rate. |
| `fixedFee` | string | Locked fixed fee. |
| `adjustedExchangeRate` | string | Locked adjusted exchange rate. |
| `usdtAmount` | string | Locked USDT cost. |
| `fiatCurrency` | string | ISO 4217 fiat currency code. |
| `bankCode` | string | Payee bank or wallet code. |
| `bankName` | string | Payee bank or wallet name. |
| `bankAccountNoMasked` | string | Masked payee account number. |
| `bankAccountName` | string | Payee account name. |
| `userEmail` | string | Payee email, when present. |
| `status` | string | Current order status. |
| `channelRef` | string | Channel reference, when present. |
| `failReason` | string | Failure reason, only when failed. |
| `extParam` | string | Merchant extension field, when present. |
| `createdAt` | string | UTC RFC 3339 creation time. |
| `finishedAt` | string | UTC RFC 3339 finish time, only for final orders. |

#### Status Values

| Status | Description |
|---|---|
| `ACCEPTED` | Order accepted by the platform. |
| `PROCESSING` | Order is being processed. Do not create another order for the same payout. |
| `SUCCESS` | Order completed successfully. |
| `FAILED` | Order failed. Check `failReason`. |

Failure reasons include `INVALID_PAYEE`, `PAYEE_KYC_REQUIRED`, `CHANNEL_REJECTED`, `CHANNEL_FAILED`, and `MANUAL`.

## 6. Callback Notification

When an order reaches a final status, the platform sends a JSON POST to `notifyUrl`.

### Callback Fields

| Field | Type | Description |
|---|---:|---|
| `payoutOrderId` | string | Platform payout order ID. |
| `mchOrderNo` | string | Merchant order number. |
| `mchNo` | string | Merchant number. |
| `appId` | string | App ID. |
| `fiatAmount` | string | Fiat payout amount. |
| `fiatCurrency` | string | ISO 4217 fiat currency code. |
| `exchangeRate` | string | Locked market rate. |
| `feeRate` | string | Locked fee rate. |
| `fixedFee` | string | Locked fixed fee. |
| `adjustedExchangeRate` | string | Locked adjusted exchange rate. |
| `usdtAmount` | string | Locked USDT cost. |
| `status` | string | Final status: `SUCCESS` or `FAILED`. |
| `failReason` | string | Failure reason, only when failed. |
| `extParam` | string | Merchant extension field, when present. |
| `createdAt` | string | UTC RFC 3339 creation time. |
| `finishedAt` | string | UTC RFC 3339 finish time. |
| `notifyId` | string | Unique notification ID. |
| `notifyType` | string | Notification type. Value: `PAYOUT_ORDER`. |
| `reqTime` | string | UTC RFC 3339 callback time. |
| `nonceStr` | string | Callback nonce. |
| `sign` | string | Platform signature. |

### Merchant Handling Requirements

1. Verify `sign` with the platform public key.
2. Check that `mchNo`, `appId`, `fiatAmount`, and `fiatCurrency` match your order.
3. Deduplicate by `notifyId`.
4. Update the local order state.
5. Reply with HTTP 200 and the plain text body `success`.

Any other response is treated as failure and retried.

### Retry Schedule

The platform retries 11 times over about 46 hours:

| Attempt Delay |
|---|
| 15 seconds |
| 1 minute |
| 5 minutes |
| 10 minutes |
| 30 minutes |
| 1 hour |
| 2 hours |
| 6 hours |
| 12 hours |
| 24 hours |

Missed callbacks can be resent from the portal Payouts page.

## 7. Error Codes

| Code | Message | Meaning |
|---:|---|---|
| `1001` | `INVALID_PARAM` | Invalid parameter. |
| `1002` | `IP_NOT_ALLOWED` | Caller IP is not whitelisted. |
| `1003` | `REQUEST_EXPIRED` | `reqTime` is outside ±5 minutes, or `nonceStr` was already used within the window. |
| `1004` | `SIGN_ERROR` | Signature is invalid. |
| `1006` | `APP_NOT_FOUND` | App is unknown, disabled, or not owned by the merchant. |
| `3001` | `INSUFFICIENT_BALANCE` | Insufficient USDT balance. |
| `3002` | `PAYOUT_NO_DUPLICATED` | Duplicate merchant order number with different parameters. |
| `3003` | `CURRENCY_NOT_SUPPORTED` | Currency is not available for this app. |
| `3004` | `RATE_UNAVAILABLE` | Rate is unavailable. Retry later. |
| `3005` | `BANK_CODE_INVALID` | Bank or wallet code is invalid. |
| `3007` | `QR_DECODE_FAILED` | QR code could not be decoded. |
| `3008` | `QR_AMOUNT_MISMATCH` | QR code amount or currency differs from the request. |
| `3009` | `ORDER_NOT_FOUND` | Order was not found. |
| `3010` | `AMOUNT_OUT_OF_RANGE` | Amount is outside the currency min/max range. |
| `4001` | `SYSTEM_ERROR` | System error. Query the order before retrying. |
