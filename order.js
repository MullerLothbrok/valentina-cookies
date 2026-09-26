export const CATALOG = Object.freeze({
  galleta: { name: 'Galleta individual', price: 9000 },
  caja3: { name: '3 cookies rellenas', price: 45000 },
  amistad: { name: 'Cajita de la amistad', price: 0 },
  mini: { name: 'Mini cookies para compartir', price: 50000 },
  rellena: { name: 'Cookie rellena', price: 15000 },
  alfajor: { name: 'Cookies & alfajor', price: 30000 },
  especial: { name: 'Pedidos especiales', price: 0 },
});
export const OCCASIONS = ['Para mí', 'Regalo', 'Cumpleaños o evento', 'Empresa o marca'];
export const INTERESTS = ['Cookies rellenas', 'Cookies decoradas', 'Mini cookies', 'Postres', 'Surtido sorpresa', 'Rolls de canela', 'Cookie cup'];
export const money = n => new Intl.NumberFormat('es-PY').format(n);
export function emptyOrder() {
  return { cart: {}, builder: { active: false, occasion: 'Para mí', products: [], qty: '3 unidades', customQty: '', note: '' } };
}
// Only known product IDs and bounded integer quantities survive restoration.
// Names and prices always come from the current catalog, never browser storage.
export function restoreOrder(raw) {
  const order = emptyOrder();
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return order;
    for (const id of Object.keys(CATALOG)) {
      const qty = data.cart?.[id];
      if (Number.isSafeInteger(qty) && qty > 0 && qty <= 9999) order.cart[id] = qty;
    }
    const b = data.builder;
    if (b && typeof b === 'object') {
      order.builder.active = b.active === true;
      if (OCCASIONS.includes(b.occasion)) order.builder.occasion = b.occasion;
      order.builder.products = INTERESTS.filter(p => Array.isArray(b.products) && b.products.includes(p));
      if (['3 unidades', '6 unidades', '12 unidades', 'Otra cantidad'].includes(b.qty)) order.builder.qty = b.qty;
      if (typeof b.customQty === 'string' && /^\d{0,4}$/.test(b.customQty)) order.builder.customQty = b.customQty;
      if (typeof b.note === 'string') order.builder.note = b.note.slice(0, 1500);
    }
  } catch { /* Corrupt or missing storage starts an empty, usable order. */ }
  return order;
}
export function totals(order) {
  const entries = Object.entries(order.cart).filter(([id]) => Object.hasOwn(CATALOG, id));
  const count = entries.reduce((n, [, qty]) => n + qty, 0);
  const total = entries.reduce((n, [id, qty]) => n + CATALOG[id].price * qty, 0);
  const quote = entries.some(([id]) => CATALOG[id].price === 0) || order.builder.active;
  return { count, total, label: total ? `Gs. ${money(total)}${quote ? ' + a consultar' : ''}` : quote ? 'A consultar' : 'Gs. 0' };
}
export function builderError(builder) {
  if (builder.active && builder.qty === 'Otra cantidad' && !/^[1-9]\d{0,3}$/.test(builder.customQty)) {
    return 'Indicá una cantidad entera entre 1 y 9999 unidades en tu idea para el pedido.';
  }
  return '';
}
export function builderLines(b) {
  const qty = b.qty === 'Otra cantidad' ? (b.customQty ? `${b.customQty} unidades` : 'Cantidad pendiente de completar') : b.qty;
  return [
    `Ocasión: ${b.occasion}`,
    `Me gustaría incluir: ${b.products.length ? b.products.join(', ') : 'Quiero que me recomienden'}`,
    `Cantidad orientativa para el box: ${qty}`,
    ...(b.note.trim() ? [`Idea / dedicatoria: ${b.note.trim()}`] : []),
  ];
}
export function buildMessage(order) {
  const error = builderError(order.builder);
  if (error) throw new Error(error);
  const lines = ['Hola Valentina 🍪', ''];
  const entries = Object.entries(order.cart);
  if (entries.length) {
    lines.push('Productos del catálogo:');
    for (const [id, qty] of entries) {
      const product = CATALOG[id];
      lines.push(`• ${qty} × ${product.name} — ${product.price ? `Gs. ${money(qty * product.price)}` : 'a consultar'}`);
    }
    const total = totals(order).total;
    if (total) lines.push('', `Total conocido: Gs. ${money(total)}`);
  }
  if (order.builder.active) {
    lines.push('', 'Mi idea para este pedido (a coordinar con los productos elegidos):', ...builderLines(order.builder).map(s => `• ${s}`));
  }
  if (!entries.length && !order.builder.active) lines.push('Quiero hacer un pedido. ¿Me pasás las opciones disponibles?');
  else lines.push('', '¿Me confirmás disponibilidad, precio final y envío?');
  return lines.join('\n');
}
