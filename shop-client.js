export async function request(body, view = '') {
  const response = await fetch('/api/shop' + view, body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  } : { cache: 'no-store' });
  let result;
  try { result = await response.json(); } catch { result = {}; }
  if (!response.ok || !Object.keys(result).length) {
    const e = new Error(result.error || 'No se pudo conectar con la tienda. Volvé a intentar.');
    e.status = response.status; throw e;
  }
  return result;
}
export function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (className) el.className = className;
  return el;
}
