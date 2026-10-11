export type Order = { payoutOrderId: string; mchOrderNo: string; status: string; failReason?: string };

// Only the identifiers and status are printed; payee details stay out of logs (DEBUG=1 shows all).
export function printOrder(order: Order): void {
  console.log(`order ${order.mchOrderNo} (${order.payoutOrderId}): ${order.status}${order.failReason ? ` ${order.failReason}` : ''}`);
}
