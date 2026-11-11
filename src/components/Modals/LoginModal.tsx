import React, { useState } from 'react';
import { Send, Sparkles, User, AtSign, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginModal: React.FC = () => {
  const { loginWithGoogle, loginAsDemoUser, theme } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('يرجى إدخال اسمك');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const uName = username.trim() || `user_${Math.floor(Math.random() * 8999 + 1000)}`;
      await loginAsDemoUser(name.trim(), uName);
    } catch (err) {
      setError('حدث خطأ أثناء تسجيل الدخول. حاول ثانية.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await loginWithGoogle();
    } catch (err) {
      setError('تعذر تسجيل الدخول بحساب Google.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none">
      <div
        className={`w-full max-w-md rounded-3xl p-8 shadow-2xl border text-center transition-all ${
          theme === 'light'
            ? 'bg-white border-gray-200 text-gray-900'
            : 'bg-[#17212b] border-[#2b3a4a] text-white'
        }`}
      >
        {/* Telegram Icon */}
        <div className="w-20 h-20 rounded-full bg-[#2481cc] mx-auto mb-4 flex items-center justify-center text-white shadow-xl">
          <svg className="w-10 h-10 -ml-1" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-1">Telegram Web</h1>
        <p className="text-xs text-[#7f91a4] mb-6">
          أهلاً بك! سجّل دخولك للبدء بالمراسلة الفورية وحفظ المحادثات في Firebase.
        </p>

        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-right">
            {error}
          </div>
        )}

        {/* Quick Demo Login Form */}
        <form onSubmit={handleDemoSubmit} className="space-y-3 mb-4 text-right">
          <div>
            <label className="block text-xs font-semibold mb-1 opacity-80">اسمك الشخصي</label>
            <div className="relative">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: أحمد محمد"
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl outline-hidden border transition-all ${
                  theme === 'light'
                    ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#2481cc]'
                    : 'bg-[#242f3d] border-[#2b3a4a] text-white focus:border-[#2481cc]'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 opacity-80">
              اسم المستخدم (اختياري)
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                placeholder="ahmed_dev"
                dir="ltr"
                className={`w-full pl-8 pr-3.5 py-2.5 text-sm rounded-xl outline-hidden border font-mono transition-all ${
                  theme === 'light'
                    ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#2481cc]'
                    : 'bg-[#242f3d] border-[#2b3a4a] text-white focus:border-[#2481cc]'
                }`}
              />
              <span className="absolute left-3 top-2.5 text-xs text-[#7f91a4] font-mono">@</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white font-bold text-sm shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'جاري الدخول...' : 'دخول فوري إلى تيليجرام'}
          </button>
        </form>

        <div className="relative flex py-2 items-center">
          <div className="grow border-t border-white/10"></div>
          <span className="shrink mx-3 text-[11px] text-[#7f91a4]">أو</span>
          <div className="grow border-t border-white/10"></div>
        </div>

        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={isSubmitting}
          className={`w-full py-2.5 px-4 rounded-xl border flex items-center justify-center gap-3 text-xs font-semibold transition-all hover:bg-white/5 cursor-pointer disabled:opacity-50 ${
            theme === 'light' ? 'border-gray-300 text-gray-700' : 'border-[#2b3a4a] text-white'
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>تسجيل الدخول عبر حساب Google</span>
        </button>
      </div>
    </div>
  );
};
