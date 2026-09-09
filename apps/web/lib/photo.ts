export async function compressPhoto(file: File, maxEdge = 720, quality = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't read that photo.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

export function snapFromVideo(video: HTMLVideoElement, maxEdge = 720, quality = 0.72): string {
  const sourceW = video.videoWidth || 720;
  const sourceH = video.videoHeight || 960;
  const scale = Math.min(1, maxEdge / Math.max(sourceW, sourceH));
  const width = Math.max(1, Math.round(sourceW * scale));
  const height = Math.max(1, Math.round(sourceH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't take that photo.");
  ctx.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}
