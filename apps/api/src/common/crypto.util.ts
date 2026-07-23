import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const hex = process.env.SECRETS_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'SECRETS_ENCRYPTION_KEY must be set to a 32-byte (64 hex char) key — see .env.example',
    );
  }
  return Buffer.from(hex, 'hex');
}

/** Encrypts a secret for storage. Output format: iv:authTag:ciphertext (all hex). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/** Reverses encryptSecret. Throws if the value was tampered with or the key is wrong. */
export function decryptSecret(stored: string): string {
  const [ivHex, authTagHex, ciphertextHex] = stored.split(':');
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/** Last 4 chars visible, rest masked — for showing "is a token configured" without leaking it. */
export function maskSecret(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  const tail = plaintext.slice(-4);
  return `${'•'.repeat(8)}${tail}`;
}
