// wa.me needs the full international number (digits only, no "+", no trunk/international "0" prefix).
// Bare 10-digit numbers are assumed to be Indian mobiles and get the 91 country code.
export function waNumber(phone: string | null | undefined): string {
  const digits = (phone || "").replace(/\D/g, "").replace(/^0+/, "");
  return digits.length === 10 ? `91${digits}` : digits;
}
