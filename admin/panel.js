import { previewCatalog, previewProduct } from './preview.js';
import { request, node } from '../shop-client.js';
import { loadPageEditor, resetPageEditor } from './sections.js';
import { loadCategories, selectCategory, setCategoryProducts } from './categories.js';
import { money } from '../order.js';

const $ = id => document.getElementById(id);
const edit = $('edit').elements;
let data, draft;
function note(message) {
  $('notice').textContent = message; $('notice').hidden = !message;
}
function showLogin() {
  document.body.classList.remove('content-editing');
  resetPageEditor();
  data = null; $('dashboard').hidden = true; $('login').hidden = false;
  $('productList').replaceChildren(); $('orderList').replaceChildren();
}
async function reload() {
  try {
    data = await request(null, '?view=admin');
    $('login').hidden = true; $('dashboard').hidden = false;
    previewCatalog(data);
    setCategoryProducts(data.products); loadCategories(data.categories, reload, note, placement => { tab('products'); openEditor(undefined, false, placement); }); renderProducts(); renderOrders(); loadPageEditor(data.page, data.originalSections);
  } catch (error) {
    if (error.status === 401) showLogin();
    throw error;
  }
}
function action(label, fn, style) {
  const button = node('button', label, style);
  button.type = 'button';
  button.onclick = async () => {
    button.disabled = true;
    try { await fn(); } catch (e) { note(e.message); } finally { button.disabled = false; }
  };
  return button;
}
function renderProducts() {
  const list = $('productList'); list.replaceChildren();
  const selected = $('productFilter').value;
  $('productFilter').replaceChildren(new Option('Todas', ''), new Option('Sin categoría', 'none'));
  for (const [id, c] of Object.entries(data.categories)) $('productFilter').add(new Option(c.name, id));
  $('productFilter').value = selected;
  const filter = $('productFilter').value;

  for (const [id, p] of Object.entries(data.products)) {
    if (filter && (p.categoryId || 'none') !== filter) continue;
    const row = node('article', null, 'row');
    if (p.photos[0]) {
      const image = node('img'); image.src = new URL(p.photos[0], location.origin); image.alt = ''; row.append(image);
    }
    const info = node('div', null, 'info');
    const stock = !p.available || p.stock === 0 ? 'Agotado' : p.stock == null ? 'Por encargo' : p.stock + ' disponibles';
    info.append(node('h3', p.name), node('p', (p.price ? 'Gs. ' + money(p.price) : 'A consultar') + ' · ' + stock, 'muted'));
    const category = data.categories[p.categoryId];
    if (category) info.append(node('small', category.name + (category.groups[p.groupId] ? ' · ' + category.groups[p.groupId].name : '')));
    row.append(info, action('Editar', () => openEditor(id), 'secondary'), action('Duplicar', () => openEditor(id, true), 'secondary')); list.append(row);
  }
  if (!list.children.length) list.append(node('p', 'Todavía no hay productos.'));
}
function renderOrders() {
  const list = $('orderList'); list.replaceChildren();
  for (const o of data.orders.filter(o => !$('filter').value || $('filter').value === o.status)) {
    const card = node('article', null, 'card');
    card.append(node('h3', o.customer + ' · ' + o.city), node('p', '#' + o.reference + ' · ' + o.status + ' · ' + new Date(o.created).toLocaleString('es-PY'), 'muted'));
    const detail = node('details');
    detail.append(node('summary', 'Detalle del pedido'), node('pre', o.message)); card.append(detail);
    const controls = node('div', null, 'actions');
    const next = o.status === 'pendiente' ? ['confirmado','cancelado'] : o.status === 'confirmado' ? ['enviado','cancelado'] : [];
    const labels = { confirmado: 'Confirmar y descontar stock', cancelado: 'Cancelar pedido', enviado: 'Marcar enviado' };
    for (const status of next) controls.append(action(labels[status], async () => {
      if (status === 'cancelado' && !confirm('¿Cancelar el pedido #' + o.reference + '?')) return;
      await request({ action:'status', id:o.id, status }); await reload(); note('Pedido actualizado.');
    }, status === 'cancelado' ? 'secondary' : ''));
    card.append(controls); list.append(card);
  }
  if (!list.children.length) list.append(node('p', 'No hay pedidos para mostrar.'));
}
function openEditor(id, duplicate = false, placement = {}) {
  const p = id ? data.products[id] : { name:'', description:'', price:0, stock:null, available:true, photos:[], version:null, ...placement };
  draft = { ...structuredClone(p), id:duplicate ? crypto.randomUUID() : id || crypto.randomUUID() };
  if (duplicate) { draft.version = null; draft.name = p.name + ' · nueva presentación'; }
  edit.title.value = draft.name; edit.description.value = p.description; edit.price.value = p.price;
  edit.stock.value = p.stock ?? ''; edit.available.checked = p.available; $('files').value = '';
  $('editError').textContent = ''; $('editTitle').textContent = duplicate ? 'Nueva presentación' : id ? 'Editar producto' : 'Agregar producto';
  selectCategory(edit.category, edit.priceGroup, edit.price, p);
  $('delete').hidden = !id || duplicate;
  $('productPreviewPanel').open = true; drawPhotos(); $('editor').showModal();
}
function drawPhotos() {
  updateProductPreview();
  const area = $('photos'); area.replaceChildren();
  draft.photos.forEach((photo, i) => {
    const box = node('div'); const img = node('img');
    img.src = photo.startsWith('data:') ? photo : new URL(photo, location.origin); img.alt = 'Foto ' + (i + 1);
    box.append(img, action('Quitar', () => { draft.photos.splice(i, 1); drawPhotos(); }, 'secondary')); area.append(box);
  });
}
async function resize(file) {
  const img = new Image(); const url = URL.createObjectURL(file);
  try {
    img.src = url; await img.decode();
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .84);
  } finally { URL.revokeObjectURL(url); }
}
$('files').onchange = async () => {
  const files = [...$('files').files];
  $('editError').textContent = '';
  $('save').disabled = true;
  try {
    if (draft.photos.length + files.length > 6) throw Error('Elegí hasta seis fotos en total.');
    const photos = [];
    for (const file of files) photos.push(await resize(file));
    draft.photos.push(...photos); drawPhotos();
  } catch (e) { $('editError').textContent = e.message || 'No pudimos abrir esa foto.'; }
  finally { $('files').value = ''; $('save').disabled = false; }
};
async function save(remove) {
  $('save').disabled = true; $('delete').disabled = true; $('close').disabled = true; $('files').disabled = true;
  try {
    if (!remove) {
      Object.assign(draft, { name:edit.title.value, description:edit.description.value, price:Number(edit.price.value),
        categoryId:edit.category.value, groupId:edit.priceGroup.value, stock:edit.stock.value === '' ? null : Number(edit.stock.value), available:edit.available.checked });
      for (let i = 0; i < draft.photos.length; i++) {
        const src = draft.photos[i];
        if (src.startsWith('data:')) draft.photos[i] = (await request({action:'upload', image:src.split(',')[1]})).photo;
      }
    }
    await request({ action:remove ? 'delete' : 'product', product:draft });
    $('editor').close(); await reload(); note(remove ? 'Producto eliminado.' : 'Producto guardado.');
  } catch (e) {
    $('editError').textContent = e.message;
    if (!$('editor').open) note(e.message);
    if (e.status === 409) await reload().catch(err => note(err.message));
  } finally { $('save').disabled = false; $('delete').disabled = false; $('close').disabled = false; $('files').disabled = false; }
}
$('edit').onsubmit = e => { e.preventDefault(); save(false); };
$('delete').onclick = () => { if (confirm('¿Eliminar ' + draft.name + ' del catálogo?')) save(true); };
$('add').onclick = () => openEditor(); $('close').onclick = () => $('editor').close();
$('login').onsubmit = async e => {
  e.preventDefault();
  try { await request({action:'login',password:$('login').elements.password.value}); $('login').reset(); await reload(); note(''); }
  catch (err) { note(err.message); }
};
$('logout').onclick = async () => { try { await request({action:'logout'}); showLogin(); note(''); } catch(e) { note(e.message); } };
$('productFilter').onchange = renderProducts;
$('filter').onchange = renderOrders; $('refresh').onclick = () => reload().then(() => note('Lista actualizada.')).catch(e => note(e.message));
function tab(active) {
  document.body.classList.toggle('content-editing', active === 'content');
  for (const name of ['orders','products','content','categories']) {
    $(name).hidden = name !== active;
    $(name + 'Tab').setAttribute('aria-pressed', String(name === active));
  }
  if (active !== 'products') reload().catch(e => note(e.message));
}
for (const name of ['orders','products','content','categories']) $(name + 'Tab').onclick = () => tab(name);
reload().catch(e => { showLogin(); if (e.status !== 401) note(e.message); });

function updateProductPreview() {
  if (!draft) return;
  previewProduct({...draft, name:edit.title.value, description:edit.description.value, price:Number(edit.price.value),
    stock:edit.stock.value === '' ? null : Number(edit.stock.value), available:edit.available.checked,
    categoryId:edit.category.value, groupId:edit.priceGroup.value});
}
$('edit').addEventListener('input', updateProductPreview);
$('edit').addEventListener('change', updateProductPreview);
