import { randomInt } from "crypto";

// Excludes 0/O and 1/I/L — easy to misread when someone's reading a code
// off a phone screen to type into another device.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

// Same excluded-character rule as generateInviteCode, but allows a
// commissioner-chosen custom code to run 4-10 characters rather than the
// fixed 6 the generator produces.
export const INVITE_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4,10}$/;
