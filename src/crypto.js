const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PREFIX = "enc:v1:";

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function encryptionKey(env) {
  if (!env.TOKEN_ENCRYPTION_KEY) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not configured");
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(env.TOKEN_ENCRYPTION_KEY)
  );

  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export function isEncryptedToken(value) {
  return String(value || "").startsWith(PREFIX);
}

export async function encryptToken(env, token) {
  const value = String(token || "").trim();
  if (!value) throw new Error("KeyCRM token is empty");
  if (isEncryptedToken(value)) return value;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(env);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(value)
  );

  return `${PREFIX}${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(encrypted))}`;
}

export async function decryptToken(env, storedValue) {
  const value = String(storedValue || "");
  if (!value) throw new Error("KeyCRM token is missing");

  // Backward compatibility for connections created before encryption was enabled.
  // They are transparently migrated to encrypted storage when getClient() loads them.
  if (!isEncryptedToken(value)) return value;

  const payload = value.slice(PREFIX.length);
  const separator = payload.indexOf(":");
  if (separator < 1) throw new Error("Encrypted KeyCRM token has invalid format");

  const iv = base64ToBytes(payload.slice(0, separator));
  const ciphertext = base64ToBytes(payload.slice(separator + 1));
  const key = await encryptionKey(env);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return decoder.decode(decrypted);
}
