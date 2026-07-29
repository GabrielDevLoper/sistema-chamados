import { getD1, getR2 } from "./runtime";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function detectImage(bytes: Uint8Array) {
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[12] === 0x49 && bytes[13] === 0x48 && bytes[14] === 0x44 && bytes[15] === 0x52
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { extension: "png", contentType: "image/png", width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return {
          extension: "jpg",
          contentType: "image/jpeg",
          height: (bytes[offset + 5] << 8) | bytes[offset + 6],
          width: (bytes[offset + 7] << 8) | bytes[offset + 8],
        };
      }
      if (length < 2) break;
      offset += length + 2;
    }
  }
  if (
    bytes.length >= 30 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    const kind = String.fromCharCode(...bytes.slice(12, 16));
    if (kind === "VP8X") {
      const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
      return { extension: "webp", contentType: "image/webp", width, height };
    }
    return { extension: "webp", contentType: "image/webp", width: 0, height: 0 };
  }
  return null;
}

export async function storeOrganizationLogo(
  organizationId: number,
  file: File
) {
  if (file.size <= 0 || file.size > MAX_LOGO_BYTES) {
    throw new Error("A logo deve ter no máximo 2 MB.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = detectImage(bytes);
  if (!image) throw new Error("Envie uma imagem PNG, JPEG ou WebP válida.");
  if (image.width > 2048 || image.height > 2048) {
    throw new Error("A logo deve ter no máximo 2048 × 2048 pixels.");
  }
  const current = await getD1()
    .prepare("SELECT logo_key FROM organizations WHERE id = ? LIMIT 1")
    .bind(organizationId)
    .first<{ logo_key: string | null }>();
  if (!current) throw new Error("Organização não encontrada.");
  const key = `organizations/${organizationId}/logos/${crypto.randomUUID()}.${image.extension}`;
  await getR2().put(key, bytes, {
    httpMetadata: { contentType: image.contentType, cacheControl: "public, max-age=86400" },
    customMetadata: { organizationId: String(organizationId) },
  });
  try {
    await getD1()
      .prepare("UPDATE organizations SET logo_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(key, organizationId)
      .run();
  } catch (error) {
    await getR2().delete(key);
    throw error;
  }
  if (current.logo_key) await getR2().delete(current.logo_key);
  return key;
}
