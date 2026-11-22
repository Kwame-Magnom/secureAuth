import React, { useState, useEffect } from 'react';
import { 
  Shield, Lock, User, Users, Key, FileText, Activity, Database, LogOut, 
  CheckCircle2, AlertTriangle, RefreshCw, Eye, EyeOff, Server, 
  LockKeyhole, UserCheck, UserX, Plus, ShieldAlert, ChevronRight, ArrowLeft,
  Smartphone, ShoppingCart, Package, CreditCard, Check
} from 'lucide-react';

interface UserSession {
  id: string;
  username: string;
  email: string;
  full_name: string;
  status: string;
  roles: string[];
}

interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  image_url: string;
  description: string;
  stock: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState<'login' | 'register' | '2fa'>('login');
  
  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loginUserId, setLoginUserId] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');

  // UI notifications
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Active navigation tab for dashboards / store
  const [activeTab, setActiveTab] = useState<'store' | 'orders' | 'overview' | 'users' | 'security' | 'audit' | 'backups' | 'profile'>('store');

  // Store states
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [shippingAddress, setShippingAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [checkoutModal, setCheckoutModal] = useState(false);

  // Admin dashboard data states
  const [stats, setStats] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [securityReports, setSecurityReports] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [backupsList, setBackupsList] = useState<any[]>([]);

  // Password change state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwdConfirm, setNewPwdConfirm] = useState('');

  // Create user modal state (Admin)
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUFullName, setNewUFullName] = useState('');
  const [newUUsername, setNewUUsername] = useState('');
  const [newUEmail, setNewUEmail] = useState('');
  const [newUPassword, setNewUPassword] = useState('');
  const [newURole, setNewURole] = useState('REGULAR_USER');

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.roles.includes('ADMINISTRATOR') || currentUser.roles.includes('AUDITOR')) {
        setActiveTab('overview');
      } else {
        setActiveTab('store');
        loadStoreData();
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && (activeTab === 'overview' || activeTab === 'users' || activeTab === 'security' || activeTab === 'audit' || activeTab === 'backups')) {
      loadAdminData();
    }
    if (currentUser && activeTab === 'orders') {
      loadOrders();
    }
  }, [activeTab]);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (res.ok && data.user) {
        setCurrentUser(data.user);
      }
    } catch (e) {
      console.error('Session check failed', e);
    } finally {
      setLoading(false);
    }
  };

  const loadStoreData = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const d = await res.json();
        setProducts(d.products || []);
      }
    } catch (e) {
      console.error('Failed to load products', e);
    }
  };

  const loadOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const d = await res.json();
        setOrders(d.orders || []);
      }
    } catch (e) {
      console.error('Failed to load orders', e);
    }
  };

  const loadAdminData = async () => {
    setErrorMsg('');
    try {
      if (activeTab === 'overview' || activeTab === 'users') {
        const statsRes = await fetch('/api/admin/stats');
        if (statsRes.ok) setStats(await statsRes.json());
      }
      if (activeTab === 'users' || activeTab === 'overview') {
        const usersRes = await fetch('/api/admin/users');
        if (usersRes.ok) {
          const d = await usersRes.json();
          setUsersList(d.users || []);
        }
      }
      if (activeTab === 'security') {
        const secRes = await fetch('/api/admin/security-reports');
        if (secRes.ok) {
          const d = await secRes.json();
          setSecurityReports(d.securityReports || []);
        }
      }
      if (activeTab === 'audit') {
        const auditRes = await fetch('/api/admin/audit-logs');
        if (auditRes.ok) {
          const d = await auditRes.json();
          setAuditLogs(d.auditLogs || []);
        }
      }
      if (activeTab === 'backups') {
        const backupRes = await fetch('/api/admin/backups');
        if (backupRes.ok) {
          const d = await backupRes.json();
          setBackupsList(d.backups || []);
        }
      }
    } catch (e) {
      console.error('Failed to load admin data', e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Login failed.');
        return;
      }
      if (data.requires2FA) {
        setLoginUserId(data.userId);
        setEmailMasked(data.emailMasked);
        setAuthView('2fa');
        setSuccessMsg(data.message);
      }
    } catch (err) {
      setErrorMsg('Network error during login.');
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: loginUserId, otp: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || '2FA verification failed.');
        return;
      }
      setCurrentUser(data.user);
      window.location.reload();
    } catch (err) {
      setErrorMsg('Verification error.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: regFullName,
          username: regUsername,
          email: regEmail,
          password: regPassword,
          password_confirm: regPasswordConfirm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Registration failed.');
        return;
      }
      setSuccessMsg(data.message);
      setAuthView('login');
    } catch (err) {
      setErrorMsg('Network error during registration.');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      window.location.reload();
    } catch (e) {
      console.error('Logout error', e);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { product, quantity: 1 }];
    });
    setSuccessMsg(`Added ${product.name} to your cart.`);
  };

  const updateCartQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const items = cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        price: item.product.price,
      }));

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          shipping_address: shippingAddress,
          phone_number: phoneNumber,
          total_amount: cartTotal,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to place order.');
        return;
      }

      setSuccessMsg(data.message);
      setCart([]);
      setCheckoutModal(false);
      setShippingAddress('');
      setPhoneNumber('');
      setActiveTab('orders');
    } catch (err) {
      setErrorMsg('Checkout network error.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPwd,
          new_password: newPwd,
          new_password_confirm: newPwdConfirm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to change password.');
        return;
      }
      setSuccessMsg(data.message);
      setCurrentPwd('');
      setNewPwd('');
      setNewPwdConfirm('');
    } catch (err) {
      setErrorMsg('Error updating password.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: newUFullName,
          username: newUUsername,
          email: newUEmail,
          password: newUPassword,
          role: newURole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to create user.');
        return;
      }
      setSuccessMsg(data.message);
      setShowCreateUserModal(false);
      setNewUFullName('');
      setNewUUsername('');
      setNewUEmail('');
      setNewUPassword('');
      loadAdminData();
    } catch (err) {
      setErrorMsg('Error creating user.');
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) loadAdminData();
    } catch (e) {
      console.error('Failed to toggle status', e);
    }
  };

  const handleCreateBackup = async () => {
    try {
      const res = await fetch('/api/admin/backups', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message);
        loadAdminData();
      } else {
        setErrorMsg(data.error);
      }
    } catch (e) {
      setErrorMsg('Failed to create backup.');
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to verify and restore from this backup point?')) return;
    try {
      const res = await fetch(`/api/admin/backups/${backupId}/restore`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message);
        loadAdminData();
      } else {
        setErrorMsg(data.error);
      }
    } catch (e) {
      setErrorMsg('Restoration failed.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-slate-800">
        <div className="flex items-center space-x-3">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-lg font-medium">Initializing SecureAuth & Phone Store...</span>
        </div>
      </div>
    );
  }

  // ============================================================================
  // AUTHENTICATION VIEWS (Login / Register / 2FA)
  // ============================================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center text-blue-600 shadow-lg">
              <Smartphone className="w-10 h-10" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-slate-900">
            SecureAuth Phone Store
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600">
            Secure Authentication & Mobile Phone Ordering Platform
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white border border-slate-200 py-8 px-4 shadow-xl sm:rounded-xl sm:px-10">
            {errorMsg && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-500" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-lg text-sm flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* LOGIN VIEW */}
            {authView === 'login' && (
              <form className="space-y-6" onSubmit={handleLogin}>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Username or Email</label>
                  <div className="mt-1">
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
                      placeholder="Enter username or email"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Password</label>
                  <div className="mt-1 relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm pr-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 transition-all"
                  >
                    Sign In
                  </button>
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setAuthView('register'); setErrorMsg(''); setSuccessMsg(''); }}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Don't have an account? Register here
                  </button>
                </div>
              </form>
            )}

            {/* 2FA VIEW */}
            {authView === '2fa' && (
              <form className="space-y-6" onSubmit={handleVerify2FA}>
                <div className="text-center">
                  <div className="inline-flex p-3 bg-blue-50 rounded-full text-blue-600 mb-3">
                    <LockKeyhole className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Two-Factor Authentication</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Enter the 6-digit OTP sent to your email ({emailMasked}).
                  </p>
                </div>

                <div>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="block w-full px-3 py-3 border border-slate-300 rounded-lg bg-white text-center text-2xl tracking-widest text-slate-900 font-mono"
                    placeholder="123456"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all"
                  >
                    Verify & Enter Store
                  </button>
                </div>
              </form>
            )}

            {/* REGISTER VIEW */}
            {authView === 'register' && (
              <form className="space-y-4" onSubmit={handleRegister}>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Full Name</label>
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Username</label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm"
                    placeholder="johndoe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Email Address</label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Password (Min 8 chars)</label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Confirm Password</label>
                  <input
                    type="password"
                    required
                    value={regPasswordConfirm}
                    onChange={(e) => setRegPasswordConfirm(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm"
                    placeholder="••••••••"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all"
                  >
                    Register Account
                  </button>
                </div>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => { setAuthView('login'); setErrorMsg(''); setSuccessMsg(''); }}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Already have an account? Sign in
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN APP VIEW (Phone Store for Regular Users / Admin Dashboard for Admins)
  // ============================================================================
  const isAdmin = currentUser.roles.includes('ADMINISTRATOR');
  const isAuditor = currentUser.roles.includes('AUDITOR');
  const isRegular = currentUser.roles.includes('REGULAR_USER') && !isAdmin && !isAuditor;

  return (
    <div className="min-h-screen bg-white text-slate-900 flex">
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col justify-between hidden md:flex">
        <div>
          <div className="p-6 border-b border-slate-200 flex items-center space-x-3">
            <div className="p-2 bg-blue-100 border border-blue-200 rounded-xl text-blue-600">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-lg">SecureAuth Store</h1>
              <p className="text-xs text-slate-500">Mobile Phone Shop</p>
            </div>
          </div>

          <nav className="p-4 space-y-1.5">
            {isRegular && (
              <>
                <button
                  onClick={() => { setActiveTab('store'); loadStoreData(); }}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    activeTab === 'store' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Phone Catalog</span>
                </button>

                <button
                  onClick={() => setActiveTab('orders')}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    activeTab === 'orders' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>My Orders</span>
                </button>
              </>
            )}

            {(isAdmin || isAuditor) && (
              <>
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    activeTab === 'overview' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  <span>{isAdmin ? 'Admin Dashboard' : 'Auditor Dashboard'}</span>
                </button>

                <button
                  onClick={() => setActiveTab('users')}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    activeTab === 'users' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>User Management</span>
                </button>

                <button
                  onClick={() => setActiveTab('security')}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    activeTab === 'security' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <Key className="w-4 h-4" />
                  <span>Password Security Reports</span>
                </button>

                <button
                  onClick={() => setActiveTab('audit')}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    activeTab === 'audit' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Audit Logs</span>
                </button>

                <button
                  onClick={() => setActiveTab('backups')}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    activeTab === 'backups' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <Database className="w-4 h-4" />
                  <span>Backups & Restoration</span>
                </button>
              </>
            )}

            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === 'profile' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Personal Profile</span>
            </button>
          </nav>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="truncate">
              <p className="text-sm font-semibold text-slate-900 truncate">{currentUser.full_name}</p>
              <p className="text-xs text-blue-600 font-mono font-medium">
                {currentUser.roles.join(', ')}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl text-sm font-medium transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Secure Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto bg-white">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 h-16 px-6 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-bold text-slate-900 capitalize">
              {activeTab === 'store' ? 'Mobile Phone Store' :
               activeTab === 'orders' ? 'My Order History' :
               activeTab === 'overview' ? (isAdmin ? 'Administrator Dashboard' : 'Auditor Dashboard') :
               activeTab === 'users' ? 'User Management' :
               activeTab === 'security' ? 'Password Security Reports' :
               activeTab === 'audit' ? 'System Audit Logs' :
               activeTab === 'backups' ? 'Backups & Restoration' : 'Personal Profile'}
            </h2>
          </div>

          <div className="flex items-center space-x-4">
            {isRegular && (
              <button
                onClick={() => setCheckoutModal(true)}
                className="relative flex items-center space-x-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Cart</span>
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                )}
              </button>
            )}
            <div className="hidden sm:flex items-center space-x-2 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full text-xs text-emerald-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Secure 2FA Session</span>
            </div>
          </div>
        </header>

        {/* Alerts */}
        <div className="p-6 pb-0">
          {errorMsg && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg('')} className="text-red-700 hover:text-red-900 text-xs font-bold">DISMISS</button>
            </div>
          )}
          {successMsg && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-lg text-sm flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button onClick={() => setSuccessMsg('')} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold">DISMISS</button>
            </div>
          )}
        </div>

        {/* REGULAR USER: PHONE STORE CATALOG */}
        {activeTab === 'store' && isRegular && (
          <div className="p-6 space-y-6">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-8 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="space-y-3">
                <span className="bg-white/20 text-white px-3 py-1 rounded-full text-xs font-mono font-semibold uppercase tracking-wider">
                  New Flagship Release 2026
                </span>
                <h3 className="text-3xl font-extrabold">Next-Gen Mobile Phones</h3>
                <p className="text-blue-100 text-sm max-w-lg">
                  Order your favorite smartphones with instant encrypted checkout, secure Argon2id authentication, and reliable delivery.
                </p>
              </div>
              <div className="w-24 h-24 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                <Smartphone className="w-12 h-12 text-white" />
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">Available Smartphones</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <div key={product.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                      <div className="h-56 bg-slate-100 overflow-hidden relative">
                        <img 
                          src={product.image_url} 
                          alt={product.name} 
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                        <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-semibold">
                          {product.brand}
                        </span>
                      </div>
                      <div className="p-5 space-y-2">
                        <h4 className="font-bold text-slate-900 text-lg">{product.name}</h4>
                        <p className="text-sm text-slate-600 line-clamp-2">{product.description}</p>
                      </div>
                    </div>
                    <div className="p-5 pt-0 flex items-center justify-between">
                      <span className="text-2xl font-extrabold text-blue-600">${Number(product.price).toFixed(2)}</span>
                      <button
                        onClick={() => addToCart(product)}
                        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        <span>Add to Cart</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* REGULAR USER: MY ORDERS */}
        {activeTab === 'orders' && isRegular && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900">My Order History</h3>
              <p className="text-sm text-slate-600">Track status and delivery details for your smartphone purchases.</p>
            </div>

            <div className="space-y-4">
              {orders.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
                  <Package className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                  <p className="font-semibold text-slate-700">No orders placed yet</p>
                  <p className="text-sm text-slate-500 mt-1">Browse our phone catalog and place your first order!</p>
                </div>
              ) : (
                orders.map((o) => (
                  <div key={o.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-200 gap-2">
                      <div>
                        <span className="text-xs font-mono text-slate-500">Order ID: #{o.id}</span>
                        <p className="text-sm font-semibold text-slate-900 mt-0.5">Placed on {new Date(o.created_at).toLocaleString()}</p>
                      </div>
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-semibold">
                        {o.status}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {o.order_items?.map((item: any) => (
                        <div key={item.id} className="flex justify-between items-center text-sm">
                          <span className="text-slate-800 font-medium">{item.products?.name || 'Phone'} &times; {item.quantity}</span>
                          <span className="font-semibold text-slate-900">${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-sm">
                      <span className="text-slate-600">Shipping to: <strong className="text-slate-900">{o.shipping_address}</strong> ({o.phone_number})</span>
                      <span className="text-lg font-bold text-blue-600">Total: ${Number(o.total_amount).toFixed(2)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ADMIN DASHBOARD (OVERVIEW) */}
        {activeTab === 'overview' && (isAdmin || isAuditor) && (
          <div className="p-6 space-y-6">
            <div className="bg-gradient-to-r from-blue-950 to-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="bg-blue-500/30 text-blue-200 border border-blue-400/30 px-3 py-1 rounded-full text-xs font-mono font-semibold uppercase tracking-wider">
                  {isAdmin ? 'Administrator Control Center' : 'Auditor Review Portal'}
                </span>
                <h3 className="text-2xl font-extrabold mt-3">Welcome back, {currentUser.full_name}</h3>
                <p className="text-slate-300 text-sm mt-1 max-w-xl">
                  {isAdmin ? 'Full system privileges active. Monitor user accounts, inspect Argon2id security reports, audit logs, and backups.' : 'Read-only access to security reports, authentication logs, audit logs, and backup history.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Total Registered Users</span>
                  <div className="p-2 bg-blue-100 rounded-xl text-blue-600"><Users className="w-5 h-5" /></div>
                </div>
                <p className="text-3xl font-extrabold text-slate-900 mt-4">{stats?.totalUsers || 0}</p>
                <div className="mt-2 text-xs text-emerald-600 font-medium">
                  <span>{stats?.activeUsers || 0} active, {stats?.suspendedUsers || 0} suspended</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">System Roles</span>
                  <div className="p-2 bg-purple-100 rounded-xl text-purple-600"><ShieldAlert className="w-5 h-5" /></div>
                </div>
                <p className="text-3xl font-extrabold text-slate-900 mt-4">{stats?.administrators || 0}</p>
                <div className="mt-2 text-xs text-slate-500">
                  <span>{stats?.administrators || 0} Admins, {stats?.auditors || 0} Auditors</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Successful 2FA Logins</span>
                  <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600"><CheckCircle2 className="w-5 h-5" /></div>
                </div>
                <p className="text-3xl font-extrabold text-slate-900 mt-4">{stats?.successfulLogins || 0}</p>
                <div className="mt-2 text-xs text-emerald-600 font-medium">Verified via Email OTP</div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Failed Attempts</span>
                  <div className="p-2 bg-red-100 rounded-xl text-red-600"><AlertTriangle className="w-5 h-5" /></div>
                </div>
                <p className="text-3xl font-extrabold text-slate-900 mt-4">{stats?.failedLogins || 0}</p>
                <div className="mt-2 text-xs text-red-600 font-medium">Blocked & logged</div>
              </div>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (isAdmin || isAuditor) && (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-900">User Accounts & Access Control</h3>
                <p className="text-sm text-slate-600">Manage user status, roles, and account permissions.</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setShowCreateUserModal(true)}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create User</span>
                </button>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      <th className="p-4">User</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Created</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-100/50">
                        <td className="p-4">
                          <p className="font-semibold text-slate-900">{u.full_name}</p>
                          <p className="text-xs text-slate-500 font-mono">@{u.username}</p>
                        </td>
                        <td className="p-4 text-slate-600">{u.email}</td>
                        <td className="p-4">
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg text-xs font-mono font-medium">
                            {u.roles?.join(', ') || 'REGULAR_USER'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            u.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-500 font-mono">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          {isAdmin && u.id !== currentUser.id && (
                            <button
                              onClick={() => handleToggleUserStatus(u.id, u.status)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                u.status === 'active' 
                                  ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200' 
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {u.status === 'active' ? 'Suspend' : 'Activate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SECURITY REPORTS TAB */}
        {activeTab === 'security' && (isAdmin || isAuditor) && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Password Security & Hashing Report</h3>
              <p className="text-sm text-slate-600">Argon2id password protection, salt presence, and server-side pepper status.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {securityReports.map((report) => (
                <div key={report.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">{report.username}</h4>
                      <p className="text-xs text-slate-500">{report.email}</p>
                    </div>
                    <span className="bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1 rounded-lg text-xs font-mono font-semibold">
                      {report.roles.join(', ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <span className="text-xs text-slate-500 block">Algorithm</span>
                      <span className="font-semibold text-slate-900 font-mono text-xs mt-1 block">{report.hashingAlgorithm}</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <span className="text-xs text-slate-500 block">Unique Salt</span>
                      <span className="font-semibold text-emerald-600 font-mono text-xs mt-1 block">{report.saltPreview} (Present)</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <span className="text-xs text-slate-500 block">Pepper Protection</span>
                      <span className="font-semibold text-blue-600 text-xs mt-1 block">{report.pepperProtectionStatus}</span>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <span className="text-xs text-slate-500 block">Masked Hash</span>
                      <span className="font-semibold text-slate-700 font-mono text-xs mt-1 truncate block">{report.maskedHash}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AUDIT LOGS TAB */}
        {activeTab === 'audit' && (isAdmin || isAuditor) && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900">System Audit & Authentication Logs</h3>
              <p className="text-sm text-slate-600">Complete historical record of all security events and orders.</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">Event Type</th>
                      <th className="p-4">Username</th>
                      <th className="p-4">Description</th>
                      <th className="p-4">IP Address</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm text-slate-700 font-mono">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-100/50">
                        <td className="p-4 text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="p-4 font-bold text-blue-600 text-xs">{log.event_type}</td>
                        <td className="p-4 text-slate-900 text-xs">{log.username || 'System'}</td>
                        <td className="p-4 text-slate-700 text-xs font-sans">{log.description}</td>
                        <td className="p-4 text-xs text-slate-500">{log.ip_address || 'N/A'}</td>
                        <td className="p-4">
                          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* BACKUPS TAB */}
        {activeTab === 'backups' && (isAdmin || isAuditor) && (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Automated Backups & Restoration</h3>
                <p className="text-sm text-slate-600">Manage application database snapshots and safe restoration points.</p>
              </div>
              {isAdmin && (
                <button
                  onClick={handleCreateBackup}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-md"
                >
                  <Database className="w-4 h-4" />
                  <span>Create Backup Now</span>
                </button>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      <th className="p-4">Backup Name</th>
                      <th className="p-4">Size</th>
                      <th className="p-4">Storage Path</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Created At</th>
                      <th className="p-4 text-right">Restoration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
                    {backupsList.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-100/50">
                        <td className="p-4 font-semibold text-slate-900 font-mono text-xs">{b.backup_name}</td>
                        <td className="p-4 font-mono text-xs">{(b.file_size / 1024 / 1024).toFixed(2)} MB</td>
                        <td className="p-4 text-slate-500 font-mono text-xs">{b.storage_path}</td>
                        <td className="p-4"><span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-xs font-semibold">{b.status}</span></td>
                        <td className="p-4 text-xs text-slate-500 font-mono">{new Date(b.created_at).toLocaleString()}</td>
                        <td className="p-4 text-right">
                          {isAdmin && (
                            <button
                              onClick={() => handleRestoreBackup(b.id)}
                              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-lg text-xs font-medium transition-all"
                            >
                              Restore Point
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="p-6 space-y-6 max-w-2xl">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Personal Profile & Security</h3>
              <p className="text-sm text-slate-600">Manage your password and security credentials.</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="border-b border-slate-200 pb-4 space-y-2">
                <div className="flex justify-between"><span className="text-sm text-slate-600">Full Name</span><span className="text-sm font-semibold text-slate-900">{currentUser.full_name}</span></div>
                <div className="flex justify-between"><span className="text-sm text-slate-600">Username</span><span className="text-sm font-semibold text-slate-900 font-mono">@{currentUser.username}</span></div>
                <div className="flex justify-between"><span className="text-sm text-slate-600">Email Address</span><span className="text-sm font-semibold text-slate-900">{currentUser.email}</span></div>
                <div className="flex justify-between"><span className="text-sm text-slate-600">Assigned Role</span><span className="text-sm font-semibold text-blue-600 font-mono">{currentUser.roles.join(', ')}</span></div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <h4 className="text-md font-bold text-slate-900">Change Password</h4>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Current Password</label>
                  <input type="password" required value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">New Password (Min 8 chars)</label>
                  <input type="password" required value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Confirm New Password</label>
                  <input type="password" required value={newPwdConfirm} onChange={(e) => setNewPwdConfirm(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm" />
                </div>
                <button type="submit" className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-all shadow-md">
                  Update Password securely
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* CHECKOUT CART MODAL */}
      {checkoutModal && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                <span>Complete Your Order</span>
              </h3>
              <button onClick={() => setCheckoutModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>

            {cart.length === 0 ? (
              <p className="text-center text-slate-500 py-6">Your cart is empty.</p>
            ) : (
              <form onSubmit={handleCheckout} className="space-y-4">
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                      <div>
                        <p className="font-semibold text-slate-900">{item.product.name}</p>
                        <p className="text-xs text-slate-500">${item.product.price} &times; {item.quantity}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button type="button" onClick={() => updateCartQuantity(item.product.id, -1)} className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-bold">-</button>
                        <span className="text-sm font-semibold">{item.quantity}</span>
                        <button type="button" onClick={() => updateCartQuantity(item.product.id, 1)} className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-bold">+</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 flex justify-between items-center font-bold text-slate-900 border-t border-slate-200">
                  <span>Total Amount:</span>
                  <span className="text-blue-600 text-xl">${cartTotal.toFixed(2)}</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Shipping Address</label>
                  <textarea
                    required
                    rows={2}
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm"
                    placeholder="123 Security Blvd, City, Country"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm"
                    placeholder="+1 (555) 019-2834"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setCheckoutModal(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-sm hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md flex items-center space-x-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Place Secure Order</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CREATE USER MODAL (Admin) */}
      {showCreateUserModal && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Create New User Account</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Full Name</label>
                <input type="text" required value={newUFullName} onChange={(e) => setNewUFullName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Username</label>
                <input type="text" required value={newUUsername} onChange={(e) => setNewUUsername(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Email Address</label>
                <input type="email" required value={newUEmail} onChange={(e) => setNewUEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Password</label>
                <input type="password" required value={newUPassword} onChange={(e) => setNewUPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Assign Role</label>
                <select value={newURole} onChange={(e) => setNewURole(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 text-sm">
                  <option value="REGULAR_USER">REGULAR_USER</option>
                  <option value="AUDITOR">AUDITOR</option>
                  <option value="ADMINISTRATOR">ADMINISTRATOR</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowCreateUserModal(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-sm hover:bg-slate-100">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
