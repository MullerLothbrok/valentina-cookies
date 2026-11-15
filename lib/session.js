import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { check } from './shop.js';
const digest = text => createHash('sha256').update(text).digest();
const same = (a, b) => timingSafeEqual(digest(a), digest(b));
function secret() {
  const key = process.env.VALENTINA_ADMIN_PASSWORD;
  check(key?.length >= 16, 503, 'Falta configurar el acceso al panel.');
  return key;
}
export const verifyPassword = input => typeof input === 'string' && same(secret(), input);
const sign = value => createHmac('sha256', secret()).update('valentina/session/' + value).digest('hex');
const name = '__Host-valentina';
export function cookie(login) {
  const expires = String(Date.now() + 8 * 3600000);
  return name + '=' + (login ? expires + '.' + sign(expires) : '') +
    '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + (login ? 28800 : 0);
}
export function requireAdmin(req) {
  const value = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(name + '='))?.slice(name.length + 1) || '';
  const [expires, mac] = value.split('.');
  check(/^\d{13}$/.test(expires) && Number(expires) > Date.now() && same(sign(expires), mac || ''), 401, 'Ingresá con tu clave.');
}
export function orderSource(req) {
  const ip = req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || '';
  return createHmac('sha256', secret()).update('request/' + String(ip)).digest('hex').slice(0, 24);
}
