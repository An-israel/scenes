// File-type helpers shared by server routes and the browser.

export function extFor(mimeType: string): "jpg" | "png" | "webp" {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  return "png";
}

/** Extension of a storage path or signed URL, read from the path (not the query string). */
export function extOfUrl(url: string): string {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {}
  const m = /\.([a-z0-9]+)$/i.exec(path);
  return m ? m[1].toLowerCase() : "png";
}

export function mimeForExt(ext: string): string {
  return ext === "jpg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
}
