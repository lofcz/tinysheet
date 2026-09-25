/**
 * Password hashes of sheet / workbook protection, as Excel writes them:
 *
 * - the iterated hash of ECMA-376 (`algorithmName`, `hashValue`,
 *   `saltValue`, `spinCount`): H0 = H(salt + UTF-16LE password), then
 *   Hn = H(Hn-1 + uint32le(n - 1)) spinCount times. Computed with WebCrypto
 *   (`crypto.subtle`); where it is missing (pages not served from a secure
 *   origin) a built-in SHA-512 is used instead.
 * - the legacy 16-bit hash of the xlsx `password` attribute (read support:
 *   files written by old Excel versions and other tools).
 *
 * Passwords themselves are never stored.
 */
import type { ProtectionPasswordHash } from "../types";

/** Excel's default number of hash iterations. */
export const DEFAULT_SPIN_COUNT = 100000;

/* ---- SHA-512 (fallback when WebCrypto is unavailable) ------------------- */

// Round constants and initial hash (FIPS 180-4), as 32-bit hi/lo pairs.
const K = new Int32Array([
  0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd, 0xb5c0fbcf, 0xec4d3b2f,
  0xe9b5dba5, 0x8189dbbc, 0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019,
  0x923f82a4, 0xaf194f9b, 0xab1c5ed5, 0xda6d8118, 0xd807aa98, 0xa3030242,
  0x12835b01, 0x45706fbe, 0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2,
  0x72be5d74, 0xf27b896f, 0x80deb1fe, 0x3b1696b1, 0x9bdc06a7, 0x25c71235,
  0xc19bf174, 0xcf692694, 0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3,
  0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc, 0x77ac9c65, 0x2de92c6f, 0x592b0275,
  0x4a7484aa, 0x6ea6e483, 0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5,
  0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210, 0xb00327c8, 0x98fb213f,
  0xbf597fc7, 0xbeef0ee4, 0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725,
  0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70, 0x27b70a85, 0x46d22ffc,
  0x2e1b2138, 0x5c26c926, 0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df,
  0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8, 0x81c2c92e, 0x47edaee6,
  0x92722c85, 0x1482353b, 0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001,
  0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30, 0xd192e819, 0xd6ef5218,
  0xd6990624, 0x5565a910, 0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8,
  0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53, 0x2748774c, 0xdf8eeb99,
  0x34b0bcb5, 0xe19b48a8, 0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb,
  0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3, 0x748f82ee, 0x5defb2fc,
  0x78a5636f, 0x43172f60, 0x84c87814, 0xa1f0ab72, 0x8cc70208, 0x1a6439ec,
  0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9, 0xbef9a3f7, 0xb2c67915,
  0xc67178f2, 0xe372532b, 0xca273ece, 0xea26619c, 0xd186b8c7, 0x21c0c207,
  0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178, 0x06f067aa, 0x72176fba,
  0x0a637dc5, 0xa2c898a6, 0x113f9804, 0xbef90dae, 0x1b710b35, 0x131c471b,
  0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493, 0x3c9ebe0a, 0x15c9bebc,
  0x431d67c4, 0x9c100d4c, 0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a,
  0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817,
]);
const IV = new Int32Array([
  0x6a09e667, 0xf3bcc908, 0xbb67ae85, 0x84caa73b, 0x3c6ef372, 0xfe94f82b,
  0xa54ff53a, 0x5f1d36f1, 0x510e527f, 0xade682d1, 0x9b05688c, 0x2b3e6c1f,
  0x1f83d9ab, 0xfb41bd6b, 0x5be0cd19, 0x137e2179,
]);

/** SHA-512 of `msg` (synchronous, plain JavaScript). */
export function sha512(msg: Uint8Array): Uint8Array {
  const k = K;
  const len = msg.length;
  const blocks = Math.ceil((len + 17) / 128);
  const buf = new Uint8Array(blocks * 128);
  buf.set(msg);
  buf[len] = 0x80;
  const view = new DataView(buf.buffer);
  const bits = len * 8;
  view.setUint32(buf.length - 8, Math.floor(bits / 0x100000000));
  view.setUint32(buf.length - 4, bits >>> 0);
  const H = Int32Array.from(IV);
  const W = new Int32Array(160);
  for (let b = 0; b < blocks; b += 1) {
    const off = b * 128;
    for (let i = 0; i < 32; i += 1) W[i] = view.getInt32(off + i * 4);
    for (let i = 16; i < 80; i += 1) {
      // σ0(w[i-15]) = rotr1 ^ rotr8 ^ shr7
      let h = W[(i - 15) * 2];
      let l = W[(i - 15) * 2 + 1];
      const s0h = ((h >>> 1) | (l << 31)) ^ ((h >>> 8) | (l << 24)) ^ (h >>> 7);
      const s0l =
        ((l >>> 1) | (h << 31)) ^
        ((l >>> 8) | (h << 24)) ^
        ((l >>> 7) | (h << 25));
      // σ1(w[i-2]) = rotr19 ^ rotr61 ^ shr6
      h = W[(i - 2) * 2];
      l = W[(i - 2) * 2 + 1];
      const s1h =
        ((h >>> 19) | (l << 13)) ^ ((l >>> 29) | (h << 3)) ^ (h >>> 6);
      const s1l =
        ((l >>> 19) | (h << 13)) ^
        ((h >>> 29) | (l << 3)) ^
        ((l >>> 6) | (h << 26));
      const lo =
        (s0l >>> 0) +
        (s1l >>> 0) +
        (W[(i - 7) * 2 + 1] >>> 0) +
        (W[(i - 16) * 2 + 1] >>> 0);
      W[i * 2] =
        (s0h +
          s1h +
          W[(i - 7) * 2] +
          W[(i - 16) * 2] +
          Math.floor(lo / 0x100000000)) |
        0;
      W[i * 2 + 1] = lo | 0;
    }
    let ah = H[0];
    let al = H[1];
    let bh = H[2];
    let bl = H[3];
    let ch = H[4];
    let cl = H[5];
    let dh = H[6];
    let dl = H[7];
    let eh = H[8];
    let el = H[9];
    let fh = H[10];
    let fl = H[11];
    let gh = H[12];
    let gl = H[13];
    let hh = H[14];
    let hl = H[15];
    for (let i = 0; i < 80; i += 1) {
      // Σ1(e) = rotr14 ^ rotr18 ^ rotr41
      const S1h =
        ((eh >>> 14) | (el << 18)) ^
        ((eh >>> 18) | (el << 14)) ^
        ((el >>> 9) | (eh << 23));
      const S1l =
        ((el >>> 14) | (eh << 18)) ^
        ((el >>> 18) | (eh << 14)) ^
        ((eh >>> 9) | (el << 23));
      const chh = (eh & fh) ^ (~eh & gh);
      const chl = (el & fl) ^ (~el & gl);
      const t1lo =
        (hl >>> 0) +
        (S1l >>> 0) +
        (chl >>> 0) +
        (k[i * 2 + 1] >>> 0) +
        (W[i * 2 + 1] >>> 0);
      const t1h =
        (hh +
          S1h +
          chh +
          k[i * 2] +
          W[i * 2] +
          Math.floor(t1lo / 0x100000000)) |
        0;
      const t1l = t1lo | 0;
      // Σ0(a) = rotr28 ^ rotr34 ^ rotr39
      const S0h =
        ((ah >>> 28) | (al << 4)) ^
        ((al >>> 2) | (ah << 30)) ^
        ((al >>> 7) | (ah << 25));
      const S0l =
        ((al >>> 28) | (ah << 4)) ^
        ((ah >>> 2) | (al << 30)) ^
        ((ah >>> 7) | (al << 25));
      const majh = (ah & bh) ^ (ah & ch) ^ (bh & ch);
      const majl = (al & bl) ^ (al & cl) ^ (bl & cl);
      const t2lo = (S0l >>> 0) + (majl >>> 0);
      const t2h = (S0h + majh + Math.floor(t2lo / 0x100000000)) | 0;
      const t2l = t2lo | 0;
      hh = gh;
      hl = gl;
      gh = fh;
      gl = fl;
      fh = eh;
      fl = el;
      const elo = (dl >>> 0) + (t1l >>> 0);
      eh = (dh + t1h + Math.floor(elo / 0x100000000)) | 0;
      el = elo | 0;
      dh = ch;
      dl = cl;
      ch = bh;
      cl = bl;
      bh = ah;
      bl = al;
      const alo = (t1l >>> 0) + (t2l >>> 0);
      ah = (t1h + t2h + Math.floor(alo / 0x100000000)) | 0;
      al = alo | 0;
    }
    const add = (i: number, xh: number, xl: number) => {
      const lo = (H[i + 1] >>> 0) + (xl >>> 0);
      H[i] = (H[i] + xh + Math.floor(lo / 0x100000000)) | 0;
      H[i + 1] = lo | 0;
    };
    add(0, ah, al);
    add(2, bh, bl);
    add(4, ch, cl);
    add(6, dh, dl);
    add(8, eh, el);
    add(10, fh, fl);
    add(12, gh, gl);
    add(14, hh, hl);
  }
  const out = new Uint8Array(64);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 16; i += 1) ov.setInt32(i * 4, H[i]);
  return out;
}

/* ---- helpers ------------------------------------------------------------ */

function getCrypto(): Crypto | undefined {
  return typeof globalThis !== "undefined"
    ? (globalThis as any).crypto
    : undefined;
}

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromBase64(text: string) {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out;
}

function utf16le(text: string) {
  const out = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    out[i * 2] = code & 0xff;
    out[i * 2 + 1] = code >> 8;
  }
  return out;
}

/** WebCrypto's name of an ECMA-376 algorithm name ("SHA-512", "SHA512"). */
function webCryptoName(algorithmName: string) {
  const m = /^sha-?(1|256|384|512)$/i.exec(algorithmName.trim());
  return m ? `SHA-${m[1]}` : null;
}

function randomBytes(n: number) {
  const out = new Uint8Array(n);
  const c = getCrypto();
  if (c?.getRandomValues) {
    c.getRandomValues(out);
  } else {
    for (let i = 0; i < n; i += 1) out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

/**
 * Excel's iterated password hash. `algorithm` is a WebCrypto name; SHA-512
 * works without WebCrypto too (null for other algorithms then).
 */
export async function iteratedPasswordHash(
  password: string,
  salt: Uint8Array,
  algorithm: string,
  spinCount: number
): Promise<Uint8Array | null> {
  const subtle = getCrypto()?.subtle;
  const first = new Uint8Array(salt.length + password.length * 2);
  first.set(salt, 0);
  first.set(utf16le(password), salt.length);
  if (!subtle) {
    if (algorithm !== "SHA-512") return null;
    let h = sha512(first);
    const buf = new Uint8Array(68);
    const view = new DataView(buf.buffer);
    for (let i = 0; i < spinCount; i += 1) {
      buf.set(h, 0);
      view.setUint32(64, i, true);
      h = sha512(buf);
    }
    return h;
  }
  let h = new Uint8Array(await subtle.digest(algorithm, first));
  const buf = new Uint8Array(h.length + 4);
  const view = new DataView(buf.buffer);
  for (let i = 0; i < spinCount; i += 1) {
    buf.set(h, 0);
    view.setUint32(h.length, i, true);
    // eslint-disable-next-line no-await-in-loop
    h = new Uint8Array(await subtle.digest(algorithm, buf));
  }
  return h;
}

/**
 * Hash a new protection password the way Excel does (SHA-512, 16-byte
 * random salt). An empty password means no password: returns {}.
 */
export async function hashProtectionPassword(
  password: string,
  spinCount = DEFAULT_SPIN_COUNT
): Promise<ProtectionPasswordHash> {
  if (!password) return {};
  const salt = randomBytes(16);
  const hash = await iteratedPasswordHash(password, salt, "SHA-512", spinCount);
  return {
    algorithmName: "SHA-512",
    hashValue: toBase64(hash!),
    saltValue: toBase64(salt),
    spinCount,
  };
}

/** The legacy (Excel 97-2003) 16-bit password hash, 4 uppercase hex digits. */
export function legacyPasswordHash(password: string) {
  let hash = 0;
  for (let i = 0; i < password.length; i += 1) {
    let value = password.charCodeAt(i) << (i + 1);
    const rotated = value >> 15;
    value &= 0x7fff;
    hash ^= value | rotated;
  }
  hash ^= password.length;
  hash ^= 0xce4b;
  return hash.toString(16).toUpperCase().padStart(4, "0");
}

/** True when the stored hash asks for a password. */
export function hasProtectionPassword(stored?: ProtectionPasswordHash | null) {
  if (!stored) return false;
  return !!(stored.hashValue || stored.legacyHash || stored.password);
}

/** The hash fields of a protection object (to copy them around). */
export function pickPasswordHash(
  stored?: ProtectionPasswordHash | null
): ProtectionPasswordHash {
  const out: ProtectionPasswordHash = {};
  if (!stored) return out;
  if (stored.hashValue) {
    out.algorithmName = stored.algorithmName;
    out.hashValue = stored.hashValue;
    out.saltValue = stored.saltValue;
    out.spinCount = stored.spinCount;
  }
  if (stored.legacyHash) out.legacyHash = stored.legacyHash;
  return out;
}

/**
 * Does `password` match the stored hash? True when nothing is stored.
 * Luckysheet data may hold a plain-text password (algorithmName "None").
 */
export async function verifyProtectionPassword(
  stored: ProtectionPasswordHash | null | undefined,
  password: string
): Promise<boolean> {
  if (!hasProtectionPassword(stored)) return true;
  const s = stored!;
  if (s.hashValue) {
    const algorithm = webCryptoName(s.algorithmName || "SHA-512");
    if (!algorithm) return false;
    const hash = await iteratedPasswordHash(
      password,
      s.saltValue ? fromBase64(s.saltValue) : new Uint8Array(0),
      algorithm,
      Number(s.spinCount ?? 0)
    );
    return hash != null && toBase64(hash) === s.hashValue;
  }
  if (s.legacyHash) {
    return (
      legacyPasswordHash(password) ===
      s.legacyHash.toUpperCase().padStart(4, "0")
    );
  }
  if (s.password != null && (!s.algorithmName || s.algorithmName === "None")) {
    return password === s.password;
  }
  return false;
}
