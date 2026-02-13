import * as crypto from 'crypto';

const algorithm = 'aes-256-gcm';

function getSecretKey(): Buffer {
  const secret = process.env.INVITE_SECRET;

  if (!secret) {
    throw new Error('Invite secret is not configured');
  }

  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptInvite(payload: object): string {
  try {
    if (!payload) {
      throw new Error('Payload is required for encryption');
    }

    const secretKey = getSecretKey();
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
  } catch (error) {
    throw new Error('Failed to generate invite token');
  }
}

export function decryptInvite(token: string): any {
  try {
    if (!token) {
      throw new Error('Token is required for decryption');
    }

    const secretKey = getSecretKey();
    const buffer = Buffer.from(token, 'base64url');

    if (buffer.length < 28) {
      throw new Error('Invalid invite token');
    }

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
  } catch (error) {
    throw new Error('Invalid or expired invite token');
  }
}
