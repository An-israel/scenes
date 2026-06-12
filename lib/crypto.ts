import crypto from "crypto";

// AES-256-GCM encryption for user API keys at rest.
// Stored format: base64(iv).base64(authTag).base64(ciphertext)

function deriveKey(): Buffer {
  const secret = process.env.APP_ENCRYPTION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("APP_ENCRYPTION_SECRET env var is missing or too short");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decryptSecret(stored: string): string {
  const key = deriveKey();
  const [ivB64, tagB64, dataB64] = stored.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted secret");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
