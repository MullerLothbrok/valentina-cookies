import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialState,createOrder} from '../lib/shop.js';
import {emptyOrder} from '../order.js';
test('new orders require explicit privacy consent and record its version and time',()=>{
 const state=initialState(), order=emptyOrder(); order.cart.galleta=1;
 const input={key:randomUUID(),customer:'Ana',city:'Encarnación',prices:{galleta:9000},order};
 assert.throws(()=>createOrder(state,input,'test'),/privacidad/i);
 assert.equal(Object.keys(state.orders).length,0);
 input.privacyAccepted=true;
 createOrder(state,input,'test',1794931200000);
 assert.deepEqual(state.orders[input.key].privacy,{version:'2026-11-17',acceptedAt:1794931200000});
});
