import { request, node } from '../shop-client.js';
import { money } from '../order.js';

const $ = id => document.getElementById(id);
let categories = {};
let catalogProducts = {};
let editing, refresh, announce, addPresentation;
let expanded = new Set();
let busy = false;
export function setCategoryProducts(products) { catalogProducts = products; }

function button(label, click, style = 'secondary') {
  const el = node('button', label, style);
  el.type = 'button';
  el.onclick = click;
  return el;
}
function openForm(categoryId, groupId, isPrice = false) {
  const category = categories[categoryId];
  const item = isPrice ? category?.groups[groupId] : category;
  editing = { categoryId, groupId, isPrice, version:item?.version ?? null };
  $('categoryHeading').textContent = isPrice ? (item ? 'Editar precio compartido' : 'Agregar precio compartido') : (item ? 'Editar categoría' : 'Agregar categoría');
  $('categoryLabel').textContent = isPrice ? 'Nombre del grupo' : 'Nombre de categoría';
  $('categoryName').placeholder = isPrice ? 'Ej. Cookies rellenas' : 'Ej. Cookies';
  $('categoryName').value = item?.name ?? '';
  $('categoryPriceField').hidden = !isPrice;
  $('categoryPrice').disabled = !isPrice;
  $('categoryPrice').value = isPrice ? (item?.price ?? '') : '';
  const count = Object.values(catalogProducts).filter(p => p.categoryId === categoryId && p.groupId === groupId).length;
  $('categoryHint').textContent = isPrice ? category.name + ' · ' + (item ? 'Al guardar, este precio se aplica a ' + count + (count === 1 ? ' producto.' : ' productos.') : 'Usá el mismo precio para varias presentaciones.') : '';
  $('categorySave').textContent = item ? 'Guardar cambios' : (isPrice ? 'Crear precio compartido' : 'Crear categoría');
  $('categoryDelete').hidden = !item;
  $('categoryDelete').textContent = isPrice ? 'Quitar precio compartido' : 'Eliminar categoría';
  $('categoryError').textContent = '';
  $('categoryEditor').showModal();
}
function categoryDirty() {
  const {categoryId, groupId, isPrice} = editing;
  const item = isPrice ? categories[categoryId]?.groups[groupId] : categories[categoryId];
  return $('categoryName').value !== (item?.name ?? '') ||
    (isPrice && $('categoryPrice').value !== String(item?.price ?? ''));
}
function closeForm() {
  if (!busy && (!categoryDirty() || confirm('¿Salir sin guardar estos cambios?'))) $('categoryEditor').close();
}
$('closeCategory').onclick = closeForm;
$('categoryEditor').oncancel = event => { event.preventDefault(); closeForm(); };
window.addEventListener('beforeunload', event => {
  if ($('categoryEditor').open && (busy || categoryDirty())) { event.preventDefault(); event.returnValue = ''; }
});
$('categoryForm').onsubmit = event => { event.preventDefault(); persist(false); };
$('categoryDelete').onclick = () => {
  const question = editing.isPrice ? '¿Quitar este precio compartido? Cada producto conservará su precio actual.' : '¿Eliminar esta categoría? Sus productos conservarán su precio y aparecerán en «Sin categoría».';
  if (confirm(question)) persist(true);
};
async function persist(remove) {
  if (busy) return;
  const {categoryId, groupId, isPrice, version} = editing;
  const id = (isPrice ? groupId : categoryId) || crypto.randomUUID();
  const item = {id, version, name:$('categoryName').value, remove};
  if (isPrice) Object.assign(item, {categoryId, price:Number($('categoryPrice').value)});
  busy = true; $('categoryFields').disabled = true;
  try {
    await request({action:isPrice ? 'priceGroup' : 'category', item});
    const parentId = isPrice ? categoryId : id;
    expanded.add(parentId);
    $('categoryEditor').close();
    await refresh();
    const target = $(isPrice && !remove ? 'group-edit-' + id : 'category-open-' + parentId) || $('addCategory');
    target.focus({preventScroll:true});
    target.scrollIntoView({block:'nearest'});
    announce(remove ? 'Cambio guardado.' : (isPrice ? 'Precio compartido guardado.' : 'Categoría guardada.'));
  } catch (e) {
    if ($('categoryEditor').open) $('categoryError').textContent = e.message;
    else announce(e.message);
  } finally { busy = false; $('categoryFields').disabled = false; }
}
export function loadCategories(value, reload, note, addProduct) {
  categories = value; refresh = reload; announce = note; addPresentation = addProduct;
  const list = $('categoryList');
  list.replaceChildren();
  for (const [id, category] of Object.entries(categories)) {
    const card = node('details', null, 'card category-card');
    const groups = Object.entries(category.groups);
    const summary = node('summary');
    summary.id = 'category-open-' + id;
    summary.append(node('strong', category.name), node('small', groups.length === 1 ? '1 precio compartido' : groups.length + ' precios compartidos'));
    card.open = expanded.has(id);
    card.ontoggle = () => {
      if (!card.isConnected) return;
      if (card.open) expanded.add(id); else expanded.delete(id);
    };
    const actions = node('div', null, 'actions');
    actions.append(button('Agregar precio compartido', () => openForm(id, null, true), ''), button('Editar categoría', () => openForm(id)));
    card.append(summary, actions);
    for (const [groupId, group] of groups) {
      const count = Object.values(catalogProducts).filter(p => p.categoryId === id && p.groupId === groupId).length;
      const row = node('div', null, 'price-row');
      const info = node('div', null, 'info');
      info.append(node('strong', group.name), node('small', (group.price ? 'Gs. ' + money(group.price) : 'A consultar') + ' · ' + count + (count === 1 ? ' producto' : ' productos')));
      const controls = node('div', null, 'actions');
      const edit = button('Editar precio', () => openForm(id, groupId, true));
      edit.id = 'group-edit-' + groupId;
      controls.append(button('Agregar presentación', () => addPresentation({categoryId:id, groupId})), edit);
      row.append(info, controls); card.append(row);
    }
    list.append(card);
  }
  if (!list.children.length) list.append(node('p', 'Agregá una categoría para empezar a organizar tus productos.'));
  $('addCategory').onclick = () => openForm();
}
export function selectCategory(categorySelect, groupSelect, priceInput, product) {
  categorySelect.replaceChildren(new Option('Sin categoría', ''));
  for (const [id, category] of Object.entries(categories)) categorySelect.add(new Option(category.name, id));
  categorySelect.value = product.categoryId || '';
  function groups(selected) {
    groupSelect.replaceChildren(new Option('Precio individual', ''));
    for (const [id, group] of Object.entries(categories[categorySelect.value]?.groups || {})) {
      groupSelect.add(new Option(group.name + ' · ' + (group.price ? 'Gs. ' + money(group.price) : 'A consultar'), id));
    }
    groupSelect.value = selected;
    groupSelect.disabled = !categorySelect.value;
    updatePrice();
  }
  function updatePrice() {
    const group = categories[categorySelect.value]?.groups[groupSelect.value];
    priceInput.readOnly = !!group;
    if (group) priceInput.value = group.price;
    document.getElementById('priceHint').textContent = group
      ? 'Precio compartido. Podés cambiarlo para todo el grupo en Categorías y precios.'
      : 'Escribí 0 para cotizar por WhatsApp.';
  }
  groups(product.groupId || '');
  categorySelect.onchange = () => groups('');
  groupSelect.onchange = updatePrice;
}
