/** Bound actual streamed bytes even when Content-Length is absent or forged. */
export async function boundedPrivateDocumentMultipart(request: Request, invalid: () => Error) {
  const limit = 11 * 1024 * 1024;
  if (Number(request.headers.get("content-length")) > limit) throw invalid();
  const reader = request.body?.getReader();
  if (!reader) throw invalid();
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.length;
      if (total > limit) { await reader.cancel(); throw invalid(); }
      parts.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  try {
    return await new Response(bytes, { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
  } catch { throw invalid(); }
}
