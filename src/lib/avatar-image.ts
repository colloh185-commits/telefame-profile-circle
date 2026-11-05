const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const OUTPUT_SIZE = 512;
/** Target size for the compressed upload. */
export const TARGET_UPLOAD_BYTES = 120 * 1024;
const QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58, 0.5];

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the photo"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Decodes the chosen file, center-crops it to a 512px square and compresses it
 * to a JPEG (stepping quality down until it fits the target size).
 * Re-encoding drops EXIF/GPS metadata and anything that isn't pixel data.
 */
export async function prepareAvatar(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  if (file.size > MAX_INPUT_BYTES) throw new Error("Please choose a photo smaller than 15 MB");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This photo format isn't supported. Try a JPG or PNG.");
  }

  const side = Math.min(bitmap.width, bitmap.height);
  if (side < 64) throw new Error("Photo is too small — use one at least 64×64 pixels");
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process the photo");
  // JPEG has no transparency: paint a white base so transparent PNGs look right.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  bitmap.close();

  let blob: Blob | null = null;
  for (const q of QUALITY_STEPS) {
    blob = await canvasToBlob(canvas, q);
    if (blob && blob.size <= TARGET_UPLOAD_BYTES) break;
  }
  if (!blob) throw new Error("Could not process the photo");

  return {
    base64: await blobToBase64(blob),
    previewUrl: URL.createObjectURL(blob),
    bytes: blob.size,
  };
}
