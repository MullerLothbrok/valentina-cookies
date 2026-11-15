import { get, BlobNotFoundError } from '@vercel/blob';
import { isId } from '../lib/shop.js';
export default async function handler(req, res) {
  if (req.method !== 'GET' || !isId(req.query.id)) return res.status(404).end();
  try {
    const file = await get('fotos/' + req.query.id + '.jpg', { access: 'private' });
    if (!file) return res.status(404).end();
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end(Buffer.from(await new Response(file.stream).arrayBuffer()));
  } catch (e) { return res.status(e instanceof BlobNotFoundError ? 404 : 503).end(); }
}
