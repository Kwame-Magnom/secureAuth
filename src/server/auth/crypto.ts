import argon2 from 'argon2';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const PEPPER = process.env.PASSWORD_PEPPER || 'secureauth_default_pepper_key_2026';

/**
 * Generates a cryptographically secure random salt (16 bytes hex).
 */
export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Hashes a plaintext password using Argon2id with a unique salt and server-side pepper.
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  // Combine password + salt + pepper to protect against rainbow table attacks
  const pepperedPassword = password + salt + PEPPER;
  
  const hash = await argon2.hash(pepperedPassword, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });

  return hash;
}

/**
 * Verifies a plaintext password against the stored hash, salt, and pepper.
 */
export async function verifyPassword(password: string, salt: string, storedHash: string): Promise<boolean> {
  try {
    const pepperedPassword = password + salt + PEPPER;
    return await argon2.verify(storedHash, pepperedPassword);
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Generates a random 6-digit numeric OTP for two-factor authentication.
 */
export function generateOTP(): string {
  const buffer = crypto.randomBytes(3);
  const value = parseInt(buffer.toString('hex'), 16) % 1000000;
  return value.toString().padStart(6, '0');
}

/**
 * Hashes an OTP code for secure database storage.
 */
export function hashOTP(otp: string): string {
  return crypto.createHmac('sha256', PEPPER).update(otp).digest('hex');
}
