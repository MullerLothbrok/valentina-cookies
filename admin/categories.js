import { request, node } from '../shop-client.js';
import { money } from '../order.js';

let categories = {};
export function loadCategories(value, reload, note, addProduct) {
  categories = value;
  const list = document.getElementById('categoryList');
  list.replaceChildren();
  async function send(action, item) {
    await request({action, item}); await reload(); note('Categorías y precios actualizados.');
  }
  function removeButton(label, action, item, question) {
    const button = node('button', label, 'secondary'); button.type = 'button';
    button.onclick = async () => {
      if (!confirm(question)) return;
      button.disabled = true;
      try { await send(action, {...item, remove:true}); } catch (e) { note(e.message); } finally { button.disabled = false; }
    };
    return button;
  }
  for (const [id, category] of Object.entries(categories)) {
    const card = node('section', null, 'card');
    card.append(node('h3', category.name));
    const form = namedForm('Nombre de categoría', category.name, 'Guardar nombre');
    form.onsubmit = event => submit(event, form, () => send('category', {id, version:category.version, name:form.elements.title.value}), note);
    card.append(form);
    for (const [groupId, group] of Object.entries(category.groups)) {
      const groupForm = priceForm(group.name, group.price, 'Guardar precio');
      groupForm.append(removeButton('Quitar grupo', 'priceGroup', {categoryId:id, id:groupId, version:group.version},
        '¿Quitar este grupo? Sus productos conservarán su precio y pasarán a tener precio individual.'));
      groupForm.onsubmit = event => submit(event, groupForm, () => send('priceGroup', {
        categoryId:id, id:groupId, version:group.version, name:groupForm.elements.title.value, price:Number(groupForm.elements.price.value)
      }), note);
      const count = Object.values(categoryProducts).filter(p => p.categoryId === id && p.groupId === groupId).length;
      groupForm.append(node('small', count + ' productos usan este precio.'));
      const add = node('button', 'Agregar presentación', 'secondary'); add.type = 'button';
      add.onclick = () => addProduct({categoryId:id, groupId});
      groupForm.append(add);
      card.append(groupForm);
    }
    const add = priceForm('', '', 'Agregar grupo de precio');
    add.onsubmit = event => submit(event, add, () => send('priceGroup', {
      categoryId:id, id:crypto.randomUUID(), version:null, name:add.elements.title.value, price:Number(add.elements.price.value)
    }), note);
    card.append(add, removeButton('Eliminar categoría', 'category', {id, version:category.version},
      '¿Eliminar esta categoría? Sus productos conservarán su precio y aparecerán como Sin categoría.'));
    list.append(card);
  }
  if (!list.children.length) list.append(node('p', 'Agregá una categoría para empezar a organizar tus productos.'));
  document.getElementById('addCategory').onclick = () => {
    const dialog = document.getElementById('categoryEditor');
    document.getElementById('categoryName').value = '';
    document.getElementById('categoryError').textContent = '';
    dialog.showModal();
  };
  document.getElementById('closeCategory').onclick = () => document.getElementById('categoryEditor').close();
  const form = document.getElementById('categoryForm');
  form.onsubmit = event => submit(event, form, async () => {
    await send('category', {id:crypto.randomUUID(), version:null, name:document.getElementById('categoryName').value});
    document.getElementById('categoryEditor').close();
  }, message => { document.getElementById('categoryError').textContent = message; });
}
let categoryProducts = {};
export function setCategoryProducts(products) { categoryProducts = products; }
function namedForm(label, value, buttonText) {
  const form = node('form', null, 'category-form');
  const input = node('input'); input.name = 'title'; input.maxLength = 100; input.required = true; input.value = value;
  const wrapper = node('label', label); wrapper.append(input);
  const button = node('button', buttonText); form.append(wrapper, button);
  return form;
}
function priceForm(name, price, label) {
  const form = namedForm('Nombre del grupo', name, label);
  const field = node('label', 'Precio del grupo en guaraníes');
  const input = node('input'); input.name = 'price'; input.type = 'number'; input.min = 0; input.max = 999999999; input.step = 1; input.required = true; input.value = price;
  field.append(input); form.insertBefore(field, form.lastChild);
  return form;
}
async function submit(event, form, send, note) {
  event.preventDefault();
  const buttons = [...form.querySelectorAll('button')];
  buttons.forEach(b => { b.disabled = true; });
  try { await send(); } catch (e) { note(e.message); } finally { buttons.forEach(b => { b.disabled = false; }); }
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
  }
  groups(product.groupId || '');
  categorySelect.onchange = () => groups('');
  groupSelect.onchange = updatePrice;
}
