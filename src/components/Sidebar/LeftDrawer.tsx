import React from 'react';
import {
  X,
  Users,
  Megaphone,
  MessageSquare,
  Bookmark,
  Moon,
  Sun,
  Settings,
  LogOut,
  Shield,
  Link2,
  Camera,
  Calculator,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { getInitials } from '../../utils/telegramHelpers';

interface LeftDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNewChat: () => void;
  onOpenNewGroup: () => void;
  onOpenJoinGroup: () => void;
  onOpenNewChannel: () => void;
  onOpenSettings: () => void;
  onOpenAdminUsers: () => void;
  onOpenRegisteredAccounts?: () => void;
  onLockToCalculator?: () => void;
}

export const LeftDrawer: React.FC<LeftDrawerProps> = ({
  isOpen,
  onClose,
  onOpenNewChat,
  onOpenNewGroup,
  onOpenJoinGroup,
  onOpenNewChannel,
  onOpenSettings,
  onOpenAdminUsers,
  onOpenRegisteredAccounts,
  onLockToCalculator,
}) => {
  const { userProfile, isAdmin, theme, toggleTheme, logout } = useAuth();
  const { chats, setActiveChatId } = useChat();

  if (!isOpen) return null;

  const handleOpenSaved = () => {
    const saved = chats.find((c) => c.type === 'saved');
    if (saved) {
      setActiveChatId(saved.id);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        className={`relative z-10 w-80 max-w-[85vw] h-full flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          theme === 'light' ? 'bg-white text-slate-900' : 'bg-[#111923] text-white'
        }`}
      >
        {/* User Info Header */}
        <div
          className={`p-5 flex flex-col justify-end relative border-b ${
            theme === 'light'
              ? 'bg-[#2481cc] border-[#1d6eb0] text-white'
              : 'bg-[#162230] border-white/[0.06] text-white'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 min-h-[36px] min-w-[36px] rounded-xl hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Avatar (Click to change photo in Settings) */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="relative w-16 h-16 rounded-full mb-3 flex items-center justify-center font-bold text-xl text-white shadow-md ring-2 ring-white/20 overflow-hidden bg-gradient-to-tr from-[#2481cc] to-[#43b5e4] group cursor-pointer text-right"
            title="تغيير صورة البروفايل"
          >
            {userProfile?.photoURL ? (
              <img
                src={userProfile.photoURL}
                alt={userProfile.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{getInitials(userProfile?.displayName)}</span>
            )}
            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
          </button>

          {/* Details */}
          <div className="flex items-center gap-2">
            <div className="font-bold text-lg leading-tight truncate">
              {userProfile?.displayName || 'مستخدم JanaX'}
            </div>
            {isAdmin && (
              <span className="px-2 py-0.5 rounded-md bg-white/20 text-white text-[10px] font-bold">
                مشرف
              </span>
            )}
          </div>
          <div className="text-xs text-white/85 font-mono mt-0.5" dir="ltr">
            @{userProfile?.username || 'user'}
          </div>
          {userProfile?.phone && (
            <div className="text-xs text-white/75 font-mono mt-1" dir="ltr">
              {userProfile.phone}
            </div>
          )}
        </div>

        {/* Menu Items List */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {/* Admin Account Management */}
          {isAdmin && (
            <>
              {onOpenRegisteredAccounts && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenRegisteredAccounts();
                  }}
                  className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl hover:bg-[#2481cc]/12 text-[#2481cc] transition-colors text-right cursor-pointer"
                >
                  <Users className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-bold">شاشة الحسابات المسجلة وإدارتها</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdminUsers();
                }}
                className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl hover:bg-[#2481cc]/12 text-[#2481cc] transition-colors text-right cursor-pointer"
              >
                <Shield className="w-5 h-5 shrink-0" />
                <span className="text-sm font-bold">لوحة الأدمن (إنشاء حساب ورمز الحاسبة)</span>
              </button>
              <hr className={`my-1.5 ${theme === 'light' ? 'border-slate-100' : 'border-white/[0.06]'}`} />
            </>
          )}

          {/* Direct chat */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenNewChat();
            }}
            className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-colors text-right cursor-pointer ${
              theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
            }`}
          >
            <MessageSquare className="w-5 h-5 text-[#2481cc] shrink-0" />
            <span className="text-sm font-medium">محادثة خاصة جديدة</span>
          </button>

          {/* Group */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenNewGroup();
            }}
            className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-colors text-right cursor-pointer ${
              theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
            }`}
          >
            <Users className="w-5 h-5 text-[#2481cc] shrink-0" />
            <span className="text-sm font-medium">مجموعة جديدة</span>
          </button>

          {/* Join Group via Link */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenJoinGroup();
            }}
            className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-colors text-right cursor-pointer ${
              theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
            }`}
          >
            <Link2 className="w-5 h-5 text-[#2481cc] shrink-0" />
            <span className="text-sm font-medium">انضمام لمجموعة برابط</span>
          </button>

          {/* Channel */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenNewChannel();
            }}
            className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-colors text-right cursor-pointer ${
              theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
            }`}
          >
            <Megaphone className="w-5 h-5 text-[#2481cc] shrink-0" />
            <span className="text-sm font-medium">قناة جديدة</span>
          </button>

          {/* Saved Messages */}
          <button
            type="button"
            onClick={handleOpenSaved}
            className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-colors text-right cursor-pointer ${
              theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
            }`}
          >
            <Bookmark className="w-5 h-5 text-[#2481cc] shrink-0" />
            <span className="text-sm font-medium">الرسائل المحفوظة</span>
          </button>

          <hr className={`my-1.5 ${theme === 'light' ? 'border-slate-100' : 'border-white/[0.06]'}`} />

          {/* Night Mode Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors text-right cursor-pointer ${
              theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
            }`}
          >
            <div className="flex items-center gap-3.5">
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-[#e5a643]" />
              ) : (
                <Sun className="w-5 h-5 text-[#e5a643]" />
              )}
              <span className="text-sm font-medium">
                {theme === 'dark' ? 'الوضع الليلي' : 'الوضع النهاري'}
              </span>
            </div>
            <div
              className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                theme === 'dark' ? 'bg-[#2481cc]' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform ${
                  theme === 'dark' ? '-translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-colors text-right cursor-pointer ${
              theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
            }`}
          >
            <Settings className="w-5 h-5 text-[#8496ab] shrink-0" />
            <span className="text-sm font-medium">تغيير الصورة والإعدادات</span>
          </button>

          {onLockToCalculator && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onLockToCalculator();
              }}
              className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl hover:bg-amber-500/12 text-amber-500 transition-colors text-right cursor-pointer"
            >
              <Calculator className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">إخفاء التطبيق (الآلة الحاسبة)</span>
            </button>
          )}

          <hr className={`my-1.5 ${theme === 'light' ? 'border-slate-100' : 'border-white/[0.06]'}`} />

          {/* Logout */}
          <button
            type="button"
            onClick={async () => {
              onClose();
              await logout('', true);
            }}
            className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl hover:bg-red-500/12 text-red-400 transition-colors text-right cursor-pointer"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">تسجيل الخروج</span>
          </button>
        </div>

        {/* Footer */}
        <div
          className={`p-3.5 text-center text-xs border-t ${
            theme === 'light'
              ? 'border-slate-100 text-slate-400'
              : 'border-white/[0.06] text-[#8496ab]'
          }`}
        >
          JanaX
        </div>
      </div>
    </div>
  );
};
