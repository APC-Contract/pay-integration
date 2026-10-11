import { post } from './client';
import { env } from './config';
import { Order, printOrder } from './order';

// PAYOUT_MCH_ORDER_NO is required: reusing it on retry is what makes the platform idempotent.
const required = ['PAYOUT_MCH_ORDER_NO', 'PAYOUT_FIAT_AMOUNT', 'PAYOUT_FIAT_CURRENCY', 'PAYOUT_QR_CONTENT', 'PAYOUT_USER_EMAIL', 'PAYOUT_NOTIFY_URL'] as const;
for (const key of required) {
  if (!env[key]) throw new Error(`Missing ${key} in .env`);
}

post<Order>('/payout/create', {
  mchOrderNo: env.PAYOUT_MCH_ORDER_NO,
  fiatAmount: env.PAYOUT_FIAT_AMOUNT,
  fiatCurrency: env.PAYOUT_FIAT_CURRENCY,
  qrContent: env.PAYOUT_QR_CONTENT,
  userEmail: env.PAYOUT_USER_EMAIL,
  notifyUrl: env.PAYOUT_NOTIFY_URL,
  extParam: env.PAYOUT_EXT_PARAM || undefined,
}).then(printOrder).catch((error) => {
  console.error(error.message);
  console.error('Unsure whether the order was created? Run query-payout.ts with the same PAYOUT_MCH_ORDER_NO before retrying.');
  process.exit(1);
});
