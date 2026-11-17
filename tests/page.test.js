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
test('section photos survive older editors, reject invalid sources and restore defaults', () => {
  const state = {};
  const original = pageFor(state).sections.find(s => s.id === 'mundo');
  const photo = '/api/photo?id=' + randomUUID();
  const publish = s => publishPage(state, {version:pageFor(state).version, sections:[s]}).sections[0];
  assert.deepEqual(publish({...original, photos:{rolls:photo}}).photos, {rolls:photo});
  assert.deepEqual(publish(original).photos, {rolls:photo});
  assert.throws(() => publish({...original, photos:{other:photo}}), /foto/);
  assert.throws(() => publish({...original, photos:{rolls:'otra-url'}}), /foto/);
  assert.equal(publish({...original, photos:{}}).photos, undefined);
});
