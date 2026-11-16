import { check, isId } from './shop.js';

export const originalSections = [
  {
    "id": "inicio",
    "title": "COOKIES QUE SE NOTAN.",
    "body": "Cookies estilo americano, boxes, regalos y pedidos personalizados para convertir un antojo en algo que también se quiere regalar.",
    "visible": true
  },
  {
    "id": "frase",
    "title": "No hacemos postres para pasar desapercibidos.",
    "body": "Cookies que se notan. Regalos que se recuerdan.",
    "visible": true
  },
  {
    "id": "mundo",
    "title": "Elegí el mood.",
    "body": "Cookies para hoy, cajas para regalar y detalles para celebrar. Elegí una categoría y contanos qué te gustaría pedir.",
    "visible": true
  },
  {
    "id": "arma-tu-box",
    "title": "Armá tu box.",
    "body": "Elegí para quién es, qué te gustaría incluir y una cantidad aproximada. La página arma el mensaje y Valentina confirma sabores, diseños, precio final y entrega.",
    "visible": true
  },
  {
    "id": "ocasiones",
    "title": "Resolvé la ocasión.",
    "body": "Un cumpleaños, una sorpresa o un detalle para tu equipo. Contanos la ocasión y preparamos una propuesta para vos.",
    "visible": true
  },
  {
    "id": "catalogo",
    "title": "Elegí. Sumá. Pedí.",
    "body": "Agregá productos al pedido. Al finalizar, la web arma un único mensaje de WhatsApp para confirmar disponibilidad, personalización y entrega.",
    "visible": true
  },
  {
    "id": "como-pedir",
    "title": "Así de simple.",
    "body": "Elegí lo que te gusta, sumá los detalles y consultanos por WhatsApp. Te confirmamos disponibilidad, precio final y entrega.",
    "visible": true
  },
  {
    "id": "fotos",
    "title": "Miralo de cerca.",
    "body": "Chocolate, color y muchas ganas de probar. Tocá una foto para descubrir los detalles.",
    "visible": true
  },
  {
    "id": "personalizados",
    "title": "Tu idea, en versión Valentina.",
    "body": "Cookies decoradas y boxes para cumpleaños, eventos, equipos y marcas. Contanos tu temática, la cantidad y la fecha: te ayudamos a elegir los detalles.",
    "visible": true
  },
  {
    "id": "marca",
    "title": "Dulce, pop y un poco exagerado.",
    "body": "Cookies con mucho sabor, combinaciones para descubrir y cajas llenas de color. Hechas en Encarnación para compartir, regalar o darte un gusto.",
    "visible": true
  },
  {
    "id": "contacto",
    "title": "Tu próximo antojo empieza acá.",
    "body": "Elegí del catálogo, armá un box o contanos la ocasión. Todo termina en un mensaje ordenado y listo para coordinar.",
    "visible": true
  }
];

export function pageFor(state) {
  return state.page ?? { version: 0, sections: originalSections };
}

export function publishPage(state, input) {
  const current = pageFor(state);
  check(input.version === current.version, 409, 'La página cambió en otra sesión. Cargá la versión publicada antes de editar.');
  check(Array.isArray(input.sections) && input.sections.length <= 80, 400, 'Podés publicar hasta 80 secciones.');
  const ids = new Set();
  const sections = input.sections.map(s => {
    check(s && (originalSections.some(original => original.id === s.id) || isId(s.id)) && !ids.has(s.id), 400, 'Revisá las secciones repetidas.');
    ids.add(s.id);
    check(typeof s.title === 'string' && s.title.trim() && s.title.length <= 160, 400, 'Cada sección necesita un título de hasta 160 caracteres.');
    check(typeof s.body === 'string' && s.body.length <= 4000 && typeof s.visible === 'boolean', 400, 'Revisá el texto y la visibilidad de la sección.');
    return { id: s.id, title: s.title.trim(), body: s.body.trim(), visible: s.visible };
  });
  state.page = { version: current.version + 1, sections };
  return state.page;
}
