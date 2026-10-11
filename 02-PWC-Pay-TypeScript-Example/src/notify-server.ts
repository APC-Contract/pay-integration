import { createServer } from 'http';
import { config, env, platformPublicKey } from './config';
import { canonical, verify } from './sign';

// ponytail: in-memory dedup, use a unique index on notifyId in your database.
const seen = new Set<string>();

// Returns a rejection reason, or '' when the callback is accepted.
function handle(body: Record<string, string>): string {
  if (!body.sign || !verify(platformPublicKey, canonical(body), body.sign)) return 'bad signature';
  if (body.mchNo !== config.MCH_NO || body.appId !== config.APP_ID) return 'wrong merchant';
  if (body.notifyType !== 'PAYOUT_ORDER') return 'unknown notifyType';
  // Replace with a lookup of your stored order by mchOrderNo.
  const order = { mchOrderNo: env.PAYOUT_MCH_ORDER_NO, fiatAmount: env.PAYOUT_FIAT_AMOUNT, fiatCurrency: env.PAYOUT_FIAT_CURRENCY };
  if (body.mchOrderNo !== order.mchOrderNo || body.fiatAmount !== order.fiatAmount || body.fiatCurrency !== order.fiatCurrency) return 'order mismatch';
  if (seen.has(body.notifyId)) return '';
  seen.add(body.notifyId);
  console.log(`order ${body.mchOrderNo}: ${body.status}${body.failReason ? ` (${body.failReason})` : ''}`);
  return '';
}

createServer((req, res) => {
  const chunks: Buffer[] = [];
  let size = 0;
  req.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
    if ((size += chunk.length) > 65536) req.destroy();
  });
  req.on('end', () => {
    let reason: string;
    try {
      reason = handle(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    } catch (error) {
      reason = (error as Error).message;
    }
    if (reason) console.error(`rejected callback: ${reason}`);
    res.writeHead(reason ? 400 : 200, { 'Content-Type': 'text/plain' });
    res.end(reason ? 'fail' : 'success');
  });
}).listen(Number(env.NOTIFY_PORT) || 3000, () => console.log(`notify server on :${env.NOTIFY_PORT || 3000}`));
