import React, { useState } from 'react';
import {
  Search,
  Lock,
  Sun,
  Moon,
  MessageSquare,
  Menu,
  Bookmark,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface DecoyVaultViewProps {
  onLockToCalculator: () => void;
}

export const DecoyVaultView: React.FC<DecoyVaultViewProps> = ({ onLockToCalculator }) => {
  const { theme, toggleTheme } = useAuth();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'saved'>('all');

  const isLight = theme === 'light';

  return (
    <div
      className={`h-dvh w-screen overflow-hidden flex flex-col font-sans select-none ${
        isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#0b1118] text-white'
      }`}
    >
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`w-full md:w-85 lg:w-96 flex flex-col shrink-0 border-l ${
            isLight ? 'bg-white border-slate-200/90' : 'bg-[#111923] border-white/[0.06]'
          }`}
        >
          {/* Top Bar */}
          <div className="p-3 space-y-3 border-b border-white/[0.06]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/[0.06] text-[#8ea0b5]'
                  }`}
                >
                  <Menu className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-sm font-bold leading-tight">JanaX</h1>
                  <p className="text-[11px] text-[#8ea0b5]">مساحة العمل</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                    isLight
                      ? 'text-slate-600 hover:bg-slate-100'
                      : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
                  }`}
                  title="تبديل المظهر"
                >
                  {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={onLockToCalculator}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-xs font-bold transition-colors cursor-pointer"
                  title="العودة للآلة الحاسبة"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>قفل</span>
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                isLight
                  ? 'bg-slate-100 border-slate-200/80'
                  : 'bg-[#1a2533] border-white/[0.07]'
              }`}
            >
              <Search className="w-4 h-4 text-[#8ea0b5]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث..."
                className="w-full bg-transparent text-xs focus:outline-none placeholder:text-[#7f91a4]"
              />
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-[#2481cc] text-white'
                    : isLight
                    ? 'text-slate-500 hover:bg-slate-100'
                    : 'text-[#8ea0b5] hover:bg-white/[0.06]'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('saved')}
                className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  activeTab === 'saved'
                    ? 'bg-[#2481cc] text-white'
                    : isLight
                    ? 'text-slate-500 hover:bg-slate-100'
                    : 'text-[#8ea0b5] hover:bg-white/[0.06]'
                }`}
              >
                الملاحظات
              </button>
            </div>
          </div>

          {/* Decoy Empty State */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            {activeTab === 'saved' ? (
              <div className="max-w-xs space-y-2">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#2481cc]/15 text-[#2481cc] flex items-center justify-center">
                  <Bookmark className="w-7 h-7" />
                </div>
                <p className="text-sm font-bold">لا توجد ملاحظات محفوظة</p>
                <p className="text-xs text-[#8ea0b5] leading-relaxed">
                  هذه المساحة فارغة حالياً ولا تحتوي على أي رسائل أو وسائط.
                </p>
              </div>
            ) : (
              <div className="max-w-xs space-y-2">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#2481cc]/15 text-[#2481cc] flex items-center justify-center">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <p className="text-sm font-bold">لا توجد محادثات</p>
                <p className="text-xs text-[#8ea0b5] leading-relaxed">
                  {search.trim()
                    ? 'لم يتم العثور على نتائج مطابقة.'
                    : 'لا توجد محادثات نشطة في هذا الحساب حالياً.'}
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Desktop Right Placeholder */}
        <main
          className={`hidden md:flex flex-1 flex-col items-center justify-center p-8 text-center ${
            isLight ? 'telegram-doodle-light' : 'telegram-doodle-dark'
          }`}
        >
          <div
            className={`max-w-sm px-7 py-6 rounded-3xl border backdrop-blur-md shadow-xl flex flex-col items-center gap-3 ${
              isLight
                ? 'bg-white/85 border-slate-200/80 text-slate-900'
                : 'bg-[#111923]/85 border-white/[0.08] text-white'
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-[#2481cc]/15 text-[#2481cc] flex items-center justify-center">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h2 className="text-base font-bold">لا توجد محادثة محددة</h2>
            <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-500' : 'text-[#8ea0b5]'}`}>
              قائمة المحادثات فارغة. يمكنك العودة إلى شاشة الآلة الحاسبة في أي وقت.
            </p>
            <button
              type="button"
              onClick={onLockToCalculator}
              className="mt-1 px-4 py-2 rounded-xl bg-[#2481cc] hover:bg-[#1e6fb1] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              العودة للآلة الحاسبة
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};
