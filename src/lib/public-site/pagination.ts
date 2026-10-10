export const PUBLIC_CONTENT_PAGE_SIZE = 24;
export function publicContentPage(value: string | undefined) {
  const n = Number(value ?? 1);
  return Number.isSafeInteger(n) && n >= 1 && n <= 1000000 ? n : 1;
}
