import { MAX_PHOTO_INPUT_BYTES, PHOTO_MAX_SIDE } from "./post-rules";
import { MediaError, canvasToJpeg, makeCanvas } from "./media-canvas";

const TARGET_BYTES = 450 * 1024;
const QUALITY_STEPS = [0.84, 0.76, 0.68, 0.6];

export type CompressedPhoto = { blob: Blob; width: number; height: number; url: string };

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return createImageBitmap(file);
  }
}

/**
 * Resizes to fit PHOTO_MAX_SIDE and re-encodes as JPEG, stepping quality down
 * until it fits the size target. Re-encoding drops EXIF/GPS and non-pixel data.
 */
export async function compressPhoto(file: Blob, maxSide = PHOTO_MAX_SIDE): Promise<CompressedPhoto> {
  if (!file.type.startsWith("image/")) throw new MediaError("Please choose an image file");
  if (file.size > MAX_PHOTO_INPUT_BYTES) throw new MediaError("Each photo must be under 40 MB");

  let bitmap: ImageBitmap;
  try {
    bitmap = await decode(file);
  } catch {
    throw new MediaError("This photo format isn't supported. Try a JPG or PNG.");
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  if (Math.min(width, height) < 32) {
    bitmap.close();
    throw new MediaError("This photo is too small");
  }

  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new MediaError("Could not process the photo");
  ctx.fillStyle = "#ffffff"; // JPEG has no transparency
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let blob: Blob | null = null;
  for (const q of QUALITY_STEPS) {
    blob = await canvasToJpeg(canvas, q);
    if (blob.size <= TARGET_BYTES) break;
  }
  return { blob: blob!, width, height, url: URL.createObjectURL(blob!) };
}
