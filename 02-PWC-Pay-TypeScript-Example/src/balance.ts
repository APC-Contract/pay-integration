import { post } from './client';

post<{ usable: string; locked: string; total: string }>('/balance/query').then((d) => {
  console.log(`usable ${d.usable} locked ${d.locked} total ${d.total} USDT`);
}).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
