import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { prisma } from './prisma';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be configured and at least 32 characters');
}

export interface AuthUser {
  id: string;
  email: string;
  role: 'STUDENT' | 'LECTURER' | 'ADMIN';
  name: string;
  avatar?: string | null;
}

export function signToken(user: { id: string; email: string; role: string; name: string }): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function comparePassword(plain: string, hashed: string): boolean {
  return bcrypt.compareSync(plain, hashed);
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export type AuthenticatedRequest = Request;

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.cookies?.token as string);

  if (!token) {
    return res.status(401).json({ error: 'Chưa đăng nhập', code: 'UNAUTHORIZED' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn', code: 'UNAUTHORIZED' });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user) {
    return res.status(401).json({ error: 'Người dùng không tồn tại', code: 'UNAUTHORIZED' });
  }
  if (user.locked) {
    return res.status(403).json({ error: 'Tài khoản đã bị khoá', code: 'LOCKED' });
  }

  req.user = { id: user.id, email: user.email, role: user.role as any, name: user.name };
  next();
}
