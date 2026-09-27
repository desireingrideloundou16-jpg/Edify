/**
 * Reliable file downloads in every browser (Chrome, Opera, Safari, Firefox):
 * a Blob URL on a link attached to the page. Large data: URLs (a 4 MB ad visual)
 * are silently refused by Chromium browsers, so they are converted to a Blob first.
 */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser time to start the download before releasing the file.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function saveDataUrl(dataUrl: string, filename: string) {
  const blob = await (await fetch(dataUrl)).blob();
  saveBlob(blob, filename);
}
