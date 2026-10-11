import { post } from './client';
import { env } from './config';
import { Order, printOrder } from './order';

const id = env.PAYOUT_MCH_ORDER_NO ? { mchOrderNo: env.PAYOUT_MCH_ORDER_NO } : { payoutOrderId: env.PAYOUT_ORDER_ID };
if (!Object.values(id)[0]) throw new Error('Set PAYOUT_MCH_ORDER_NO or PAYOUT_ORDER_ID in .env');

post<Order>('/payout/query', id).then(printOrder).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
