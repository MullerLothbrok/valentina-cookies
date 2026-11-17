// Main text and background colors of the original section designs.
const backgrounds = {
  inicio:'#fea602', frase:'#100e0b', mundo:'#fffcf6', 'arma-tu-box':'#ffe7ba',
  ocasiones:'#fff3dc', catalogo:'#ffffff', 'como-pedir':'#fea602', fotos:'#fff3dc',
  personalizados:'#100e0b', marca:'#fea602', contacto:'#fea602'
};
export function originalBackground(id) { return backgrounds[id] || '#fff3dc'; }
export function originalText(id) {
  return ['frase','personalizados','arma-tu-box'].includes(id) ? '#ffffff' : '#100e0b';
}
export function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(pair => {
    const s = parseInt(pair, 16) / 255;
    return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
  });
  return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
}
export function contrastingColor(background) {
  return luminance(background) > .179 ? '#000000' : '#ffffff';
}
export function sectionText(section) {
  const {text, background} = section.colors || {};
  return text || (background ? contrastingColor(background) : originalText(section.id));
}
export function applySectionColors(el, section) {
  const {background, text} = section.colors || {};
  el.classList.toggle('section-background', !!background);
  el.classList.toggle('section-ink', !!(text || background));
  if (background) el.style.setProperty('--section-background', background);
  else el.style.removeProperty('--section-background');
  if (text || background) {
    const ink = sectionText(section);
    el.style.setProperty('--section-text', ink);
    el.style.setProperty('--letter-backing', contrastingColor(ink));
  } else {
    el.style.removeProperty('--section-text');
    el.style.removeProperty('--letter-backing');
  }
}
