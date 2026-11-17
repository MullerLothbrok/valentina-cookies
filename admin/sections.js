import { originalBackground, sectionText, luminance } from '../section-colors.js';
import { sectionPhotos } from '../section-photos.js';
import { preparePhoto, photoDataURL } from './photo-file.js';
import { previewSections } from './preview.js';
import { node, request } from '../shop-client.js';

const $ = id => document.getElementById(id);
let saved, originals = [], sections = [], dirty = false, busy = false, conflict = false;
// Keep selected images on this device until the page is published.
const pendingPhotos = new Map();
function releasePhotos() {
  const used = new Set(sections.flatMap(s => Object.values(s.photos || {})));
  for (const url of pendingPhotos.keys()) {
    if (!used.has(url)) { URL.revokeObjectURL(url); pendingPhotos.delete(url); }
  }
}
function status(message) {
  $('pageStatus').textContent = message;
  $('publishPage').disabled = !dirty || busy || conflict;
  $('discardPage').disabled = !dirty || busy;
  $('pageControls').disabled = busy;
}
function changed(sectionId, photoKey) {
  dirty = true;
  releasePhotos();
  previewSections(sections, sectionId || document.activeElement?.closest('.page-card')?.dataset.id, photoKey);
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
function colorFields(s) {
  const group = node('fieldset', null, 'section-colors');
  group.append(node('legend', 'Colores de la sección'));
  const fields = node('div', null, 'color-fields');
  const pickers = {};
  const warning = node('small');
  warning.setAttribute('role', 'status');
  const restore = button('Restaurar colores originales', () => {
    s.colors = {}; update(); changed(s.id);
  });
  function update() {
    const background = s.colors?.background || originalBackground(s.id);
    const text = sectionText(s);
    pickers.text.value = text;
    pickers.background.value = background;
    restore.hidden = !(s.colors?.background || s.colors?.text);
    const originalPanel = !s.colors?.background && s.id === 'arma-tu-box' ? '#100e0b' : background;
    const light = luminance(originalPanel), ink = luminance(text);
    warning.textContent = s.colors?.text && (Math.max(light, ink) + .05) / (Math.min(light, ink) + .05) < 4.5
      ? 'El texto puede ser difícil de leer. Probá un tono más claro o más oscuro.' : '';
  }
  for (const [key, label] of [['background','Fondo'], ['text','Letras']]) {
    const input = node('input'); input.type = 'color';
    input.setAttribute('list', 'brandColors'); pickers[key] = input;
    input.oninput = input.onchange = () => {
      if (s.colors?.[key] === input.value) return;
      (s.colors ??= {})[key] = input.value; update(); changed(s.id);
    };
    fields.append(field(label, input));
  }
  group.append(fields, warning, restore); update();
  return group;
}
function photoFields(s) {
  const group = node('div', null, 'section-photos');
  group.append(node('h3', 'Fotos de la sección'));
  for (const [key, slot] of Object.entries(sectionPhotos[s.id])) {
    const row = node('div', null, 'section-photo');
    const thumb = node('img'); thumb.alt = ''; thumb.loading = 'lazy';
    const controls = node('div');
    const picker = node('label', 'Cambiar foto', 'pick-photo');
    const file = node('input'); file.type = 'file'; file.accept = 'image/*';
    file.dataset.photoKey = key; file.setAttribute('aria-label', 'Cambiar foto de ' + slot.label);
    const error = node('small'); error.setAttribute('role', 'alert');
    const restore = button('Restaurar original', () => {
      delete s.photos[key]; update(); changed(s.id, key);
    });
    function update() {
      thumb.src = s.photos?.[key] || slot.original;
      restore.hidden = !s.photos?.[key]; error.textContent = '';
    }
    file.onchange = async () => {
      const selected = file.files[0]; if (!selected || busy) return;
      busy = true; status('Preparando foto…'); error.textContent = '';
      try {
        const blob = await preparePhoto(selected);
        if (!sections.includes(s)) return;
        const url = URL.createObjectURL(blob);
        pendingPhotos.set(url, {blob});
        (s.photos ??= {})[key] = url;
        update(); changed(s.id, key);
      } catch {
        error.textContent = 'No pudimos abrir la foto. Probá con una imagen JPG, PNG o WebP.';
        status(dirty ? 'Hay cambios sin publicar.' : '');
      } finally {
        busy = false; file.value = ''; status($('pageStatus').textContent);
      }
    };
    picker.append(file); controls.append(node('strong', slot.label), picker, restore, error);
    row.append(thumb, controls); group.append(row); update();
  }
  return group;
}
async function photosForPublication() {
  const result = structuredClone(sections);
  for (const s of result) {
    s.colors ??= {};
    if (!sectionPhotos[s.id]) continue;
    s.photos ??= {};
    for (const [key, url] of Object.entries(s.photos)) {
      const draft = pendingPhotos.get(url);
      if (!draft) continue;
      if (!draft.uploaded) {
        status('Subiendo foto de ' + sectionPhotos[s.id][key].label + '…');
        const data = await photoDataURL(draft.blob);
        draft.uploaded = (await request({action:'upload', image:data.split(',')[1]})).photo;
      }
      s.photos[key] = draft.uploaded;
    }
  }
  return result;
}
function createCard(s, openId) {
  const card = node('details', null, 'card page-card');
  card.open = s.id === openId;
  card.ontoggle = () => { if (card.isConnected && card.open) previewSections(sections, s.id); };
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
    const index = sections.indexOf(s);
    const neighbor = offset < 0 ? card.previousElementSibling : card.nextElementSibling;
    if (!neighbor || index < 0) return;
    sections.splice(index, 1); sections.splice(index + offset, 0, s);
    card.parentElement.insertBefore(card, offset < 0 ? neighbor : neighbor.nextElementSibling);
    updateMoveButtons(); focusCard(s.id); changed(s.id);
  }
  const controls = node('div', null, 'actions');
  const up = button('Subir', () => move(-1));
  const down = button('Bajar', () => move(1));
  up.dataset.move = 'up'; down.dataset.move = 'down';
  controls.append(up, down,
    button('Quitar sección', () => {
      if (!confirm('¿Quitar esta sección? El cambio se aplicará cuando publiques.')) return;
      sections.splice(sections.indexOf(s), 1); card.remove();
      updateMoveButtons(); updateRestoreMenu(); $('addSection').focus(); changed();
    }));
  card.dataset.id = s.id;
  card.append(summary, field('Título', title), field('Texto', body), colorFields(s));
  if (sectionPhotos[s.id]) card.append(photoFields(s));
  if (s.id === 'catalogo') card.append(node('p', 'Para cambiar una foto del catálogo, entrá en Productos y tocá Fotos o Agregar foto.', 'muted'));
  card.append(toggle, controls);
  return card;
}
function updateMoveButtons() {
  const cards = $('sectionList').children;
  for (const card of cards) {
    card.querySelector('[data-move="up"]').disabled = card === cards[0];
    card.querySelector('[data-move="down"]').disabled = card === cards[cards.length - 1];
  }
}
function draw(openId) {
  releasePhotos();
  $('sectionList').replaceChildren(...sections.map(s => createCard(s, openId)));
  updateMoveButtons(); updateRestoreMenu();
  previewSections(sections, openId);
}
function updateRestoreMenu() {
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
  sections.push(s); $('sectionList').append(createCard(s, s.id));
  updateMoveButtons(); updateRestoreMenu(); focusCard(s.id, 'input'); changed(s.id);
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
  if (missing) {
    $('sectionList').querySelector('[data-id="' + missing.id + '"]').open = true;
    focusCard(missing.id, 'input'); status('Escribí un título para esta sección.'); return;
  }
  busy = true; status('Publicando…');
  try {
    const {page} = await request({action:'page', version:saved.version, sections:await photosForPublication()});
    saved = page; sections = structuredClone(page.sections); dirty = false; conflict = false;
    draw(); status('Cambios publicados en la tienda.');
  } catch (e) { conflict = e.status === 409; status(conflict ? e.message + ' Usá Descartar cambios para recargar.' : e.message); }
  finally { busy = false; status($('pageStatus').textContent); }
};
window.addEventListener('beforeunload', event => {
  if (dirty) { event.preventDefault(); event.returnValue = ''; }
});
