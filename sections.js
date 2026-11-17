import { sectionPhotos } from './section-photos.js';
import { node } from './shop-client.js';

const main = document.querySelector('#contenido');
const originals = new Map();
for (const section of main.querySelectorAll(':scope > section')) {
  const title = section.querySelector('[data-page-title]');
  const body = section.querySelector('[data-page-body]');
  const photos = Array.from(section.querySelectorAll('[data-section-photo]'), img => ({
    img, src:img.getAttribute('src'), srcset:img.getAttribute('srcset'), alt:img.alt,
    full:img.closest('[data-full]')?.dataset.full
  }));
  originals.set(section.id, {photos, section, title: title.cloneNode(true), body: body.cloneNode(true)});
}
function setCopy(field, value, original) {
  if (original && value === original.textContent) {
    field.replaceChildren(...Array.from(original.childNodes, child => child.cloneNode(true)));
  } else {
    field.textContent = value;
  }
  field.hidden = !value;
}
export function displaySections(sections) {
  if (!Array.isArray(sections)) return;
  const visible = new Set(sections.map(s => s.id));
  for (const [id, {section}] of originals) section.hidden = !visible.has(id);
  main.querySelectorAll('.custom-section').forEach(section => section.remove());
  for (const s of sections) {
    const original = originals.get(s.id);
    let section = original?.section;
    if (!section) {
      section = node('section', null, 'section custom-section');
      section.id = s.id;
      const title = node('h2', null, 'display section-title');
      const body = node('p');
      title.dataset.pageTitle = ''; body.dataset.pageBody = '';
      section.append(title, body);
    }
    setCopy(section.querySelector('[data-page-title]'), s.title, original?.title);
    setCopy(section.querySelector('[data-page-body]'), s.body, original?.body);
    for (const photo of original?.photos || []) {
      const {img} = photo;
      const key = img.dataset.sectionPhoto;
      const replacement = s.photos?.[key];
      const src = replacement || photo.src;
      if (img.getAttribute('src') === src) continue;
      if (replacement || !photo.srcset) img.removeAttribute('srcset');
      else img.setAttribute('srcset', photo.srcset);
      img.src = src;
      img.alt = replacement ? sectionPhotos[s.id][key].label : photo.alt;
      if (photo.full) {
        const button = img.closest('[data-full]');
        button.dataset.full = replacement || photo.full;
        button.setAttribute('aria-label', 'Ampliar: ' + img.alt);
      }
    }
    main.append(section);
  }
  document.querySelector('.logo').setAttribute('href', visible.has('inicio') ? '#inicio' : '#contenido');
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    const id = link.hash.slice(1);
    if (originals.has(id)) link.hidden = !visible.has(id);
  });
  document.getElementById('editBuilder').hidden = !visible.has('arma-tu-box');
  const menu = document.getElementById('mainNav');
  document.querySelector('.menu-toggle').hidden = !menu.querySelector('a:not([hidden])');
}
