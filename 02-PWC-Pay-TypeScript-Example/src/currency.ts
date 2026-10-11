import { post } from './client';
import { env } from './config';

post<{ fiatCurrencies: unknown[] }>('/currency/query', env.PAYOUT_FIAT_CURRENCY ? { fiatCurrency: env.PAYOUT_FIAT_CURRENCY } : {}).then((d) => {
  console.log(JSON.stringify(d.fiatCurrencies, null, 2));
}).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
