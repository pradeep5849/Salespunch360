import sharp from "sharp";

export const MAX_COMPANY_LOGO_BYTES = 5 * 1024 * 1024;
export const MAX_COMPANY_LOGO_PIXELS = 25_000_000;

export const companyLogoKey = (companyId: string) => `Logo/${companyId}.webp`;

export async function processCompanyLogo(file: File) {
  if (file.size < 1 || file.size > MAX_COMPANY_LOGO_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("LOGO_INVALID");
  }
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { failOn: "error", limitInputPixels: MAX_COMPANY_LOGO_PIXELS }).rotate();
    await image.metadata();
    return await image.resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  } catch {
    throw new Error("LOGO_INVALID");
  }
}
