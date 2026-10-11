# 代付 API 参考

更新日期 2026-09-12

## 1. 概述

商户 API 用于创建和查询代付订单。

Base URL 示例：`https://pwc-pay-api.chiachair.com/v1`

反向代理可能会暴露 `/v1` 之类的版本前缀，但签名中的 `uri` 始终是后端路径，例如 `/payout/create`。

调用 API 前，请先在门户中创建商户应用，并准备以下内容：

| 项目 | 说明 |
|---|---|
| 商户号 | `mchNo`，由平台分配。 |
| 应用 ID | `appId`，由平台分配。 |
| 商户公钥 | 在门户中上传。对应的私钥用于对请求签名。 |
| 平台公钥 | 从门户下载。用于验证平台响应和回调的签名。 |
| IP 白名单 | 允许调用商户 API 的服务器出口 IP。 |
| 币种白名单 | 该应用允许使用的法币币种。 |

来自非白名单 IP 的请求将被拒绝，返回 `1002`。请求应用未开通的币种将被拒绝，返回 `3003`。

## 2. 公共请求字段

每个请求体都是一个 JSON 对象，并包含以下公共字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---:|:---:|---|
| `mchNo` | string | 是 | 商户号。 |
| `appId` | string | 是 | 应用 ID。 |
| `reqTime` | string | 是 | UTC RFC 3339 时间戳，含毫秒，与平台时间相差不超过 ±5 分钟。 |
| `nonceStr` | string | 是 | 随机字符串，建议 32 个字符。在 `reqTime` 有效窗口内每个应用必须唯一；重复使用的 nonce 将被拒绝，返回 `1003`。 |
| `sign` | string | 是 | Base64 编码的 RSA-SHA256 签名。 |

## 3. 公共响应结构

所有商户 API 响应使用相同的 JSON 结构。

| 字段 | 类型 | 说明 |
|---|---:|---|
| `code` | integer | `0` 表示成功，非零表示失败。 |
| `msg` | string | 与 `code` 对应的固定消息。 |
| `requestId` | string | 平台请求 ID，用于技术支持和排查问题。 |
| `data` | object | 响应数据。失败时为空对象。 |
| `sign` | string | 仅在成功且 `data` 非空的商户 API 响应中出现。 |

在信任成功响应的数据之前，请先用平台公钥验证 `sign`。

## 4. 签名规则

### 4.1 待签名字符串

1. 取所有顶层 JSON 字段。
2. 去掉 `sign`。
3. 去掉值为 `null` 或空字符串的字段。
4. 将剩余字段名按 ASCII 顺序排序。
5. 将每个字段渲染为 `key=value`。
6. 按 RFC 3986 对值进行百分号编码。保留 `A-Z`、`a-z`、`0-9`、`-`、`.`、`_`、`~`；其他所有字节编码为大写 `%XX`。
7. 用 `&` 连接各字段。
8. 仅对请求：在最后追加 `uri=<path>` 字段，其中 `<path>` 是后端路径，例如 `/payout/create`。

对象或数组类型的值在百分号编码前先序列化为紧凑 JSON。对象的键按顺序排列。非 ASCII 字符不做转义。

### 4.2 签名算法

| 项目 | 值 |
|---|---|
| 算法 | SHA256withRSA |
| 填充方式 | PKCS#1 v1.5 |
| 输入字节 | 待签名字符串的 UTF-8 字节 |
| 输出 | 标准 Base64 |

### 4.3 平台响应验签

对于 `data` 非空的成功响应，对 `data` 内的顶层字段验证 `sign`。不要追加 `uri`。

`data` 中还会携带 `nonceStr`，即你请求中的 nonce。验证 `sign` 后，请检查它是否与你发送的 nonce 一致；不一致说明该响应属于另一个请求。

### 4.4 回调验签

对于回调，对回调体字段验证 `sign`。不要追加 `uri`。

## 5. 接口

### 5.1 POST `/balance/query`

返回商户 USDT 钱包余额。

#### 请求参数

无业务参数。仅需公共请求字段。

#### 响应 `data`

| 字段 | 类型 | 说明 |
|---|---:|---|
| `usable` | string | 可用 USDT 余额。 |
| `locked` | string | 锁定 USDT 余额。 |
| `total` | string | USDT 总余额。 |

### 5.2 POST `/currency/query`

返回应用当前可用的法币币种。

#### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|---|---:|:---:|---|
| `fiatCurrency` | string | 否 | 可选的 ISO 4217 币种代码。若传入，则仅返回该币种，否则返回 `3003`。 |

公共请求字段同样必填。

#### 响应 `data`

| 字段 | 类型 | 说明 |
|---|---:|---|
| `fiatCurrencies` | array | 可用币种对象列表。 |

`fiatCurrencies` 的每一项：

| 字段 | 类型 | 说明 |
|---|---:|---|
| `currency` | string | ISO 4217 法币币种代码。 |
| `decimals` | integer | 该币种金额要求的小数位数。 |
| `exchangeRate` | string | 市场汇率，每 USDT 兑换的法币数量。 |
| `feeRate` | string | 商户费率，以小数表示。 |
| `fixedFee` | string | 每笔订单的固定手续费，以法币计。 |
| `adjustedExchangeRate` | string | `exchangeRate / (1 + feeRate)`。 |
| `minAmount` | string | 每笔订单的最小法币金额。 |
| `maxAmount` | string | 每笔订单的最大法币金额。 |
| `rateUpdatedAt` | string | 汇率的 UTC RFC 3339 时间戳。 |

订单成本按 `fiatAmount / adjustedExchangeRate + fixedFee / exchangeRate` 计算，向上取整到 USDT 的 18 位小数。汇率和手续费在订单创建时锁定。

### 5.3 POST `/payout/create`

创建代付订单。

#### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|---|---:|:---:|---|
| `mchOrderNo` | string | 是 | 商户订单号。同一商户应用内必须唯一。1-64 个字符：字母、数字、下划线或连字符。 |
| `fiatAmount` | string | 是 | 法币代付金额。小数位数必须与币种要求完全一致。 |
| `fiatCurrency` | string | 是 | ISO 4217 法币币种代码。 |
| `qrContent` | string | 是 | 收款方二维码内容。 |
| `userEmail` | string | 是 | 收款方在代付渠道注册的邮箱。 |
| `notifyUrl` | string | 是 | 商户回调 URL。 |
| `extParam` | string | 否 | 商户扩展字段，若存在则在查询结果和回调中原样返回。 |

公共请求字段同样必填。

#### 幂等性

使用相同的 `mchOrderNo` 和相同的业务参数重复请求，会返回同一个订单。使用相同的 `mchOrderNo` 但业务参数不同，返回 `3002`。

错误 `3001` 和 `3010` 不会创建订单。修复问题后可用相同的 `mchOrderNo` 重试。

每次重试都是一个新请求：保留 `mchOrderNo` 和业务参数，但需使用新的 `reqTime` 和 `nonceStr`，并重新计算 `sign`。原样重发已签名的请求体将被拒绝，返回 `1003`。

#### 响应 `data`

| 字段 | 类型 | 说明 |
|---|---:|---|
| `payoutOrderId` | string | 平台代付订单 ID。 |
| `mchOrderNo` | string | 商户订单号。 |
| `status` | string | 当前订单状态。创建成功后的初始状态为 `ACCEPTED`。 |
| `fiatAmount` | string | 法币代付金额。 |
| `fiatCurrency` | string | ISO 4217 法币币种代码。 |
| `exchangeRate` | string | 锁定的市场汇率。 |
| `feeRate` | string | 锁定的费率。 |
| `fixedFee` | string | 锁定的固定手续费。 |
| `adjustedExchangeRate` | string | 锁定的调整后汇率。 |
| `usdtAmount` | string | 锁定的 USDT 成本。 |
| `bankCode` | string | 解码得到的收款方银行或钱包代码。 |
| `bankName` | string | 解码得到的收款方银行或钱包名称。 |
| `bankAccountNoMasked` | string | 脱敏后的收款方账号。 |
| `bankAccountName` | string | 收款方账户名。 |

### 5.4 POST `/payout/query`

查询单笔代付订单。

#### 请求参数

至少提供一个标识。

| 字段 | 类型 | 必填 | 说明 |
|---|---:|:---:|---|
| `mchOrderNo` | string | 条件必填 | 商户订单号。1-64 个字符：字母、数字、下划线或连字符。 |
| `payoutOrderId` | string | 条件必填 | 平台代付订单 ID。 |

公共请求字段同样必填。

#### 响应 `data`

| 字段 | 类型 | 说明 |
|---|---:|---|
| `payoutOrderId` | string | 平台代付订单 ID。 |
| `mchOrderNo` | string | 商户订单号。 |
| `fiatAmount` | string | 法币代付金额。 |
| `exchangeRate` | string | 锁定的市场汇率。 |
| `feeRate` | string | 锁定的费率。 |
| `fixedFee` | string | 锁定的固定手续费。 |
| `adjustedExchangeRate` | string | 锁定的调整后汇率。 |
| `usdtAmount` | string | 锁定的 USDT 成本。 |
| `fiatCurrency` | string | ISO 4217 法币币种代码。 |
| `bankCode` | string | 收款方银行或钱包代码。 |
| `bankName` | string | 收款方银行或钱包名称。 |
| `bankAccountNoMasked` | string | 脱敏后的收款方账号。 |
| `bankAccountName` | string | 收款方账户名。 |
| `userEmail` | string | 收款方邮箱，存在时返回。 |
| `status` | string | 当前订单状态。 |
| `channelRef` | string | 渠道参考号，存在时返回。 |
| `failReason` | string | 失败原因，仅失败时返回。 |
| `extParam` | string | 商户扩展字段，存在时返回。 |
| `createdAt` | string | UTC RFC 3339 创建时间。 |
| `finishedAt` | string | UTC RFC 3339 完成时间，仅终态订单返回。 |

#### 状态值

| 状态 | 说明 |
|---|---|
| `ACCEPTED` | 订单已被平台受理。 |
| `PROCESSING` | 订单处理中。请勿为同一笔代付再次创建订单。 |
| `SUCCESS` | 订单已成功完成。 |
| `FAILED` | 订单失败。请查看 `failReason`。 |

失败原因包括 `INVALID_PAYEE`、`PAYEE_KYC_REQUIRED`、`CHANNEL_REJECTED`、`CHANNEL_FAILED` 和 `MANUAL`。

## 6. 回调通知

订单到达终态时，平台会向 `notifyUrl` 发送 JSON POST 请求。

### 回调字段

| 字段 | 类型 | 说明 |
|---|---:|---|
| `payoutOrderId` | string | 平台代付订单 ID。 |
| `mchOrderNo` | string | 商户订单号。 |
| `mchNo` | string | 商户号。 |
| `appId` | string | 应用 ID。 |
| `fiatAmount` | string | 法币代付金额。 |
| `fiatCurrency` | string | ISO 4217 法币币种代码。 |
| `exchangeRate` | string | 锁定的市场汇率。 |
| `feeRate` | string | 锁定的费率。 |
| `fixedFee` | string | 锁定的固定手续费。 |
| `adjustedExchangeRate` | string | 锁定的调整后汇率。 |
| `usdtAmount` | string | 锁定的 USDT 成本。 |
| `status` | string | 终态：`SUCCESS` 或 `FAILED`。 |
| `failReason` | string | 失败原因，仅失败时返回。 |
| `extParam` | string | 商户扩展字段，存在时返回。 |
| `createdAt` | string | UTC RFC 3339 创建时间。 |
| `finishedAt` | string | UTC RFC 3339 完成时间。 |
| `notifyId` | string | 唯一通知 ID。 |
| `notifyType` | string | 通知类型。值：`PAYOUT_ORDER`。 |
| `reqTime` | string | UTC RFC 3339 回调时间。 |
| `nonceStr` | string | 回调 nonce。 |
| `sign` | string | 平台签名。 |

### 商户处理要求

1. 用平台公钥验证 `sign`。
2. 检查 `mchNo`、`appId`、`fiatAmount` 和 `fiatCurrency` 与本地订单一致。
3. 按 `notifyId` 去重。
4. 更新本地订单状态。
5. 返回 HTTP 200，响应体为纯文本 `success`。

任何其他响应都视为失败并会重试。

### 重试计划

平台在约 46 小时内重试 11 次：

| 重试间隔 |
|---|
| 15 秒 |
| 1 分钟 |
| 5 分钟 |
| 10 分钟 |
| 30 分钟 |
| 1 小时 |
| 2 小时 |
| 6 小时 |
| 12 小时 |
| 24 小时 |

遗漏的回调可以在门户的代付页面重新发送。

## 7. 错误码

| 错误码 | 消息 | 含义 |
|---:|---|---|
| `1001` | `INVALID_PARAM` | 参数无效。 |
| `1002` | `IP_NOT_ALLOWED` | 调用方 IP 不在白名单中。 |
| `1003` | `REQUEST_EXPIRED` | `reqTime` 超出 ±5 分钟，或 `nonceStr` 在有效窗口内已被使用。 |
| `1004` | `SIGN_ERROR` | 签名无效。 |
| `1006` | `APP_NOT_FOUND` | 应用不存在、已禁用或不属于该商户。 |
| `3001` | `INSUFFICIENT_BALANCE` | USDT 余额不足。 |
| `3002` | `PAYOUT_NO_DUPLICATED` | 商户订单号重复但参数不同。 |
| `3003` | `CURRENCY_NOT_SUPPORTED` | 该应用不支持此币种。 |
| `3004` | `RATE_UNAVAILABLE` | 汇率不可用。请稍后重试。 |
| `3005` | `BANK_CODE_INVALID` | 银行或钱包代码无效。 |
| `3007` | `QR_DECODE_FAILED` | 二维码无法解码。 |
| `3008` | `QR_AMOUNT_MISMATCH` | 二维码中的金额或币种与请求不一致。 |
| `3009` | `ORDER_NOT_FOUND` | 订单不存在。 |
| `3010` | `AMOUNT_OUT_OF_RANGE` | 金额超出该币种的最小/最大范围。 |
| `4001` | `SYSTEM_ERROR` | 系统错误。重试前请先查询订单。 |
