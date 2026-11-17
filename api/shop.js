import { categoriesFor, changeCategory, changePriceGroup } from '../lib/categories.js';
import { randomUUID } from 'node:crypto';
import { put, del } from '@vercel/blob';
import { changeProduct, changeStatus, createOrder, check, ShopError } from '../lib/shop.js';
import { originalSections, pageFor, publishPage } from '../lib/page.js';
import { mutate, readState } from '../lib/storage.js';
import { cookie, orderSource, requireAdmin, verifyPassword } from '../lib/session.js';

function unusedPhotos(state, previous) {
  const used = new Set([
    ...Object.values(state.products).flatMap(p => p.photos),
    ...pageFor(state).sections.flatMap(s => Object.values(s.photos || {}))
  ]);
  return [...new Set(previous)].filter(src => src.startsWith('/api/photo?id=') && !used.has(src));
}
function removePhotos(paths) {
  return Promise.allSettled(paths.map(src => del('fotos/' + src.slice(14) + '.jpg')));
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    if (req.method === 'GET') {
      if (req.query.view === 'admin') {
        requireAdmin(req);
        const { state } = await readState();
        const orders = Object.entries(state.orders).map(([id, { source, deducted, ...order }]) => ({ id, ...order }));
        return res.json({ products: state.products, categories: categoriesFor(state), page: pageFor(state), originalSections, orders: orders.sort((a, b) => b.created - a.created) });
      }
      const { state } = await readState();
      return res.json({ products: state.products, categories: categoriesFor(state), sections: pageFor(state).sections.filter(s => s.visible) });
    }
    check(req.method === 'POST', 405, 'Método no permitido.');
    check(req.headers.origin && new URL(req.headers.origin).host === req.headers.host, 403, 'Abrí la página desde la dirección de la tienda.');
    check(req.headers['content-type']?.startsWith('application/json'), 415, 'Formato no admitido.');
    const body = req.body;
    check(body && typeof body === 'object', 400, 'Revisá los datos.');
    if (body.action === 'login') {
      check(verifyPassword(body.password), 401, 'La clave es incorrecta.');
      res.setHeader('Set-Cookie', cookie(true));
    } else if (body.action === 'logout') {
      res.setHeader('Set-Cookie', cookie(false));
    } else if (body.action === 'order') {
      check(JSON.stringify(body).length <= 16000, 413, 'El pedido es demasiado largo.');
      const receipt = await mutate(state => createOrder(state, body, orderSource(req)));
      return res.json(receipt);
    } else {
      requireAdmin(req);
      if (body.action === 'category' || body.action === 'priceGroup') {
        await mutate(state => body.action === 'category' ? changeCategory(state, body.item) : changePriceGroup(state, body.item));
        return res.json({ok: true});
      }
      if (body.action === 'page') {
        const {page, removed} = await mutate(state => {
          const old = pageFor(state).sections.flatMap(s => Object.values(s.photos || {}));
          const page = publishPage(state, body);
          return {page, removed:unusedPhotos(state, old)};
        });
        await removePhotos(removed);
        return res.json({ page });
      }
      if (body.action === 'product' || body.action === 'delete') {
        const removed = await mutate(state => {
          const old = state.products[body.product?.id]?.photos || [];
          check(body.product && typeof body.product === 'object', 400, 'Revisá el producto.');
          changeProduct(state, body.product, body.action === 'delete');
          return unusedPhotos(state, old);
        });
        await removePhotos(removed);
      } else if (body.action === 'status') {
        await mutate(state => changeStatus(state, body.id, body.status));
      } else if (body.action === 'upload') {
        check(typeof body.image === 'string' && body.image.length < 2800000, 400, 'La foto es demasiado grande.');
        const bytes = Buffer.from(body.image, 'base64');
        check(bytes.length > 12 && bytes.readUInt16BE(0) === 0xffd8 && bytes.readUInt16BE(bytes.length - 2) === 0xffd9, 400, 'Elegí una foto válida.');
        const id = randomUUID();
        await put('fotos/' + id + '.jpg', bytes, { access: 'private', contentType: 'image/jpeg', addRandomSuffix: false });
        return res.json({ photo: '/api/photo?id=' + id });
      } else { throw new ShopError(400, 'Acción desconocida.'); }
    }
    return res.json({ ok: true });
  } catch (e) {
    if (!(e instanceof ShopError)) console.error('shop request failed', e.name);
    return res.status(e instanceof ShopError ? e.status : 503).json({ error: e instanceof ShopError ? e.message : 'No se pudo acceder a la tienda. Volvé a intentar.' });
  }
}
