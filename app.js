import { emptyOrder, restoreOrder, totals, money, builderError, builderLines } from './order.js';
import { request } from './shop-client.js';
import { drawCatalog } from './catalog.js';

const STORAGE = 'valentina-order-v1';
const $ = id => document.getElementById(id);
let order = emptyOrder();
let catalog = {};
let loaded = false;
let checkout = null;
try { checkout = JSON.parse(sessionStorage.getItem('valentina-checkout')); } catch {}
function rememberCheckout(value) {
  checkout = value;
  try { sessionStorage.setItem('valentina-checkout', JSON.stringify(value)); } catch {}
}
function capacity(id) {
  const product = catalog[id];
  return product?.available ? Math.min(9999, product.stock ?? 9999) : 0;
}
async function loadCatalog() {
  const notice = $('catalogNotice');
  try {
    const data = await request();
    catalog = data.products;
    if (!loaded) {
      try { order = restoreOrder(localStorage.getItem(STORAGE), catalog); } catch {}
    }
    for (const id of Object.keys(order.cart)) {
      if (!capacity(id)) delete order.cart[id];
      else order.cart[id] = Math.min(capacity(id), order.cart[id]);
    }
    drawCatalog(catalog);
    loaded = true; notice.hidden = true;
    restoreForm(); render();
  } catch {
    loaded = false;
    notice.hidden = false; notice.textContent = 'No pudimos cargar el catálogo. Actualizá la página o consultá por WhatsApp.';
    document.querySelector('.catalog-list').replaceChildren();
  }
}
let modal = null;
let returnFocus = null;
let inertElements = [];
const form = $('builderForm');

function persist() {
  if (!loaded) return;
  try { localStorage.setItem(STORAGE, JSON.stringify(order)); } catch { /* Ordering also works without storage. */ }
}
function render() {
  const container = $('cartItems');
  container.replaceChildren();
  for (const [id, qty] of Object.entries(order.cart)) {
    const product = catalog[id];
    const row = document.createElement('div'); row.className = 'cart-row';
    const description = document.createElement('div');
    const name = document.createElement('b'); name.textContent = product.name;
    const price = document.createElement('small'); price.textContent = product.price ? `Gs. ${money(product.price)} c/u` : 'Precio a consultar';
    description.append(name, price);
    const controls = document.createElement('div'); controls.className = 'qty';
    const quantity = document.createElement('strong'); quantity.textContent = qty;
    for (const delta of [-1, 1]) {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = delta < 0 ? '−' : '+';
      button.setAttribute('aria-label', `${delta < 0 ? 'Quitar una unidad de' : 'Agregar una unidad de'} ${product.name}`);
      button.dataset.quantity = id; button.dataset.delta = delta;
      if (delta === 1 && qty >= capacity(id)) button.disabled = true;
      controls.append(button);
      if (delta === -1) controls.append(quantity);
    }
    row.append(description, controls); container.append(row);
  }
  if (!Object.keys(order.cart).length) {
    const message = document.createElement('p'); message.className = 'empty';
    message.textContent = order.builder.active ? 'Tu idea está lista para consultar. También podés agregar productos del catálogo.' : 'Todavía no agregaste nada. Elegí productos del catálogo o contanos tu idea.';
    container.append(message);
  }
  const sum = totals(order, catalog);
  $('count').textContent = sum.count; $('mobileCount').textContent = sum.count;
  $('total').textContent = sum.total ? `Gs. ${money(sum.total)}` : sum.label;
  $('mobileTotal').textContent = sum.label;
  $('builderSummary').hidden = !order.builder.active;
  $('builderDetails').textContent = order.builder.active ? builderLines(order.builder).join('\n') : '';
  $('cartStatus').textContent = `${sum.count} artículos. ${sum.label}${order.builder.active ? '. Incluye tu idea para el pedido.' : ''}`;
  persist();
}
function setMenu(open) {
  $('mainNav').classList.toggle('open', open);
  document.querySelector('.menu-toggle').setAttribute('aria-expanded', String(open));
}
function openDialog(id) {
  if (modal) closeDialog(false);
  setMenu(false);
  returnFocus = document.activeElement;
  modal = $(id); modal.hidden = false; modal.classList.add('open');
  document.body.classList.add('no-scroll');
  inertElements = Array.from(document.body.children).filter(el => el !== modal && !el.inert && !['SCRIPT', 'NOSCRIPT'].includes(el.tagName));
  inertElements.forEach(el => { el.inert = true; });
  modal.querySelector('[data-close-dialog]').focus();
}
function closeDialog(restoreFocus = true) {
  if (!modal) return;
  modal.hidden = true; modal.classList.remove('open'); modal = null;
  inertElements.forEach(el => { el.inert = false; }); inertElements = [];
  document.body.classList.remove('no-scroll');
  if (restoreFocus && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
}
function syncQuantity() {
  const custom = form.elements.qtybox.value === 'Otra cantidad';
  $('customQuantity').hidden = !custom;
  $('customQty').disabled = !custom; $('customQty').required = custom;
}
function restoreForm() {
  const b = order.builder;
  form.elements.occasion.value = b.occasion; form.elements.qtybox.value = b.qty;
  form.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = b.products.includes(input.value); });
  $('customQty').value = b.customQty; $('builderNote').value = b.note; syncQuantity();
}
function readBuilder() {
  order.builder = {
    active: true, occasion: form.elements.occasion.value,
    products: Array.from(form.querySelectorAll('input[type="checkbox"]:checked'), el => el.value),
    qty: form.elements.qtybox.value, customQty: $('customQty').value,
    note: $('builderNote').value.slice(0, 1500),
  };
  $('orderError').hidden = true;
  syncQuantity(); render();
}
function editBuilder() {
  closeDialog(false);
  form.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
  (builderError(order.builder) ? $('customQty') : $('builderNote')).focus({ preventScroll: true });
}

document.addEventListener('click', event => {
  const target = event.target.closest('button, a');
  if (event.target === modal) { closeDialog(); return; }
  if (!target) return;
  if (target.matches('.menu-toggle')) setMenu(target.getAttribute('aria-expanded') !== 'true');
  if (target.closest('#mainNav') && target.matches('a')) setMenu(false);
  if (target.hasAttribute('data-open-cart')) openDialog('drawer');
  if (target.hasAttribute('data-close-dialog')) closeDialog();
  if (target.dataset.product && capacity(target.dataset.product) > 0) {
    const id = target.dataset.product;
    order.cart[id] = Math.min(capacity(id), (order.cart[id] || 0) + 1); render(); openDialog('drawer');
  }
  if (target.dataset.quantity) {
    const id = target.dataset.quantity; const delta = Number(target.dataset.delta);
    const next = order.cart[id] + delta;
    if (next <= 0) delete order.cart[id]; else order.cart[id] = Math.min(capacity(id), next);
    render();
    // Re-rendering must not strand keyboard focus on the page behind the dialog.
    ($('cartItems').querySelector(`[data-quantity="${id}"][data-delta="${delta}"]`) || modal.querySelector('[data-close-dialog]')).focus();
  }
  if (target.dataset.interest) {
    const interest = target.dataset.interest;
    if (interest === 'Regalo') form.elements.occasion.value = 'Regalo';
    else form.querySelectorAll('input[type="checkbox"]').forEach(el => { if (el.value === interest) el.checked = true; });
    readBuilder();
  }
  if (target.dataset.full) {
    const image = target.querySelector('img');
    $('lightboxImg').src = target.dataset.full; $('lightboxImg').alt = image.alt;
    $('lightboxCaption').textContent = image.alt; openDialog('lightbox');
  }
});
form.addEventListener('input', readBuilder);
form.addEventListener('change', readBuilder);
form.addEventListener('submit', event => { event.preventDefault(); readBuilder(); if (form.reportValidity()) openDialog('drawer'); });
$('editBuilder').addEventListener('click', editBuilder);
$('clearBuilder').addEventListener('click', () => { order.builder = emptyOrder().builder; restoreForm(); render(); modal.querySelector('[data-close-dialog]').focus(); });
$('clearOrder').addEventListener('click', () => { rememberCheckout(null); order = emptyOrder(); restoreForm(); $('orderError').hidden = true; render(); });
$('sendOrder').addEventListener('click', async () => {
  const error = builderError(order.builder);
  if (error) { $('orderError').textContent = error; $('orderError').hidden = false; $('editBuilder').focus(); return; }
  const button = $('sendOrder');
  if (!Object.keys(order.cart).length && !order.builder.active) {
    location.assign('https://wa.me/595994793372'); return;
  }
  if (!$('customerName').reportValidity() || !$('deliveryCity').reportValidity()) return;
  const prices = Object.fromEntries(Object.keys(order.cart).map(id => [id, catalog[id].price]));
  const payload = { order, prices, customer: $('customerName').value.trim(), city: $('deliveryCity').value.trim() };
  const fingerprint = JSON.stringify(payload);
  if (checkout?.fingerprint !== fingerprint) rememberCheckout({ fingerprint, key: crypto.randomUUID() });
  button.disabled = true; $('orderError').hidden = true;
  try {
    const receipt = await request({ action: 'order', key: checkout.key, ...payload });
    location.assign('https://wa.me/595994793372?text=' + encodeURIComponent(receipt.message));
  } catch (e) {
    if (e.status === 409) await loadCatalog();
    $('orderError').hidden = false; $('orderError').textContent = e.message;
  } finally { button.disabled = false; }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (modal) closeDialog();
    else if ($('mainNav').classList.contains('open')) { setMenu(false); document.querySelector('.menu-toggle').focus(); }
  }
  if (event.key === 'Tab' && modal) {
    const focusable = Array.from(modal.querySelectorAll('button, a[href], input, textarea, [tabindex="0"]')).filter(el => !el.disabled && el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
document.addEventListener('click', event => { if (!event.target.closest('header')) setMenu(false); });
document.querySelectorAll('[data-product]').forEach(el => { el.disabled = true; });
await loadCatalog();
