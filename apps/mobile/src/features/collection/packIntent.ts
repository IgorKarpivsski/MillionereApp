/**
 * A paid pack opening must start inside the app (after the player confirmed the price).
 * The packs screen leaves a one-time ticket here; the opening screen only spends coins or
 * gems when the ticket in its link matches, so an outside link can't buy anything.
 */
let pending: { pack: string; pay: string; ticket: string } | null = null;

export function makePackTicket(pack: string, pay: string): string {
  const ticket = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  pending = { pack, pay, ticket };
  return ticket;
}

export function takePackTicket(pack: string, pay: string, ticket: string | undefined): boolean {
  const ok = !!pending && !!ticket && pending.ticket === ticket && pending.pack === pack && pending.pay === pay;
  if (ok) pending = null;
  return ok;
}
