import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, emptyOrder, restoreOrder, totals, buildMessage, builderError } from '../order.js';
import { readFileSync, existsSync } from 'node:fs';

test('mixed order keeps known subtotal and labels unpriced products', () => {
  const order = emptyOrder(); order.cart = { galleta: 2, amistad: 1 };
  assert.deepEqual(totals(order), { count: 3, total: 18000, label: 'Gs. 18.000 + a consultar' });
  assert.match(buildMessage(order), /2 × Galleta individual — Gs. 18.000/);
  assert.match(buildMessage(order), /1 × Cajita de la amistad — a consultar/);
});
test('quote-only orders never present a zero price', () => {
  const order = emptyOrder(); order.cart = { especial: 1 };
  assert.equal(totals(order).label, 'A consultar');
  assert.doesNotMatch(buildMessage(order), /Gs. 0/);
});
test('catalog and personalized idea share one encoded WhatsApp message', () => {
  const order = emptyOrder(); order.cart = { caja3: 2 };
  order.builder = { active: true, occasion: 'Regalo', products: ['Rolls de canela'], qty: 'Otra cantidad', customQty: '24', note: '¡Feliz cumple! & chocolate 🍪' };
  const restored = restoreOrder(JSON.stringify(order));
  assert.deepEqual(restored, order);
  const text = buildMessage(restored);
  assert.match(text, /2 × 3 cookies rellenas/); assert.match(text, /Gs. 90.000/);
  assert.match(text, /24 unidades/); assert.match(text, /Rolls de canela/);
  assert.match(text, /¡Feliz cumple! & chocolate 🍪/);
  const url = new URL(`https://wa.me/595994793372?text=${encodeURIComponent(text)}`);
  assert.equal(url.searchParams.get('text'), text);
});
test('missing, fractional and zero custom quantities cannot be sent', () => {
  for (const customQty of ['', '0', '-2', '1.5', '10000', 'NaN']) {
    const order = emptyOrder(); Object.assign(order.builder, { active: true, qty: 'Otra cantidad', customQty });
    assert.ok(builderError(order.builder)); assert.throws(() => buildMessage(order));
  }
});
test('restoration tolerates corruption and discards injected products, quantities and prices', () => {
  for (const raw of [null, '{broken', 'null', '42']) assert.deepEqual(restoreOrder(raw), emptyOrder());
  const order = restoreOrder(JSON.stringify({ cart: { galleta: 2, caja3: -1, rellena: 1.5, mini: 100000, malicious: 1 }, price: 1, builder: { active: true, occasion: 'Invalid', products: ['Cookie cup', '<script>'], qty: '999', note: 'A'.repeat(2000) } }));
  assert.deepEqual(order.cart, { galleta: 2 }); assert.equal(totals(order).total, 18000);
  assert.deepEqual(order.builder.products, ['Cookie cup']); assert.equal(order.builder.note.length, 1500);
});
test('default builder is not silently added to a catalog order', () => {
  const order = emptyOrder(); order.cart = { rellena: 1 };
  assert.doesNotMatch(buildMessage(order), /Ocasión|3 unidades|Mi idea/);
});
test('published markup and assets agree with catalog and contain no duplicate photos', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/data-product="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(ids.sort(), Object.keys(CATALOG).sort());
  const images = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(images).size, images.length);
  for (const path of [...images, ...[...html.matchAll(/data-full="([^"]+)"/g)].map(m => m[1])]) assert.ok(existsSync(new URL('../' + path, import.meta.url)), path);
  for (const name of ['valor de cada consulta', 'CATÁLOGO BASE', 'ROLL LOVE', 'onclick=', 'glasé', 'data-product="paleta"']) assert.ok(!html.includes(name), name);
  assert.match(html, /id="customQty"/); assert.match(html, /<\/form>/);
});
test('removed glasé product cannot return from an old saved order', () => {
  assert.deepEqual(restoreOrder(JSON.stringify({cart:{paleta:3,galleta:1}})).cart, {galleta:1});
});
