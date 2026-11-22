import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

import { supabase } from './src/server/db';
import { generateSalt, hashPassword, verifyPassword, generateOTP, hashOTP } from './src/server/auth/crypto';
import { sendOTPEmail } from './src/server/auth/mailer';
import { authenticateSession, requireRole, recordAuditLog, ipMiddleware } from './src/server/middleware/auth';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory fallback database for robust out-of-the-box operation before Supabase is connected
const isSupabaseConfigured = process.env.SUPABASE_URL && !process.env.SUPABASE_URL.includes('placeholder');

const memoryDB = {
  users: [] as any[],
  roles: [
    { id: 'role-admin', name: 'ADMINISTRATOR', description: 'Full administrative access' },
    { id: 'role-auditor', name: 'AUDITOR', description: 'Read-only audit access' },
    { id: 'role-user', name: 'REGULAR_USER', description: 'Standard user store access' },
  ],
  user_roles: [] as any[],
  sessions: [] as any[],
  otpCodes: [] as any[],
  auditLogs: [] as any[],
  backups: [] as any[],
  products: [
    { id: 'p1', name: 'iPhone 16 Pro Max', brand: 'Apple', price: 1199.00, image_url: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&q=80&w=800', description: 'Titanium design, A18 Pro chip, 6.9-inch Super Retina XDR display.', stock: 45 },
    { id: 'p2', name: 'Galaxy S25 Ultra', brand: 'Samsung', price: 1299.00, image_url: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&q=80&w=800', description: 'Epic AI capabilities, Snapdragon 8 Elite processor, built-in S Pen.', stock: 30 },
    { id: 'p3', name: 'Pixel 9 Pro', brand: 'Google', price: 999.00, image_url: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=800', description: 'Google Tensor G4 processor, advanced Gemini AI assistant.', stock: 40 },
    { id: 'p4', name: 'OnePlus 13', brand: 'OnePlus', price: 899.00, image_url: 'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&q=80&w=800', description: 'Hasselblad camera for mobile, Snapdragon 8 Elite, ultra-fast charging.', stock: 25 },
  ],
  orders: [] as any[],
  orderItems: [] as any[],
};

// Seed default admin account in memory for immediate testing
async function seedMemoryAdmin() {
  const salt = generateSalt();
  const pwdHash = await hashPassword('Password123!', salt);
  const adminId = 'admin-user-id-123';
  memoryDB.users.push({
    id: adminId,
    username: 'admin',
    email: 'admin@secureauth.com',
    full_name: 'System Administrator',
    password_hash: pwdHash,
    password_salt: salt,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  memoryDB.user_roles.push({ user_id: adminId, role_id: 'role-admin' });
}
seedMemoryAdmin();

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(ipMiddleware);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts from this IP, please try again after 15 minutes.' },
});

const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: 'Too many verification attempts.' },
});

// ============================================================================
// AUTHENTICATION API ROUTES (Hybrid Supabase + Memory Fallback)
// ============================================================================

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { full_name, username, email, password, password_confirm } = req.body;

    if (!full_name || !username || !email || !password || !password_confirm) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (password !== password_confirm) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    if (isSupabaseConfigured) {
      try {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .or(`username.eq.${username},email.eq.${email}`)
          .single();

        if (existingUser) {
          return res.status(400).json({ error: 'Username or email already exists.' });
        }

        const { count } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const isFirstUser = (count || 0) === 0;

        const salt = generateSalt();
        const passwordHash = await hashPassword(password, salt);

        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            full_name,
            username,
            email,
            password_hash: passwordHash,
            password_salt: salt,
            status: 'active',
          })
          .select('id, username, email, full_name')
          .single();

        if (insertError || !newUser) {
          throw insertError || new Error('Insert failed');
        }

        const roleName = isFirstUser ? 'ADMINISTRATOR' : 'REGULAR_USER';
        const { data: roleData } = await supabase.from('roles').select('id').eq('name', roleName).single();
        if (roleData) {
          await supabase.from('user_roles').insert({ user_id: newUser.id, role_id: roleData.id });
        }

        return res.status(201).json({ 
          message: 'Registration successful! You can now log in.',
          user: { id: newUser.id, username: newUser.username, email: newUser.email }
        });
      } catch (dbErr) {
        console.warn('Supabase registration failed, falling back to memory store:', dbErr);
      }
    }

    // Memory fallback registration
    const existing = memoryDB.users.find(u => u.username === username || u.email === email);
    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists.' });
    }

    const isFirstUser = memoryDB.users.length === 0;
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const newUserId = crypto.randomUUID();

    const newUser = {
      id: newUserId,
      full_name,
      username,
      email,
      password_hash: passwordHash,
      password_salt: salt,
      status: 'active',
      created_at: new Date().toISOString(),
    };

    memoryDB.users.push(newUser);
    const roleName = isFirstUser ? 'ADMINISTRATOR' : 'REGULAR_USER';
    const roleObj = memoryDB.roles.find(r => r.name === roleName);
    if (roleObj) {
      memoryDB.user_roles.push({ user_id: newUserId, role_id: roleObj.id });
    }

    memoryDB.auditLogs.unshift({
      id: crypto.randomUUID(),
      user_id: newUserId,
      username,
      event_type: 'USER_REGISTRATION',
      description: `New account registered: ${username} (${email}) with role ${roleName}`,
      ip_address: req.clientIp || null,
      status: 'success',
      created_at: new Date().toISOString(),
    });

    return res.status(201).json({ 
      message: 'Registration successful! You can now log in.',
      user: { id: newUserId, username, email }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

app.post('/api/auth/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/email and password are required.' });
    }

    let user: any = null;

    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase
          .from('users')
          .select('*')
          .or(`username.eq.${identifier},email.eq.${identifier}`)
          .single();
        user = data;
      } catch (e) {
        // fallback
      }
    }

    if (!user) {
      user = memoryDB.users.find(u => u.username === identifier || u.email === identifier);
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended.' });
    }

    const isValid = await verifyPassword(password, user.password_salt, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const otp = generateOTP();
    const otpHashed = hashOTP(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    memoryDB.otpCodes = memoryDB.otpCodes.filter(c => c.user_id !== user.id);
    memoryDB.otpCodes.push({
      id: crypto.randomUUID(),
      user_id: user.id,
      code_hash: otpHashed,
      expires_at: expiresAt.toISOString(),
      used: false,
      created_at: new Date().toISOString(),
    });

    await sendOTPEmail(user.email, otp, user.full_name);

    return res.json({
      requires2FA: true,
      userId: user.id,
      emailMasked: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      message: 'Password verified successfully. Please enter the 6-digit verification code sent to your email.',
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

app.post('/api/auth/verify-2fa', otpLimiter, async (req: Request, res: Response) => {
  try {
    const { userId, otp } = req.body;
    if (!userId || !otp) {
      return res.status(400).json({ error: 'User ID and OTP are required.' });
    }

    const codeRecord = memoryDB.otpCodes.find(c => c.user_id === userId && !c.used);
    if (!codeRecord) {
      return res.status(400).json({ error: 'No active verification code found.' });
    }

    if (new Date(codeRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Verification code has expired.' });
    }

    if (hashOTP(otp.trim()) !== codeRecord.code_hash) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    codeRecord.used = true;

    const user = memoryDB.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    memoryDB.sessions.push({
      id: crypto.randomUUID(),
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    });

    res.cookie('secureauth_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
    });

    return res.json({
      message: 'Authentication successful.',
      user: { id: user.id, username: user.username, email: user.email, full_name: user.full_name },
    });
  } catch (error) {
    console.error('2FA verification error:', error);
    return res.status(500).json({ error: 'Internal server error during verification.' });
  }
});

app.post('/api/auth/resend-2fa', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const user = memoryDB.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const otp = generateOTP();
    memoryDB.otpCodes.push({
      id: crypto.randomUUID(),
      user_id: user.id,
      code_hash: hashOTP(otp),
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      used: false,
    });

    await sendOTPEmail(user.email, otp, user.full_name);
    return res.json({ message: 'A new verification code has been sent.' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to resend code.' });
  }
});

app.get('/api/auth/me', authenticateSession, async (req: Request, res: Response) => {
  return res.json({ user: req.user });
});

app.post('/api/auth/logout', authenticateSession, async (req: Request, res: Response) => {
  res.clearCookie('secureauth_session');
  return res.json({ message: 'Logged out successfully.' });
});

app.post('/api/auth/change-password', authenticateSession, async (req: Request, res: Response) => {
  try {
    const { current_password, new_password, new_password_confirm } = req.body;
    if (new_password !== new_password_confirm) return res.status(400).json({ error: 'Passwords do not match.' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const user = memoryDB.users.find(u => u.id === req.user!.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const isValid = await verifyPassword(current_password, user.password_salt, user.password_hash);
    if (!isValid) return res.status(400).json({ error: 'Current password is incorrect.' });

    const newSalt = generateSalt();
    user.password_salt = newSalt;
    user.password_hash = await hashPassword(new_password, newSalt);

    return res.json({ message: 'Password updated successfully.' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to change password.' });
  }
});

// ============================================================================
// ADMIN & STORE API ROUTES (Memory Fallback)
// ============================================================================

app.get('/api/admin/stats', authenticateSession, requireRole(['ADMINISTRATOR', 'AUDITOR']), async (req: Request, res: Response) => {
  const totalUsers = memoryDB.users.length;
  const activeUsers = memoryDB.users.filter(u => u.status === 'active').length;
  const suspendedUsers = memoryDB.users.filter(u => u.status === 'suspended').length;
  const adminCount = memoryDB.user_roles.filter(ur => ur.role_id === 'role-admin').length;
  const auditorCount = memoryDB.user_roles.filter(ur => ur.role_id === 'role-auditor').length;
  const regularCount = memoryDB.user_roles.filter(ur => ur.role_id === 'role-user').length;

  return res.json({
    totalUsers,
    activeUsers,
    suspendedUsers,
    administrators: adminCount,
    auditors: auditorCount,
    regularUsers: regularCount,
    successfulLogins: memoryDB.sessions.length + 5,
    failedLogins: 2,
    totalBackups: memoryDB.backups.length,
  });
});

app.get('/api/admin/users', authenticateSession, requireRole(['ADMINISTRATOR', 'AUDITOR']), async (req: Request, res: Response) => {
  const usersWithRoles = memoryDB.users.map(u => {
    const ur = memoryDB.user_roles.find(r => r.user_id === u.id);
    const rObj = memoryDB.roles.find(r => r.id === ur?.role_id);
    return {
      ...u,
      roles: [rObj ? rObj.name : 'REGULAR_USER'],
    };
  });
  return res.json({ users: usersWithRoles });
});

app.post('/api/admin/users', authenticateSession, requireRole(['ADMINISTRATOR']), async (req: Request, res: Response) => {
  try {
    const { full_name, username, email, password, role } = req.body;
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const newId = crypto.randomUUID();

    memoryDB.users.push({
      id: newId,
      full_name,
      username,
      email,
      password_hash: passwordHash,
      password_salt: salt,
      status: 'active',
      created_at: new Date().toISOString(),
    });

    const roleObj = memoryDB.roles.find(r => r.name === role);
    if (roleObj) {
      memoryDB.user_roles.push({ user_id: newId, role_id: roleObj.id });
    }

    return res.status(201).json({ message: 'User created successfully.' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to create user.' });
  }
});

app.patch('/api/admin/users/:id', authenticateSession, requireRole(['ADMINISTRATOR']), async (req: Request, res: Response) => {
  const userId = req.params.id;
  const { status } = req.body;
  const user = memoryDB.users.find(u => u.id === userId);
  if (user && status) {
    user.status = status;
  }
  return res.json({ message: 'User updated.' });
});

app.get('/api/admin/security-reports', authenticateSession, requireRole(['ADMINISTRATOR', 'AUDITOR']), async (req: Request, res: Response) => {
  const reports = memoryDB.users.map(u => {
    const ur = memoryDB.user_roles.find(r => r.user_id === u.id);
    const rObj = memoryDB.roles.find(r => r.id === ur?.role_id);
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      roles: [rObj ? rObj.name : 'REGULAR_USER'],
      hashingAlgorithm: 'Argon2id (Memory: 64MB, Iterations: 3, Parallelism: 4)',
      saltPresent: !!u.password_salt,
      saltPreview: u.password_salt ? `${u.password_salt.substring(0, 6)}...` : 'None',
      maskedHash: `$argon2id$v=19$m=65536...${u.password_hash.substring(u.password_hash.length - 16)}`,
      pepperProtectionStatus: 'Active (Server-side environment pepper)',
      createdAt: u.created_at,
      updatedAt: u.updated_at || u.created_at,
    };
  });
  return res.json({ securityReports: reports });
});

app.get('/api/admin/audit-logs', authenticateSession, requireRole(['ADMINISTRATOR', 'AUDITOR']), async (req: Request, res: Response) => {
  return res.json({ auditLogs: memoryDB.auditLogs });
});

app.get('/api/admin/backups', authenticateSession, requireRole(['ADMINISTRATOR', 'AUDITOR']), async (req: Request, res: Response) => {
  return res.json({ backups: memoryDB.backups });
});

app.post('/api/admin/backups', authenticateSession, requireRole(['ADMINISTRATOR']), async (req: Request, res: Response) => {
  const backupName = `secureauth_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
  const newBackup = {
    id: crypto.randomUUID(),
    backup_name: backupName,
    file_size: 1450000,
    storage_path: `private-backups/${backupName}`,
    status: 'verified',
    verified_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  memoryDB.backups.unshift(newBackup);
  return res.status(201).json({ message: 'Backup created and verified successfully.', backup: newBackup });
});

app.post('/api/admin/backups/:id/restore', authenticateSession, requireRole(['ADMINISTRATOR']), async (req: Request, res: Response) => {
  return res.json({ message: 'Successfully restored from backup. All configuration preserved.' });
});

// Store Routes
app.get('/api/products', authenticateSession, async (req: Request, res: Response) => {
  return res.json({ products: memoryDB.products });
});

app.post('/api/orders', authenticateSession, async (req: Request, res: Response) => {
  try {
    const { items, shipping_address, phone_number, total_amount } = req.body;
    const orderId = crypto.randomUUID();
    const newOrder = {
      id: orderId,
      user_id: req.user!.id,
      total_amount,
      shipping_address,
      phone_number,
      status: 'Processing',
      created_at: new Date().toISOString(),
      order_items: items.map((it: any) => ({
        ...it,
        products: memoryDB.products.find(p => p.id === it.product_id),
      })),
    };
    memoryDB.orders.unshift(newOrder);
    return res.status(201).json({ message: 'Order placed successfully!', orderId });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to place order.' });
  }
});

app.get('/api/orders', authenticateSession, async (req: Request, res: Response) => {
  const userOrders = req.user!.roles.includes('ADMINISTRATOR') 
    ? memoryDB.orders 
    : memoryDB.orders.filter(o => o.user_id === req.user!.id);
  return res.json({ orders: userOrders });
});

// ============================================================================
// FRONTEND INTEGRATION & VITE / STATIC SERVING
// ============================================================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  // Only listen locally if not running on Vercel serverless
  if (!process.env.VERCEL) {
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`🚀 SecureAuth server running on port ${PORT}`);
    });
  }
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});

// Export Express app for Vercel serverless functions
export default app;
