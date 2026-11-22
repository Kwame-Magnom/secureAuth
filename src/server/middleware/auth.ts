import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db';
import crypto from 'crypto';

// Extend Express Request type to include user session data
export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  status: string;
  roles: string[];
  sessionId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      clientIp?: string;
    }
  }
}

/**
 * Helper to record audit log events in the database.
 */
export async function recordAuditLog(
  userId: string | null,
  username: string | null,
  eventType: string,
  description: string,
  ipAddress: string | null,
  status: 'success' | 'failure' | 'unauthorized' = 'success'
) {
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      username: username,
      event_type: eventType,
      description: description,
      ip_address: ipAddress,
      status: status,
    });
  } catch (err) {
    console.error('Failed to record audit log:', err);
  }
}

/**
 * Middleware to extract client IP address.
 */
export function ipMiddleware(req: Request, res: Response, next: NextFunction) {
  const forwarded = req.headers['x-forwarded-for'];
  req.clientIp = typeof forwarded === 'string' 
    ? forwarded.split(',')[0].trim() 
    : req.socket.remoteAddress || '127.0.0.1';
  next();
}

/**
 * Authentication middleware to verify secure HTTP-only session tokens.
 */
export async function authenticateSession(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.secureauth_session || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. No session token provided.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Query session
    const { data: sessionData, error: sessionError } = await supabase
      .from('login_sessions')
      .select('id, user_id, expires_at')
      .eq('token_hash', tokenHash)
      .single();

    if (sessionError || !sessionData) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }

    if (new Date(sessionData.expires_at) < new Date()) {
      // Clean up expired session
      await supabase.from('login_sessions').delete().eq('id', sessionData.id);
      return res.status(401).json({ error: 'Session has expired.' });
    }

    // Fetch user details & roles
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, username, email, full_name, status')
      .eq('id', sessionData.user_id)
      .single();

    if (userError || !userData || userData.status !== 'active') {
      return res.status(403).json({ error: 'Account is inactive, suspended, or does not exist.' });
    }

    // Fetch user roles
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', userData.id);

    const roles: string[] = [];
    if (!roleError && roleData) {
      for (const ur of roleData) {
        if (ur.roles && (ur.roles as any).name) {
          roles.push((ur.roles as any).name);
        }
      }
    }

    req.user = {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      full_name: userData.full_name,
      status: userData.status,
      roles: roles.length > 0 ? roles : ['REGULAR_USER'],
      sessionId: sessionData.id,
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
}

/**
 * Role-Based Access Control (RBAC) middleware generator.
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized access.' });
    }

    const hasPermission = req.user.roles.some(role => allowedRoles.includes(role));

    if (!hasPermission) {
      recordAuditLog(
        req.user.id,
        req.user.username,
        'UNAUTHORIZED_ACCESS_ATTEMPT',
        `User attempted to access restricted endpoint requiring roles: ${allowedRoles.join(', ')}`,
        req.clientIp || null,
        'unauthorized'
      );
      return res.status(403).json({ error: 'Forbidden: You do not have sufficient permissions to access this resource.' });
    }

    next();
  };
}
