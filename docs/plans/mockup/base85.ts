// RFC 1924 digits with three replacements to keep the alphabet safe in HTML.
const digits =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%:()*+-;[=]?@^_`{|}~';

export function encodeBase85(bytes: Uint8Array) {
  let encoded = '';
  for (let start = 0; start < bytes.length; start += 4) {
    let value = 0;
    for (let offset = 0; offset < 4; offset++) {
      value = value * 256 + (bytes[start + offset] ?? 0);
    }
    let group = '';
    for (let index = 0; index < 5; index++) {
      group = digits.charAt(value % 85) + group;
      value = Math.floor(value / 85);
    }
    encoded += group.slice(0, Math.min(5, bytes.length - start + 1));
  }
  return encoded;
}

export function decodeBase85(encoded: string) {
  const bytes = new Uint8Array(Math.floor((encoded.length * 4) / 5));
  let target = 0;
  for (let start = 0; start < encoded.length; start += 5) {
    let value = 0;
    for (let index = 0; index < 5; index++) {
      const digit = encoded.charAt(start + index);
      value = value * 85 + (digit ? digits.indexOf(digit) : 84);
    }
    for (let shift = 24; shift >= 0 && target < bytes.length; shift -= 8) {
      bytes[target++] = (value >>> shift) & 0xff;
    }
  }
  return bytes;
}
