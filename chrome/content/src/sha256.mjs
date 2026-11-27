// SHA-256 as specified in FIPS 180-4, sections 5 and 6.2. The portable path
// needs only ECMAScript typed arrays, including in Zotero's classic runtime.
const SHA256_ROUND_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

export const sha256Hex = async (input, cryptoProvider = undefined) => {
  // Validate before trying native capabilities: invalid input must not silently
  // become an empty buffer, a file length, or any other weak substitute.
  const bytes = normalizeSha256Bytes(input);
  let subtle;
  let nativeDigest;
  try {
    subtle = (cryptoProvider === undefined ? globalThis.crypto : cryptoProvider)?.subtle;
    nativeDigest = subtle?.digest;
  }
  catch (_error) {
    // Some privileged scopes do not expose the Web Crypto property at all.
  }
  if (typeof nativeDigest !== "function") {
    return calculateSha256Hex(bytes);
  }

  // Keep fallback hashing tied to the input at invocation, even if the caller
  // changes its buffer while an asynchronous native digest is pending.
  const snapshot = new Uint8Array(bytes);
  try {
    const digest = normalizeSha256Bytes(await nativeDigest.call(subtle, "SHA-256", snapshot));
    if (digest.byteLength === 32) {
      return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
  }
  catch (_error) {
    // Unsupported/missing native capabilities never reduce hash strength.
  }
  return calculateSha256Hex(snapshot);
};

export function sha256HexPortable(input) {
  return calculateSha256Hex(normalizeSha256Bytes(input));
}

export function isSHA256Hex(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
}

export function isLegacySizeHash(value) {
  return typeof value === "string" && /^size-\d+$/.test(value);
}

function normalizeSha256Bytes(input) {
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  // Calling the intrinsic getter validates the ArrayBuffer brand across realms;
  // instanceof and toString tags are insufficient for this input boundary.
  let byteLength;
  try {
    byteLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get.call(input);
  }
  catch (_error) {
    throw new TypeError("SHA-256 input must be an ArrayBuffer or an ArrayBuffer view.");
  }
  return new Uint8Array(input, 0, byteLength);
}

function calculateSha256Hex(bytes) {
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);
  const words = new Uint32Array(64);
  const wholeLength = bytes.byteLength - (bytes.byteLength % 64);
  for (let offset = 0; offset < wholeLength; offset += 64) {
    compressSha256Block(bytes, offset, state, words);
  }

  // Only the final one or two blocks are copied; do not allocate a padded copy
  // of a potentially large manuscript attachment.
  const remaining = bytes.byteLength - wholeLength;
  const tail = new Uint8Array(remaining < 56 ? 64 : 128);
  tail.set(bytes.subarray(wholeLength));
  tail[remaining] = 0x80;
  const tailView = new DataView(tail.buffer);
  tailView.setUint32(tail.byteLength - 8, Math.floor(bytes.byteLength / 0x20000000), false);
  tailView.setUint32(tail.byteLength - 4, (bytes.byteLength * 8) >>> 0, false);
  for (let offset = 0; offset < tail.byteLength; offset += 64) {
    compressSha256Block(tail, offset, state, words);
  }
  return Array.from(state, (word) => word.toString(16).padStart(8, "0")).join("");
}

function compressSha256Block(bytes, offset, state, words) {
  for (let i = 0; i < 16; i += 1) {
    const start = offset + i * 4;
    words[i] = (bytes[start] << 24) | (bytes[start + 1] << 16) | (bytes[start + 2] << 8) | bytes[start + 3];
  }
  for (let i = 16; i < 64; i += 1) {
    const a = words[i - 15];
    const b = words[i - 2];
    const smallSigma0 = rotateSha256Right(a, 7) ^ rotateSha256Right(a, 18) ^ (a >>> 3);
    const smallSigma1 = rotateSha256Right(b, 17) ^ rotateSha256Right(b, 19) ^ (b >>> 10);
    words[i] = (words[i - 16] + smallSigma0 + words[i - 7] + smallSigma1) >>> 0;
  }

  let [a, b, c, d, e, f, g, h] = state;
  for (let i = 0; i < 64; i += 1) {
    const bigSigma1 = rotateSha256Right(e, 6) ^ rotateSha256Right(e, 11) ^ rotateSha256Right(e, 25);
    const choose = (e & f) ^ (~e & g);
    const temp1 = (h + bigSigma1 + choose + SHA256_ROUND_CONSTANTS[i] + words[i]) >>> 0;
    const bigSigma0 = rotateSha256Right(a, 2) ^ rotateSha256Right(a, 13) ^ rotateSha256Right(a, 22);
    const majority = (a & b) ^ (a & c) ^ (b & c);
    const temp2 = (bigSigma0 + majority) >>> 0;
    h = g;
    g = f;
    f = e;
    e = (d + temp1) >>> 0;
    d = c;
    c = b;
    b = a;
    a = (temp1 + temp2) >>> 0;
  }
  state[0] = (state[0] + a) >>> 0;
  state[1] = (state[1] + b) >>> 0;
  state[2] = (state[2] + c) >>> 0;
  state[3] = (state[3] + d) >>> 0;
  state[4] = (state[4] + e) >>> 0;
  state[5] = (state[5] + f) >>> 0;
  state[6] = (state[6] + g) >>> 0;
  state[7] = (state[7] + h) >>> 0;
}

function rotateSha256Right(value, count) {
  return (value >>> count) | (value << (32 - count));
}
