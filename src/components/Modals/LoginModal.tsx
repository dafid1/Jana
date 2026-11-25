import React, { useState } from 'react';
import {
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  AlertTriangle,
  ExternalLink,
  Clock,
  UserPlus,
  LogIn,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { FIREBASE_PROJECT_ID } from '../../firebase/config';

export const LoginModal: React.FC = () => {
  const {
    loginWithCredentials,
    registerWithPhone,
    theme,
    logoutReason,
    clearLogoutReason,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Login fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Phone registration fields
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [providerDisabled, setProviderDisabled] = useState(false);

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError('');
    setProviderDisabled(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('يرجى إدخال اسم المستخدم أو رقم الهاتف وكلمة المرور');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setProviderDisabled(false);
    clearLogoutReason();

    try {
      await loginWithCredentials(identifier, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء تسجيل الدخول';
      if (msg === 'PROVIDER_DISABLED') {
        setProviderDisabled(true);
        setError('يجب تفعيل موفر تسجيل الدخول (Email/Password) من لوحة Firebase أولاً.');
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !regPassword) {
      setError('يرجى إدخال رقم الهاتف وكلمة المرور');
      return;
    }
    if (regPassword.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setProviderDisabled(false);
    clearLogoutReason();

    try {
      await registerWithPhone({
        phone,
        password: regPassword,
        displayName,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر إنشاء الحساب';
      if (msg === 'PROVIDER_DISABLED') {
        setProviderDisabled(true);
        setError('يجب تفعيل موفر تسجيل الدخول (Email/Password) من لوحة Firebase أولاً.');
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = `w-full pr-10 pl-3.5 py-2.5 text-sm rounded-xl outline-hidden border transition-all ${
    theme === 'light'
      ? 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-[#2481cc] focus:ring-2 focus:ring-[#2481cc]/15'
      : 'bg-[#1a2533] border-white/[0.08] text-white focus:bg-[#1f2c3d] focus:border-[#2481cc] focus:ring-2 focus:ring-[#2481cc]/20'
  }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070c12]/90 backdrop-blur-md select-none overflow-y-auto">
      <div
        className={`w-full max-w-md rounded-3xl p-7 shadow-2xl border text-center transition-all my-auto ${
          theme === 'light'
            ? 'bg-white border-slate-200/90 text-slate-900'
            : 'bg-[#111923] border-white/[0.08] text-white'
        }`}
      >
        {/* JanaX Brand Emblem */}
        <div className="w-16 h-16 rounded-2xl bg-[#2481cc] mx-auto mb-3.5 flex items-center justify-center text-white shadow-lg shadow-[#2481cc]/25 ring-4 ring-[#2481cc]/15">
          <svg className="w-8 h-8 -ml-0.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
          </svg>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight mb-1">JanaX</h1>
        <p className={`text-xs mb-5 ${theme === 'light' ? 'text-slate-500' : 'text-[#8496ab]'}`}>
          {mode === 'login'
            ? 'سجّل دخولك باسم المستخدم أو رقم الهاتف وكلمة المرور'
            : 'أنشئ حساباً جديداً برقم الهاتف وكلمة المرور'}
        </p>

        {/* Login / Register Mode Switch */}
        <div
          className={`flex p-1 rounded-2xl mb-5 border ${
            theme === 'light'
              ? 'bg-slate-100 border-slate-200/80'
              : 'bg-[#0b1118]/80 border-white/[0.06]'
          }`}
        >
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-[#2481cc] text-white shadow-sm'
                : theme === 'light'
                ? 'text-slate-500 hover:text-slate-900'
                : 'text-[#8496ab] hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>تسجيل الدخول</span>
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-[#2481cc] text-white shadow-sm'
                : theme === 'light'
                ? 'text-slate-500 hover:text-slate-900'
                : 'text-[#8496ab] hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>إنشاء حساب</span>
          </button>
        </div>

        {logoutReason && !error && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs text-right leading-relaxed flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{logoutReason}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs text-right leading-relaxed">
            <div className="flex items-center gap-2 font-bold mb-1">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>تنبيه</span>
            </div>
            <p>{error}</p>
            {providerDisabled && (
              <div className="mt-2.5 pt-2 border-t border-red-500/20 text-[11px] text-amber-200 space-y-1">
                <p className="font-bold">خطوات التفعيل في Firebase Console:</p>
                <p>1. افتح Authentication ← Sign-in method</p>
                <p>2. اضغط على Email/Password وقم بتفعيل الخيار الأول (Enable) ثم Save</p>
                <a
                  href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/providers`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-1 text-sky-400 underline font-semibold"
                >
                  <span>فتح إعدادات المصادقة في Firebase</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4 text-right">
            <div>
              <label className="block text-xs font-semibold mb-1.5 opacity-80">
                اسم المستخدم أو رقم الهاتف
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#7f91a4] absolute right-3.5 top-3" />
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="مثال: jehan أو 0501234567"
                  dir="ltr"
                  className={`${inputClass} font-mono text-right`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 opacity-80">كلمة المرور</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#7f91a4] absolute right-3.5 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  className={`${inputClass} pl-10 text-right`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute left-3 top-2.5 text-[#7f91a4] hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white font-bold text-sm shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'جاري التحقق والدخول...' : 'تسجيل الدخول إلى JanaX'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-right">
            <div>
              <label className="block text-xs font-semibold mb-1.5 opacity-80">
                الاسم الكامل (اختياري)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#7f91a4] absolute right-3.5 top-3" />
                <input
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="مثال: أحمد محمد"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 opacity-80">رقم الهاتف</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#7f91a4] absolute right-3.5 top-3" />
                <input
                  type="tel"
                  required
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+966 50 123 4567"
                  dir="ltr"
                  className={`${inputClass} font-mono text-right`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 opacity-80">
                كلمة المرور (6 أحرف فأكثر)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#7f91a4] absolute right-3.5 top-3" />
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  className={`${inputClass} pl-10 text-right`}
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword((p) => !p)}
                  className="absolute left-3 top-2.5 text-[#7f91a4] hover:text-white cursor-pointer"
                >
                  {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 opacity-80">
                تأكيد كلمة المرور
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#7f91a4] absolute right-3.5 top-3" />
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  className={`${inputClass} pl-10 text-right`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white font-bold text-sm shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'جاري إنشاء الحساب...' : 'إنشاء حساب برقم الهاتف'}
            </button>
          </form>
        )}

        <p className="mt-5 text-[11px] text-[#7f91a4] leading-relaxed">
          {mode === 'login' ? (
            <>
              ليس لديك حساب؟{' '}
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="text-[#2481cc] hover:underline font-bold cursor-pointer"
              >
                أنشئ حساباً برقم الهاتف الآن
              </button>
            </>
          ) : (
            <>
              لديك حساب مسجل بالفعل؟{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-[#2481cc] hover:underline font-bold cursor-pointer"
              >
                تسجيل الدخول
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};
