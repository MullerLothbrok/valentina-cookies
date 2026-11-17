import { displaySections } from './sections.js';
import { drawCatalog } from './catalog.js';

export const previewMode = window.parent !== window && new URLSearchParams(location.search).get('preview') === 'editor';

export function startPreview() {
  document.documentElement.classList.add('editor-preview');
  const main = document.getElementById('contenido');
  let selected = '';
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.type !== 'valentina-preview') return;
    const {sections, products, categories, focus, photoKey, productOnly} = event.data;
    const scroll = window.scrollY;
    displaySections(sections.filter(s => s.visible));
    drawCatalog(products, categories);
    document.getElementById('pageLoadStatus').hidden = true;
    main.hidden = false;
    document.documentElement.classList.toggle('product-preview', !!productOnly);
    main.querySelectorAll('[data-preview-selected]').forEach(el => el.removeAttribute('data-preview-selected'));
    const target = document.getElementById(focus);
    if (target && !target.hidden) {
      target.dataset.previewSelected = '';
      const photo = photoKey && [...target.querySelectorAll('[data-section-photo]')].find(el => el.dataset.sectionPhoto === photoKey);
      if (event.data.recenter || selected !== (focus + '/' + (photoKey || ''))) (photo || target).scrollIntoView({behavior:'instant', block:photo ? 'center' : 'start'});
      else window.scrollTo(0, scroll);
    } else window.scrollTo(0, scroll);
    selected = focus + '/' + (photoKey || '');
    parent.postMessage({type:'valentina-preview-rendered'}, location.origin);
  });
  document.addEventListener('click', event => {
    event.preventDefault(); event.stopImmediatePropagation();
    const section = event.target.closest('#contenido > section');
    if (section) {
      const photo = event.target.closest('[data-section-photo]') || event.target.closest('.category, .shot')?.querySelector('[data-section-photo]');
      parent.postMessage({type:'valentina-select-section', id:section.id, photoKey:photo?.dataset.sectionPhoto}, location.origin);
    }
  }, true);
  document.addEventListener('submit', event => {event.preventDefault(); event.stopImmediatePropagation();}, true);
  parent.postMessage({type:'valentina-preview-ready'}, location.origin);
}
