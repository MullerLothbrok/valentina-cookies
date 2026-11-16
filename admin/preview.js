let catalog, page, selected = 'inicio';
let product = null;
const frame = () => document.getElementById('pagePreview');
const productFrame = () => document.getElementById('productPreview');
function send(target, payload) {
  target?.contentWindow?.postMessage({type:'valentina-preview', ...payload}, location.origin);
}
function refresh() {
  if (!catalog || !page) return;
  send(frame(), {...catalog, sections:page, focus:selected});
}
export function previewCatalog(data) {
  catalog = {products:data.products, categories:data.categories};
  refresh();
}
export function previewSections(sections, focus) {
  page = sections;
  if (focus) selected = focus;
  refresh();
}
export function previewProduct(draft) {
  product = draft;
  if (!catalog || !draft) return;
  const description = {id:'catalogo', title:draft.name || 'Nueva presentación', body:'', visible:true};
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
        card.querySelector('input').focus({preventScroll:true});
        card.scrollIntoView({block:'nearest', behavior:'smooth'});
        selected = event.data.id;
        refresh();
        document.getElementById('previewPane').classList.remove('mobile-open');
      }
    }
  }
  if (event.source === productFrame()?.contentWindow && event.data?.type === 'valentina-preview-ready') previewProduct(product);
});
const pane = document.getElementById('previewPane');
document.getElementById('showPreview').onclick = () => pane.classList.add('mobile-open');
document.getElementById('closePreview').onclick = () => pane.classList.remove('mobile-open');
document.getElementById('previewSize').onchange = event => {
  pane.classList.toggle('preview-phone', event.target.value === 'phone');
};
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
