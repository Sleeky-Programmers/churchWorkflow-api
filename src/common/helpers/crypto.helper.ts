import * as crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const secretKey = crypto
  .createHash('sha256')
  .update(`${process.env.INVITE_SECRET}`)
  .digest();

export function encryptInvite(payload: object) {
  const initializationVector = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    algorithm,
    secretKey,
    initializationVector,
  );

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return Buffer.concat([initializationVector, authTag, encrypted]).toString(
    'base64url',
  );
}

export function decryptInvite(token: string): any {
  const buffer = Buffer.from(token, 'base64url');

  const initializationVector = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);

  const decipher = crypto.createDecipheriv(
    algorithm,
    secretKey,
    initializationVector,
  );
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}
