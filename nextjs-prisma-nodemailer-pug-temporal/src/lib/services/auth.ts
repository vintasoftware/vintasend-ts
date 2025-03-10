import { compare, hash } from 'bcryptjs';
import { sign, verify, type SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword);
}

export function generateToken(payload: object, expiresIn = '1d'): string {
  return sign(payload, JWT_SECRET, { expiresIn } as SignOptions);
}

export function verifyToken<T>(token: string): T {
  return verify(token, JWT_SECRET) as T;
}
