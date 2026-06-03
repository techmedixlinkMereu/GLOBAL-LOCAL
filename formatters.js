// ─────────────────────────────────────────────────────────────────
// TechMedixLink · js/formatters.js
// Pure formatting utilities — no state, no DB, no side effects
// ─────────────────────────────────────────────────────────────────

export function fNum(n) {
  if (n == null) return '0';
  return Math.round(n).toLocaleString('en-US');   
}

export function tzs(n) {
  return 'TZS ' + fNum(n);
}

export function fDate(d) {
  if (!d) return '--';
  const dt = new Date(d);
  return isNaN(dt) ? '--' : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fDateTime(d) {
  if (!d) return '--';
  const dt = new Date(d);
  return isNaN(dt) ? '--' : dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function fEvent(t) {
  if (!t) return '--';
  return t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function fCountdown(secs) {
  if (secs <= 0) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

export function stockLabel(n) {
  if (!n || n <= 0) return 'Out of stock';
  if (n <= 2) return `Low stock (${n})`;
  return `${n} in stock`;
}

export function stockClass(n) {
  if (!n || n <= 0) return 'out-stock';
  if (n <= 2) return 'low-stock';
  return 'in-stock';
}

export function roleLabel(r) {
  return { buyer: 'Buyer', seller: 'Seller', both: 'Buyer & Seller', admin: 'Admin' }[r] || r;
}

export function roleIcon(r) {
  return { buyer: 'fa-cart-shopping', seller: 'fa-store', both: 'fa-arrows-left-right', admin: 'fa-shield-halved' }[r] || 'fa-user';
}

export function fStatus(statusList, s) {
  return statusList.find(x => x.val === s)?.label || (s ? s.replace(/_/g, ' ') : '--');
}

export function sBadge(s) {
  const map = {
    pending: 'b-wn', quoted: 'b-in', deposit_paid: 'b-ok', sourcing: 'b-in',
    shipped: 'b-in', in_transit: 'b-in', customs_clearance: 'b-wn',
    delivered: 'b-ok', installed: 'b-ok', completed: 'b-ok',
    cancelled: 'b-er', draft: 'b-mu'
  };
  return map[s] || 'b-mu';
}

export function stepCls(stepperStages, status, idx) {
  const order = stepperStages.map(s => s.val);
  const cur = order.indexOf(status);
  if (cur < 0) return idx === 0 ? 'cur' : '';
  if (idx < cur) return 'done';
  if (idx === cur) return 'cur';
  return '';
}
