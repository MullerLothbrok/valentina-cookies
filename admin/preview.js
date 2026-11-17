let catalog, page, selected = 'inicio';
let product = null, selectedPhoto;
const frame = () => document.getElementById('pagePreview');
const productFrame = () => document.getElementById('productPreview');
function send(target, payload) {
  target?.contentWindow?.postMessage({type:'valentina-preview', ...payload}, location.origin);
}
function refresh(recenter = false) {
  if (!catalog || !page) return;
  send(frame(), {...catalog, sections:page, focus:selected, photoKey:selectedPhoto, recenter:recenter === true});
}
export function previewCatalog(data) {
  catalog = {products:data.products, categories:data.categories};
  refresh();
}
export function previewSections(sections, focus, photoKey) {
  page = sections;
  if (focus) { selected = focus; selectedPhoto = photoKey; }
  refresh();
}
export function previewProduct(draft) {
  product = draft;
  if (!catalog || !draft) return;
  const description = {id:'catalogo', colors:page?.find(s => s.id === 'catalogo')?.colors, title:draft.name || 'Nueva presentación', body:'', visible:true};
  send(productFrame(), {products:{[draft.id]:draft}, categories:catalog.categories, sections:[description], focus:'catalogo', productOnly:true});
}
window.addEventListener('message', event => {
  if (event.origin !== location.origin) return;
  if (event.source === frame()?.contentWindow) {
    if (event.data?.type === 'valentina-preview-ready') refresh();
    if (event.data?.type === 'valentina-preview-rendered') document.getElementById('previewLoading').hidden = true;
    if (event.data?.type === 'valentina-select-section') {
      const card = [...document.querySelectorAll('.page-card')].find(el => el.dataset.id === event.data.id);
      if (card) {
        card.open = true;
        const picker = [...card.querySelectorAll('[data-photo-key]')].find(el => el.dataset.photoKey === event.data.photoKey);
        const field = picker || card.querySelector('input');
        document.getElementById('previewPane').classList.remove('mobile-open');
        field.focus({preventScroll:true});
        field.scrollIntoView({block:'center', behavior:'smooth'});
        selectedPhoto = picker?.dataset.photoKey;
        selected = event.data.id;
        refresh();
      }
    }
  }
  if (event.source === productFrame()?.contentWindow && event.data?.type === 'valentina-preview-ready') previewProduct(product);
});
const pane = document.getElementById('previewPane');
document.getElementById('showPreview').onclick = () => {
  pane.classList.add('mobile-open');
  sizeFrame(); requestAnimationFrame(() => refresh(true));
};
document.getElementById('closePreview').onclick = () => pane.classList.remove('mobile-open');
document.getElementById('previewSize').onchange = event => {
  pane.classList.toggle('preview-phone', event.target.value === 'phone');
};
if (matchMedia('(max-width: 650px)').matches) {
  pane.classList.add('preview-phone');
  document.getElementById('previewSize').value = 'phone';
}
frame().addEventListener('load', refresh);
productFrame().addEventListener('load', () => previewProduct(product));

function sizeFrame() {
  const canvas = document.querySelector('.preview-canvas');
  const width = pane.classList.contains('preview-phone') ? 390 : 1100;
  const scale = Math.min(1, canvas.clientWidth / width);
  if (scale <= 0) return;
  const iframe = frame();
  iframe.style.width = width + 'px';
  iframe.style.height = (canvas.clientHeight / scale) + 'px';
  iframe.style.transform = 'scale(' + scale + ')';
}
new ResizeObserver(sizeFrame).observe(document.querySelector('.preview-canvas'));
document.getElementById('previewSize').addEventListener('change', sizeFrame);
