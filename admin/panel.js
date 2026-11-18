import { preparePhoto, photoDataURL } from './photo-file.js';
import { previewCatalog, previewProduct } from './preview.js';
import { request, node } from '../shop-client.js';
import { loadPageEditor, resetPageEditor, pageEditing } from './sections.js';
import { loadCategories, selectCategory, setCategoryProducts } from './categories.js';
import { money } from '../order.js';

const $ = id => document.getElementById(id);
const edit = $('edit').elements;
let data, draft;
let productDirty = false, productBusy = false;
const searchText = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
function note(message) {
  $('notice').textContent = message; $('notice').hidden = !message;
}
function showLogin() {
  document.body.classList.remove('content-editing');
  $('logout').hidden = true; resetPageEditor();
  data = null; $('dashboard').hidden = true; $('login').hidden = false;
  $('productList').replaceChildren(); $('orderList').replaceChildren();
}
async function reload() {
  try {
    data = await request(null, '?view=admin');
    $('login').hidden = true; $('dashboard').hidden = false;
    $('logout').hidden = false; previewCatalog(data);
    setCategoryProducts(data.products); loadCategories(data.categories, reload, note, placement => { tab('products'); $('productFilter').value = placement.categoryId; $('productSearch').value = ''; renderProducts(); openEditor(undefined, false, placement); }); renderProducts(); renderOrders(); loadPageEditor(data.page, data.originalSections);
  } catch (error) {
    if (error.status === 401 && !pageEditing().dirty && !productDirty) showLogin();
    else if (error.status === 401) error.message = 'Tu sesión venció. Abrí el panel en otra pestaña, ingresá con tu clave y volvé aquí para guardar. Tus cambios siguen en esta pestaña.';
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

  const query = searchText($('productSearch').value);
  for (const [id, p] of Object.entries(data.products)) {
    if (query && !searchText(p.name).includes(query)) continue;
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
    const controls = node('div', null, 'row-actions');
    controls.append(action('Editar', () => openEditor(id)), action(p.photos.length ? 'Fotos' : 'Agregar foto', () => {
      openEditor(id);
      $('files').focus({preventScroll:true});
      $('photoArea').scrollIntoView({block:'nearest'});
    }, 'secondary'), action('Duplicar', () => openEditor(id, true), 'secondary'));
    row.append(info, controls); list.append(row);
  }
  if (!list.children.length) list.append(node('p', query || filter ? 'No hay productos que coincidan. Probá con otro nombre o categoría.' : 'Todavía no hay productos.'));
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
  productDirty = false;
  $('reloadProduct').hidden = true;
  $('photoStatus').textContent = '';
  const p = id ? data.products[id] : { name:'', description:'', price:0, stock:null, available:true, photos:[], version:null, ...placement };
  draft = { ...structuredClone(p), id:duplicate ? crypto.randomUUID() : id || crypto.randomUUID() };
  if (duplicate) { draft.version = null; draft.name = p.name + ' · nueva presentación'; }
  edit.title.value = draft.name; edit.description.value = p.description; edit.price.value = p.price;
  edit.stock.value = p.stock ?? ''; edit.available.checked = p.available; $('files').value = '';
  $('editError').textContent = ''; $('editTitle').textContent = duplicate || placement.groupId ? 'Nueva presentación' : id ? 'Editar producto' : 'Agregar producto';
  selectCategory(edit.category, edit.priceGroup, edit.price, p);
  $('delete').hidden = !id || duplicate;
  $('productPreviewPanel').open = false;
  drawPhotos(); $('editor').showModal(); document.querySelector('.editor-body').scrollTop = 0;
}
function drawPhotos() {
  updateProductPreview();
  const area = $('photos'); area.replaceChildren();
  syncPhotoCount();
  draft.photos.forEach((photo, i) => {
    const box = node('div'); const img = node('img');
    img.src = photo.startsWith('data:') ? photo : new URL(photo, location.origin); img.alt = 'Foto ' + (i + 1);
    box.append(img);
    if (i === 0) box.append(node('strong', 'Portada', 'cover-badge'));
    else box.append(action('Usar de portada', () => {
      draft.photos.unshift(...draft.photos.splice(i, 1)); productDirty = true; drawPhotos();
    }, 'secondary'));
    box.append(action('Quitar', () => {
      draft.photos.splice(i, 1); productDirty = true; drawPhotos();
    }, 'secondary'));
    area.append(box);
  });
}
function syncPhotoCount() {
  $('photoCount').textContent = draft.photos.length + ' de 6 fotos';
  $('files').disabled = draft.photos.length >= 6 || productBusy;
}
$('files').onchange = async () => {
  const files = [...$('files').files];
  $('editError').textContent = '';
  if (!files.length || productBusy) return;
  setProductBusy(true, 'Preparando fotos…');
  try {
    if (draft.photos.length + files.length > 6) throw Error('Podés tener hasta 6 fotos. Elegí menos o quitá una antes de continuar.');
    const photos = [];
    for (const [index, file] of files.entries()) {
      $('photoStatus').textContent = 'Preparando foto ' + (index + 1) + ' de ' + files.length + '…';
      try { photos.push(await photoDataURL(await preparePhoto(file))); }
      catch { throw Error('No pudimos abrir «' + file.name + '». Probá con una imagen JPG, PNG o WebP.'); }
    }
    draft.photos.push(...photos); productDirty = true; drawPhotos();
    $('photoStatus').textContent = 'Fotos listas. Tocá Guardar producto para publicarlas.';
  } catch (e) { $('photoStatus').textContent = e.message; }
  finally { $('files').value = ''; setProductBusy(false); }
};
function setProductBusy(busy, label = 'Guardar producto') {
  productBusy = busy; $('productFields').disabled = busy;
  $('save').disabled = busy; $('close').disabled = busy;
  $('reloadProduct').disabled = busy;
  $('save').textContent = label; syncPhotoCount();
}
async function save(remove) {
  if (productBusy) return;
  setProductBusy(true, remove ? 'Eliminando…' : 'Guardando…');
  $('editError').textContent = '';
  try {
    if (!remove) {
      Object.assign(draft, { name:edit.title.value, description:edit.description.value, price:Number(edit.price.value),
        categoryId:edit.category.value, groupId:edit.priceGroup.value, stock:edit.stock.value === '' ? null : Number(edit.stock.value), available:edit.available.checked });
      const uploads = draft.photos.filter(src => src.startsWith('data:')).length;
      let uploaded = 0;
      for (let i = 0; i < draft.photos.length; i++) {
        const src = draft.photos[i];
        if (src.startsWith('data:')) {
          $('save').textContent = 'Subiendo foto ' + (++uploaded) + ' de ' + uploads + '…';
          draft.photos[i] = (await request({action:'upload', image:src.split(',')[1]})).photo;
        }
      }
    }
    await request({ action:remove ? 'delete' : 'product', product:draft });
    productDirty = false; $('editor').close(); await reload(); note(remove ? 'Producto eliminado.' : 'Producto guardado.');
  } catch (e) {
    $('editError').textContent = e.message;
    if (e.status === 401) $('editError').textContent = 'Tu sesión venció. Ingresá al panel en otra pestaña y volvé aquí para guardar. Tus cambios siguen acá.';
    if (!$('editor').open) note(e.message);
    if (e.status === 409) { $('reloadProduct').hidden = false; await reload().catch(err => note(err.message)); }
  } finally { setProductBusy(false); }
}
$('edit').onsubmit = e => { e.preventDefault(); save(false); };
$('reloadProduct').onclick = async () => {
  if (!confirm('¿Descartar esta edición y abrir la última versión del producto?')) return;
  try {
    await reload();
    if (data.products[draft.id]) openEditor(draft.id);
    else { productDirty = false; $('editor').close(); note('Este producto fue eliminado en otra sesión.'); }
  } catch (e) { $('editError').textContent = e.message; }
};
$('delete').onclick = () => { if (confirm('¿Eliminar ' + draft.name + ' del catálogo?')) save(true); };
$('add').onclick = () => openEditor(undefined, false, {categoryId:data.categories[$('productFilter').value] ? $('productFilter').value : ''});
function closeProduct() {
  if (!productBusy && (!productDirty || confirm('¿Salir sin guardar los cambios del producto?'))) {
    productDirty = false; $('editor').close();
  }
}
$('close').onclick = closeProduct;
$('editor').oncancel = event => { event.preventDefault(); closeProduct(); };
window.addEventListener('beforeunload', event => {
  if ($('editor').open && (productDirty || productBusy)) { event.preventDefault(); event.returnValue = ''; }
});
$('login').onsubmit = async e => {
  e.preventDefault();
  try { await request({action:'login',password:$('login').elements.password.value}); $('login').reset(); await reload(); note(''); }
  catch (err) { note(err.message); }
};
$('logout').onclick = async () => {
  if (pageEditing().busy || productBusy) { note('Esperá a que termine de guardar antes de salir.'); return; }
  if ((pageEditing().dirty || productDirty) && !confirm('Hay cambios sin guardar o publicar. ¿Salir y descartarlos?')) return;
  try { await request({action:'logout'}); showLogin(); note(''); } catch(e) { note(e.message); }
};
$('productFilter').onchange = renderProducts;
$('productSearch').oninput = renderProducts;
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
$('edit').addEventListener('input', event => {
  if (event.target !== $('files')) { productDirty = true; updateProductPreview(); }
});
$('edit').addEventListener('change', updateProductPreview);
