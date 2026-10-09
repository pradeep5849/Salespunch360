/** International numbers may contain spaces, hyphens and parentheses, never alphabetic text. */
export function validInquiryTelephone(value: string) {
  if (!/^\+?[0-9 ()-]+$/.test(value) || value.length > 30) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}
