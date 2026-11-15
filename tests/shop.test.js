import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initialState, changeProduct, createOrder, changeStatus } from '../lib/shop.js';
import { cookie, requireAdmin } from '../lib/session.js';
import { emptyOrder } from '../order.js';

function checkout(qty, key = randomUUID()) {
  const order = emptyOrder(); order.cart.galleta = qty;
  return { key, customer:'Ana', city:'Asunción', prices:{galleta:9000}, order };
}
test('product edits use the current version, accept photos and retain the order snapshot after removal', () => {
  const state = initialState(); const input = checkout(2);
  const receipt = createOrder(state, input, 'local');
  const product = { ...state.products.galleta, id:'galleta', price:12000, description:'Cambio', photos:['/api/photo?id=' + randomUUID()] };
  changeProduct(state,product);
  assert.equal(state.products.galleta.price,12000);
  assert.throws(() => changeProduct(state,product), /Otra edición/);
  assert.throws(() => createOrder(state,checkout(1),'local'), /precio/);
  changeProduct(state,{...state.products.galleta,id:'galleta'},true);
  assert.equal(state.products.galleta,undefined);
  assert.deepEqual(createOrder(state,input,'local'),receipt);
  assert.match(receipt.message,/18.000/);
  assert.equal(state.orders[input.key].lines[0].price,9000);
});
test('waiting for WhatsApp does not reserve stock, double confirmation and cancellation are idempotent', () => {
  const state = initialState(); state.products.galleta.stock = 2;
  const first = checkout(2), second = checkout(1);
  createOrder(state,first,'local'); createOrder(state,second,'local');
  assert.equal(state.products.galleta.stock,2);
  changeStatus(state,first.key,'confirmado'); changeStatus(state,first.key,'confirmado');
  assert.equal(state.products.galleta.stock,0);
  assert.throws(() => changeStatus(state,second.key,'confirmado'), /stock/);
  assert.equal(state.orders[second.key].status,'pendiente');
  changeStatus(state,first.key,'cancelado'); changeStatus(state,first.key,'cancelado');
  assert.equal(state.products.galleta.stock,2);
  changeStatus(state,second.key,'confirmado'); changeStatus(state,second.key,'enviado');
  assert.equal(state.products.galleta.stock,1);
});
test('product creation, availability, destination and quote-only boxes', () => {
  const state = initialState(), id = randomUUID();
  changeProduct(state,{...state.products.galleta,id,version:null,available:false});
  assert.equal(state.products[id].version,1);
  const p = checkout(1); p.order.cart = {[id]:1}; p.prices = {[id]:9000};
  assert.throws(() => createOrder(state,p,'local'), /disponibilidad/);
  p.order.cart = {}; p.order.builder.active = true; p.city = '';
  assert.throws(() => createOrder(state,p,'local'), /campos/);
  p.city = 'Encarnación';
  assert.match(createOrder(state,p,'local').message,/Mi idea/);
});
test('admin pages require valid signed cookies', () => {
  process.env.VALENTINA_ADMIN_PASSWORD = randomUUID();
  assert.throws(() => requireAdmin({headers:{}}),/Ingresá/);
  const session = cookie(true);
  assert.match(session,/HttpOnly; Secure; SameSite=Strict/);
  requireAdmin({headers:{cookie:session.split(';')[0]}});
  assert.throws(() => requireAdmin({headers:{cookie:session.split(';')[0] + 'x'}}),/Ingresá/);
});
