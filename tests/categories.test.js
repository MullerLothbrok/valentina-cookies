import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialState, changeProduct, createOrder} from '../lib/shop.js';
import {changeCategory, changePriceGroup, categoriesFor} from '../lib/categories.js';
import {emptyOrder} from '../order.js';

test('shared prices update all presentations and reject stale product and cart edits', () => {
  const state = initialState();
  const categoryId = randomUUID(), groupId = randomUUID();
  assert.deepEqual(categoriesFor(state), {});
  changeCategory(state, {id:categoryId, version:null, name:'Cookies'});
  changePriceGroup(state, {categoryId, id:groupId, version:null, name:'Rellenas', price:15000});
  for (const id of ['galleta','rellena']) {
    changeProduct(state, {...state.products[id], id, categoryId, groupId, price:15000});
  }
  const order = emptyOrder(); order.cart = {galleta:1};
  const input = {key:randomUUID(), privacyAccepted:true, customer:'Ana', city:'Encarnación', prices:{galleta:15000}, order};
  createOrder(state, input, 'test');
  const old = {...state.products.galleta, id:'galleta'};
  changePriceGroup(state, {categoryId, id:groupId, version:1, name:'Rellenas', price:18000});
  assert.equal(state.products.galleta.price,18000);
  assert.equal(state.products.rellena.price,18000);
  assert.equal(state.products.caja3.price,45000);
  assert.equal(state.orders[input.key].lines[0].price,15000);
  assert.throws(() => createOrder(state, {...input, key:randomUUID()}, 'test'), /precio/);
  assert.throws(() => changeProduct(state,old), /Otra edición/);
  assert.throws(() => changePriceGroup(state, {categoryId, id:groupId, version:1, name:'Viejo', price:10000}), /cambió/);
  changePriceGroup(state, {categoryId, id:groupId, version:2, remove:true});
  assert.equal(state.products.galleta.groupId,'');
  assert.equal(state.products.galleta.price,18000);
  changeCategory(state, {id:categoryId, version:1, remove:true});
  assert.equal(state.products.galleta.categoryId,'');
  assert.equal(state.products.galleta.price,18000);
  assert.equal(state.products.rellena.price,18000);
});
