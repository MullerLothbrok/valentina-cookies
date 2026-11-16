import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pageFor, publishPage } from '../lib/page.js';

test('existing stores retain the original layout until first publication', () => {
  const state = {products: {one: {stock: 2}}, orders: {}};
  const base = pageFor(state);
  assert.equal(base.version, 0);
  assert.ok(base.sections.some(s => s.id === 'catalogo'));
  const section = {id: randomUUID(), title: 'Novedades', body: '', visible: true};
  publishPage(state, {version: 0, sections: [section]});
  assert.deepEqual(state.products, {one: {stock: 2}});
  assert.throws(() => publishPage(state, {version: 0, sections: []}), /otra sesión/);
  assert.deepEqual(pageFor(state).sections, [section]);
  assert.throws(() => publishPage(state,{version:1,sections:[section,section]}), /repetidas/);
  assert.equal(pageFor(state).version, 1);
});
