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
test('colors are local to each section, versioned, validated and resettable', () => {
  const state = {};
  const existing = pageFor(state).sections.find(s => s.id === 'mundo');
  const custom = { id:randomUUID(), title:'Novedades', body:'Ediciones especiales', visible:true };
  const publish = items => publishPage(state, {version:pageFor(state).version,sections:items}).sections;
  const colors = { background:'#143526', text:'#ffffff' };
  const [first, second] = publish([{...existing, colors}, custom]);
  assert.deepEqual(first.colors, colors);
  assert.equal(second.colors, undefined);
  assert.deepEqual(publish([existing, {...custom, colors:{text:'#ffffff'}}])[0].colors, colors);
  for (const invalid of [[], null, {text:'red'}, {background:'url(x)'}, {other:'#000000'}]) {
    assert.throws(() => publish([{...existing, colors:invalid}]), /color/);
  }
  assert.deepEqual(publish([{...existing, colors:{}}, custom])[1].colors, {text:'#ffffff'});
  assert.equal(pageFor(state).sections[0].colors, undefined);
});
test('adding and moving sections preserves all other sections and their photos', () => {
  const state = {};
  const photo = '/api/photo?id=' + randomUUID();
  const originals = pageFor(state).sections.map(s => s.id === 'mundo'
    ? {...s, photos:{rolls:photo}, colors:{background:'#482917'}}
    : {...s, visible:s.id !== 'marca'});
  const first = publishPage(state, {version:0, sections:originals});
  const before = structuredClone(first.sections);
  const extra = title => ({id:randomUUID(), title, body:'', visible:true});
  const a = extra('Primer anuncio'), b = extra('Segundo anuncio');
  publishPage(state, {version:1, sections:[...first.sections, a, b]});
  const moved = publishPage(state, {version:2, sections:[b, ...first.sections, a]});
  assert.deepEqual(moved.sections.slice(1, -1), before);
  assert.deepEqual(moved.sections.map(s => s.id), [b.id, ...before.map(s => s.id), a.id]);
});
