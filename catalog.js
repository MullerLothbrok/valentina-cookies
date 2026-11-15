import { node } from './shop-client.js';
import { money } from './order.js';
export function drawCatalog(products) {
  const list = document.querySelector('.catalog-list');
  list.replaceChildren();
  for (const [id, p] of Object.entries(products)) {
    const article = node('article', null, 'item');
    const photos = node('div', null, 'item-photo');
    if (p.photos.length) {
      const image = node('img');
      image.src = p.photos[0]; image.alt = p.name; image.loading = 'lazy';
      photos.append(image);
    }
    const info = node('div');
    info.append(node('h3', p.name), node('p', p.description));
    if (p.photos.length > 1) {
      const gallery = node('details');
      gallery.append(node('summary', 'Ver fotos (' + p.photos.length + ')'));
      for (const photo of p.photos) {
        const button = node('button', null, 'product-thumb');
        button.type = 'button'; button.dataset.full = photo;
        const img = node('img'); img.alt = p.name; img.src = photo; img.loading = 'lazy';
        button.append(img); gallery.append(button);
      }
      info.append(gallery);
    }
    const side = node('div', null, 'item-side');
    side.append(node('div', p.price ? 'Gs. ' + money(p.price) : 'A consultar', 'price'));
    if (p.available && p.stock !== 0) {
      const add = node('button', '+', 'add'); add.type = 'button'; add.dataset.product = id;
      add.setAttribute('aria-label', 'Agregar ' + p.name); side.append(add);
    } else { side.append(node('small', 'Agotado')); }
    article.append(photos, info, side); list.append(article);
  }
  if (!list.children.length) list.append(node('p', 'Pronto habrá productos disponibles.'));
}
