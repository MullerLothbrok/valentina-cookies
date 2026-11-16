import { randomUUID } from 'node:crypto';
import { productCategory } from './categories.js';
import { CATALOG, builderError, buildMessage, restoreOrder } from '../order.js';

export class ShopError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function check(condition, status, message) {
  if (!condition) throw new ShopError(status, message);
}
export const initialState = () => ({ products: structuredClone(CATALOG), orders: {} });
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export const isId = id => typeof id === 'string' && uuid.test(id);
const seedPhotos = new Set(Object.values(CATALOG).flatMap(p => p.photos));
function field(value, limit, required = true) {
  check(typeof value === 'string' && value.trim().length <= limit && (!required || value.trim()), 400, 'Revisá los campos del formulario.');
  return value.trim();
}

export function changeProduct(state, input, remove = false) {
  const id = input.id;
  const previous = Object.hasOwn(state.products, id) ? state.products[id] : undefined;
  check(previous || (isId(id) && !remove && input.version === null), 409, 'El producto cambió o fue eliminado. Actualizá el panel.');
  check(!previous || previous.version === input.version, 409, 'Otra edición cambió este producto. Actualizá el panel.');
  if (remove) { delete state.products[id]; return; }
  const placement = productCategory(state, { categoryId: previous?.categoryId, groupId: previous?.groupId, ...input });
  const { photos, price, stock, available } = input;
  check(Number.isSafeInteger(price) && price >= 0 && price <= 999999999, 400, 'Revisá el precio.');
  check(stock === null || (Number.isSafeInteger(stock) && stock >= 0 && stock <= 999999), 400, 'Revisá las unidades disponibles.');
  check(typeof available === 'boolean' && Array.isArray(photos) && photos.length <= 6 &&
    photos.every(p => seedPhotos.has(p) || (typeof p === 'string' && p.startsWith('/api/photo?id=') && isId(p.slice(14)))), 400, 'Revisá las fotos del producto.');
  state.products[id] = { name: field(input.name, 100), description: field(input.description, 600, false),
    ...placement, price, stock, available, photos: [...new Set(photos)], version: (previous?.version ?? 0) + 1 };
}

export function createOrder(state, input, source, now = Date.now()) {
  check(isId(input.key), 400, 'Volvé a abrir tu pedido.');
  const existing = state.orders[input.key];
  if (existing) return { reference: existing.reference, message: existing.message };
  const customer = field(input.customer, 80);
  const city = field(input.city, 100);
  const cart = input.order?.cart;
  check(cart && typeof cart === 'object' && !Array.isArray(cart) && Object.keys(cart).length <= 100, 400, 'Revisá el carrito.');
  const lines = Object.entries(cart).map(([id, qty]) => {
    const p = Object.hasOwn(state.products, id) && state.products[id];
    check(Number.isSafeInteger(qty) && qty > 0 && qty <= 9999, 400, 'Revisá las cantidades.');
    check(p?.available && (p.stock === null || p.stock >= qty), 409, 'Cambió la disponibilidad. Revisá tu carrito.');
    check(input.prices?.[id] === p.price, 409, 'Cambió un precio. Revisá el catálogo antes de continuar.');
    return { id, name: p.name, qty, price: p.price };
  });
  const order = restoreOrder(JSON.stringify(input.order), state.products);
  check(lines.length || order.builder.active, 400, 'Agregá un producto o prepará una idea de box.');
  check(!builderError(order.builder), 400, builderError(order.builder));
  const recent = Object.values(state.orders).filter(o => now - o.created < 600000);
  check(recent.length < 150 && recent.filter(o => o.source === source).length < 12, 429, 'Esperá unos minutos antes de registrar otro pedido.');
  const reference = randomUUID().slice(0, 8).toUpperCase();
  const message = [buildMessage(order, state.products), '', 'Pedido ' + reference, customer + ' · ' + city].join('\n');
  state.orders[input.key] = { reference, customer, city, lines, message, status: 'pendiente', created: now, source };
  return { reference, message };
}

export function changeStatus(state, id, status) {
  const o = isId(id) && state.orders[id];
  check(o, 404, 'Pedido no encontrado.');
  if (status === o.status) return;
  const transitions = { pendiente: ['confirmado', 'cancelado'], confirmado: ['enviado', 'cancelado'] };
  check(transitions[o.status]?.includes(status), 409, 'Ese cambio de estado ya no corresponde.');
  if (status === 'confirmado') {
    for (const { id, qty, name } of o.lines) {
      const p = state.products[id];
      check(p?.available && (p.stock === null || p.stock >= qty), 409, 'Revisá el stock de ' + name + ' antes de confirmar.');
    }
    o.deducted = [];
    for (const { id, qty } of o.lines) {
      const p = state.products[id];
      if (p.stock !== null) { p.stock -= qty; p.version++; o.deducted.push({ id, qty }); }
    }
  }
  if (status === 'cancelado' && o.status === 'confirmado') {
    for (const { id, qty } of o.deducted) {
      const p = state.products[id];
      if (p && p.stock !== null) { p.stock += qty; p.version++; }
    }
  }
  o.status = status;
}
