import { get, put, BlobPreconditionFailedError, BlobNotFoundError } from '@vercel/blob';
import { initialState, ShopError } from './shop.js';

const file = 'tienda/gestion-v1.json';
const options = { access: 'private', useCache: false };
export async function readState() {
  let data;
  try { data = await get(file, options); }
  catch (e) { if (!(e instanceof BlobNotFoundError)) throw e; }
  if (!data) return { state: initialState(), etag: null };
  return { state: await new Response(data.stream).json(), etag: data.blob.etag };
}

export async function mutate(update) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { state, etag } = await readState();
    const result = update(state);
    try {
      await put(file, JSON.stringify(state), { access: 'private', contentType: 'application/json',
        addRandomSuffix: false, ...(etag ? { ifMatch: etag } : { allowOverwrite: false }) });
      return result;
    } catch (e) {
      if (!(e instanceof BlobPreconditionFailedError) && (etag || !/already exists/i.test(e.message))) throw e;
    }
  }
  throw new ShopError(409, 'Hay otra actualización en curso. Volvé a intentar.');
}
