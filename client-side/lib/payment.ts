export type CardFields = {
  cardName: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
};

export const TEST_CARD: CardFields = {
  cardName: "Rowan Mercer",
  cardNumber: "4242 4242 4242 4242",
  expiry: "10 / 2028",
  cvc: "123",
};

const digits = (value: string) => value.replace(/\D/g, "");

export function formatCardNumber(value: string): string {
  return digits(value)
    .slice(0, 19)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

export function formatExpiry(value: string): string {
  const raw = digits(value).slice(0, 4);
  if (raw.length < 3) return raw;
  return `${raw.slice(0, 2)} / ${raw.slice(2)}`;
}

export function formatCvc(value: string): string {
  return digits(value).slice(0, 4);
}

export function luhn(value: string): boolean {
  const numbers = digits(value);

  if (numbers.length < 13) return false;

  let sum = 0;
  let double = false;

  for (let index = numbers.length - 1; index >= 0; index -= 1) {
    let digit = Number(numbers[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }

  return sum % 10 === 0;
}

/** Turns the raw expiry field into the last day of its month, or null if unusable. */
export function expiryEnd(value: string): Date | null {
  const match = /^(\d{2})\s*\/?\s*(\d{2}|\d{4})$/.exec(digits(value));
  if (!match) return null;

  const month = Number(match[1]);
  const year = Number(match[2].length === 2 ? `20${match[2]}` : match[2]);
  if (month < 1 || month > 12) return null;

  return new Date(Date.UTC(year, month, 1));
}

export function validateCard(fields: CardFields): Record<string, string> {
  const errors: Record<string, string> = {};

  if (fields.cardName.trim().length < 2) {
    errors.cardName = "Enter the name printed on the card.";
  }

  const number = digits(fields.cardNumber);
  if (number.length === 0) {
    errors.cardNumber = "Enter your card number.";
  } else if (number.length < 13 || !luhn(number)) {
    errors.cardNumber = "That card number is not valid — check for typos.";
  }

  const end = expiryEnd(fields.expiry);
  if (!end) {
    errors.expiry = "Use MM / YYYY, for example 10 / 2028.";
  } else if (end.getTime() <= Date.now()) {
    errors.expiry = "That card has expired — use a later month.";
  }

  if (!/^\d{3,4}$/.test(digits(fields.cvc))) {
    errors.cvc = "The security code is 3 or 4 digits.";
  }

  return errors;
}
