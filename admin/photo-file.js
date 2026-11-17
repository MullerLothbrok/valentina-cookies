export async function preparePhoto(file) {
  const img = new Image(); const url = URL.createObjectURL(file);
  try {
    img.src = url; await img.decode();
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => {
      if (blob) resolve(blob); else reject(Error('No pudimos preparar la foto.'));
    }, 'image/jpeg', .84));
  } finally { URL.revokeObjectURL(url); }
}

export function photoDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(Error('No pudimos leer la foto.'));
    reader.readAsDataURL(blob);
  });
}
