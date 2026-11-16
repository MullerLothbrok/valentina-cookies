import { node, request } from '../shop-client.js';

const $ = id => document.getElementById(id);
let saved, originals = [], sections = [], dirty = false, busy = false, conflict = false;
function status(message) {
  $('pageStatus').textContent = message;
  $('publishPage').disabled = !dirty || busy || conflict;
  $('discardPage').disabled = !dirty || busy;
  $('pageControls').disabled = busy;
}
function changed() {
  dirty = true;
  status(conflict ? 'La página cambió en otra sesión. Descartá esta edición para cargar la actual.' : 'Hay cambios sin publicar.');
}
function button(label, fn, disabled = false) {
  const el = node('button', label, 'secondary');
  el.type = 'button'; el.disabled = disabled; el.onclick = fn;
  return el;
}
function field(label, element) {
  const wrapper = node('label', label);
  wrapper.append(element); return wrapper;
}
function draw(openId) {
  const list = $('sectionList');
  list.replaceChildren();
  for (const [index, s] of sections.entries()) {
    const card = node('details', null, 'card page-card');
    card.open = s.id === openId;
    const summary = node('summary');
    const name = node('strong', s.title || 'Nueva sección');
    const badge = node('small', s.visible ? '' : 'Oculta');
    summary.append(name, badge);
    const title = node('input'); title.value = s.title; title.maxLength = 160;
    title.oninput = () => { s.title = title.value; name.textContent = s.title || 'Nueva sección'; changed(); };
    const body = node('textarea'); body.rows = 3; body.maxLength = 4000; body.value = s.body;
    body.oninput = () => { s.body = body.value; changed(); };
    const visible = node('input'); visible.type = 'checkbox'; visible.checked = s.visible;
    visible.onchange = () => { s.visible = visible.checked; badge.textContent = s.visible ? '' : 'Oculta'; changed(); };
    const toggle = node('label', null, 'check'); toggle.append(visible, 'Mostrar en la tienda');
    function move(offset) {
      sections.splice(index, 1); sections.splice(index + offset, 0, s);
      changed(); draw(s.id); focusCard(s.id);
    }
    const controls = node('div', null, 'actions');
    controls.append(button('Subir', () => move(-1), index === 0), button('Bajar', () => move(1), index === sections.length - 1),
      button('Quitar sección', () => {
        if (!confirm('¿Quitar esta sección? El cambio se aplicará cuando publiques.')) return;
        sections.splice(index, 1); changed(); draw(); $('addSection').focus();
      }));
    card.dataset.id = s.id;
    card.append(summary, field('Título', title), field('Texto', body), toggle, controls);
    list.append(card);
  }
  const select = $('restoreSection');
  select.replaceChildren(new Option('Recuperar sección original…', ''));
  for (const s of originals) {
    if (!sections.some(item => item.id === s.id)) select.add(new Option(s.title, s.id));
  }
  select.hidden = select.options.length <= 1;
}
function focusCard(id, selector = 'summary') {
  $('sectionList').querySelector('[data-id="' + id + '"] ' + selector)?.focus();
}
export function loadPageEditor(page, defaults) {
  originals = defaults;
  if (!dirty && !busy) {
    if (saved && saved.version >= page.version) return;
    saved = page; sections = structuredClone(page.sections);
    draw(); status('');
  } else if (saved.version !== page.version) {
    conflict = true; changed();
  }
}
export function resetPageEditor() {
  saved = null; sections = []; originals = []; dirty = false; busy = false; conflict = false;
  draw(); status('');
}
function add(s) {
  sections.push(s); changed(); draw(s.id); focusCard(s.id, 'input');
}
$('addSection').onclick = () => add({ id:crypto.randomUUID(), title:'', body:'', visible:true });
$('restoreSection').onchange = e => {
  const s = originals.find(item => item.id === e.target.value);
  if (s) add(structuredClone(s));
};
$('discardPage').onclick = async () => {
  if (!confirm('¿Descartar los cambios sin publicar y cargar la página actual?')) return;
  busy = true; status('Cargando…');
  try {
    const {page} = await request(null, '?view=admin');
    saved = page; sections = structuredClone(page.sections); dirty = false; conflict = false; draw();
    status('Se cargó la versión publicada.');
  } catch (e) { status(e.message); }
  finally { busy = false; status($('pageStatus').textContent); }
};
$('publishPage').onclick = async () => {
  const missing = sections.find(s => !s.title.trim());
  if (missing) { draw(missing.id); focusCard(missing.id, 'input'); status('Escribí un título para esta sección.'); return; }
  busy = true; status('Publicando…');
  try {
    const {page} = await request({action:'page', version:saved.version, sections});
    saved = page; sections = structuredClone(page.sections); dirty = false; conflict = false;
    draw(); status('Cambios publicados en la tienda.');
  } catch (e) { conflict = e.status === 409; status(conflict ? e.message + ' Usá Descartar cambios para recargar.' : e.message); }
  finally { busy = false; status($('pageStatus').textContent); }
};
window.addEventListener('beforeunload', event => {
  if (dirty) { event.preventDefault(); event.returnValue = ''; }
});
