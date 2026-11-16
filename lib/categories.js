import { check, isId } from './shop.js';

export function categoriesFor(state) {
  return state.categories ?? {};
}
function name(value) {
  check(typeof value === 'string' && value.trim() && value.length <= 100, 400, 'Ingresá un nombre de hasta 100 caracteres.');
  return value.trim();
}
function versioned(previous, input) {
  check(previous ? previous.version === input.version : isId(input.id) && input.version === null,
    409, 'La categoría o el grupo cambió. Actualizá el panel.');
}
export function changeCategory(state, input) {
  check(input && isId(input.id), 400, 'Revisá la categoría.');
  const categories = categoriesFor(state);
  const previous = categories[input.id];
  versioned(previous, input);
  if (input.remove) {
    check(previous, 404, 'Categoría no encontrada.');
    for (const p of Object.values(state.products)) {
      if (p.categoryId === input.id) {
        p.categoryId = ''; p.groupId = ''; p.version++;
      }
    }
    delete categories[input.id];
  } else {
    categories[input.id] = { name: name(input.name), version: (previous?.version ?? 0) + 1, groups: previous?.groups ?? {} };
  }
  state.categories = categories;
}
export function changePriceGroup(state, input) {
  const category = categoriesFor(state)[input?.categoryId];
  check(category && isId(input.id), 409, 'La categoría ya no existe. Actualizá el panel.');
  const previous = category.groups[input.id];
  versioned(previous, input);
  const price = input.price;
  if (input.remove) {
    check(previous, 404, 'Grupo no encontrado.');
    delete category.groups[input.id];
  } else {
    check(Number.isSafeInteger(price) && price >= 0 && price <= 999999999, 400, 'Revisá el precio.');
    category.groups[input.id] = { name: name(input.name), price, version: (previous?.version ?? 0) + 1 };
  }
  for (const p of Object.values(state.products)) {
    if (p.categoryId === input.categoryId && p.groupId === input.id) {
      if (input.remove) p.groupId = '';
      else p.price = price;
      p.version++;
    }
  }
}
export function productCategory(state, input) {
  const categoryId = input.categoryId ?? '';
  const groupId = input.groupId ?? '';
  check((categoryId === '' || isId(categoryId)) && (groupId === '' || isId(groupId)), 400, 'Revisá la categoría del producto.');
  const category = categoriesFor(state)[categoryId];
  check(!categoryId || category, 409, 'La categoría ya no existe. Volvé a elegirla.');
  const group = category?.groups[groupId];
  check(!groupId || group, 409, 'El grupo de precio ya no existe. Volvé a elegirlo.');
  check(!group || group.price === input.price, 409, 'Cambió el precio del grupo. Actualizá el panel.');
  return {categoryId, groupId};
}
