/** Must stay under `club_create/update_tournament` `image_url` length (2_000_000). */
export const TOURNAMENT_IMAGE_URL_MAX_LENGTH = 1_900_000;

const MAX_EDGE = 1100;
const FILL = '#1d0b07';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Не удалось прочитать фото'));
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать фото'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Не удалось прочитать фото'));
    image.src = src;
  });
}

function encodeCanvas(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL('image/jpeg', quality);
}

function drawCover(image: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Не удалось обработать фото');
  ctx.fillStyle = FILL;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function scaledSize(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const edge = Math.max(width, height, 1);
  const scale = Math.min(1, maxEdge / edge);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Compress a picked image into a JPEG data URL that fits the tournament
 * `image_url` column limit and still looks like a full-bleed lobby photo.
 */
export async function fileToTournamentImageUrl(file: File): Promise<string> {
  if (!file || file.size <= 0) throw new Error('Не удалось прочитать фото');
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('Нужно изображение');
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  let maxEdge = MAX_EDGE;
  let quality = 0.84;
  let dataUrl = '';

  while (maxEdge >= 480) {
    const size = scaledSize(image.naturalWidth || image.width, image.naturalHeight || image.height, maxEdge);
    const canvas = drawCover(image, size.width, size.height);
    quality = 0.84;
    dataUrl = encodeCanvas(canvas, quality);
    while (dataUrl.length > TOURNAMENT_IMAGE_URL_MAX_LENGTH && quality > 0.45) {
      quality = Math.max(0.45, quality - 0.12);
      dataUrl = encodeCanvas(canvas, quality);
    }
    if (dataUrl.length <= TOURNAMENT_IMAGE_URL_MAX_LENGTH) return dataUrl;
    maxEdge = Math.round(maxEdge * 0.72);
  }

  throw new Error('Фото слишком большое. Выберите файл меньшего размера');
}
