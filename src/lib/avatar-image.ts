const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const OUTPUT_SIZE = 512;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
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
 * Decodes the chosen file, center-crops it to a 512px square and re-encodes it.
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
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  bitmap.close();

  let blob = await canvasToBlob(canvas, "image/webp", 0.86);
  if (!blob || blob.type !== "image/webp") blob = await canvasToBlob(canvas, "image/jpeg", 0.88);
  if (!blob) throw new Error("Could not process the photo");

  return {
    base64: await blobToBase64(blob),
    previewUrl: URL.createObjectURL(blob),
  };
}
