// Journal encryption (SPEC §10.3): AES-256-GCM via Web Crypto (works in edge + node).
// Key comes from JOURNAL_ENCRYPTION_KEY as base64 (32 bytes). Each entry gets a random nonce.
import { env } from './env';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function key(): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(env.journalKey()), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error('JOURNAL_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export interface EncryptedJournal {
  /** bytea column, hex string. */
  ciphertext: string;
  /** bytea column, hex string (12 bytes). */
  nonce: string;
}

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function encryptJournal(plaintext: string): Promise<EncryptedJournal> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    await key(),
    encoder.encode(plaintext),
  );
  return { ciphertext: toHex(ciphertext), nonce: toHex(nonce) };
}

/** Accepts bytea as hex ('deadbeef') or Postgres text form ('\\xdeadbeef'). */
export async function decryptJournal(ciphertext: string, nonce: string): Promise<string> {
  const strip = (h: string) => (h.startsWith('\\x') ? h.slice(2) : h);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromHex(strip(nonce)) as BufferSource },
    await key(),
    fromHex(strip(ciphertext)) as BufferSource,
  );
  return decoder.decode(plain);
}
