import { config, env, platformPublicKey, privateKey } from './config';
import { canonical, nonce, reqTime, sign, verify } from './sign';

type Body = Record<string, unknown>;
type Reply<T> = { code: number; msg: string; requestId?: string; data?: T; sign?: string };

export async function post<T extends Body>(uri: string, business: Body = {}): Promise<T> {
  const body: Body = {
    ...business,
    mchNo: config.MCH_NO,
    appId: config.APP_ID,
    reqTime: reqTime(),
    nonceStr: nonce(),
  };
  const text = canonical(body, uri);
  body.sign = sign(privateKey, text);

  // Request and raw response dumps hold payee data and a replayable signature; opt in with DEBUG=1.
  if (env.DEBUG === '1') console.log('== canonical string\n' + text + '\n== request body\n' + JSON.stringify(body, null, 2));

  const res = await fetch(config.API + uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
    redirect: 'error',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const reply = await res.json() as Reply<T>;
  console.log(`== response ${reply.code} ${reply.msg} (requestId ${reply.requestId})`);
  if (env.DEBUG === '1') console.log('== raw response\n' + JSON.stringify(reply, null, 2));

  if (reply.code !== 0) throw new Error(`${reply.code} ${reply.msg}`);
  const data = reply.data;
  // Every documented success carries non-empty data; anything else is unsigned and untrusted.
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
    throw new Error('Success response without signed data, do not trust it');
  }
  if (!reply.sign || !verify(platformPublicKey, canonical(data), reply.sign)) {
    throw new Error('Platform signature missing or invalid, do not trust data');
  }
  // The data must answer this request, not a replayed response for another one.
  if (data.nonceStr !== body.nonceStr) throw new Error('Response nonceStr does not match request');
  for (const key of ['mchOrderNo', 'payoutOrderId']) {
    if (business[key] && data[key] !== business[key]) throw new Error(`Response ${key} ${data[key]} does not match request ${business[key]}`);
  }
  console.log('== platform signature: OK');
  if (env.DEBUG === '1') console.log('== data\n' + JSON.stringify(data, null, 2));
  return data;
}
