// Client-side photo compression: keeps uploads small for 3G connections and
// well under the serverless payload limit. EXIF (incl. GPS) is dropped.
export async function compressImage(file, maxSide = 1024, quality = 0.72) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not read that image'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    let q = quality;
    let data = canvas.toDataURL('image/jpeg', q);
    while (data.length > 450_000 && q > 0.35) { q -= 0.1; data = canvas.toDataURL('image/jpeg', q); }
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}
