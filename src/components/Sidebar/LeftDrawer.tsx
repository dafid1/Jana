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
          theme === 'light' ? 'bg-white text-gray-900' : 'bg-[#17212b] text-white'
        }`}
      >
        {/* User Info Header */}
        <div
          className={`p-5 flex flex-col justify-end relative ${
            theme === 'light' ? 'bg-[#2481cc] text-white' : 'bg-[#232e3c] text-white'
          }`}
        >
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Avatar (Click to change photo in Settings) */}
          <button
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="relative w-16 h-16 rounded-full mb-3 flex items-center justify-center font-bold text-xl text-white shadow-md overflow-hidden bg-gradient-to-tr from-[#2481cc] to-[#43b5e4] group cursor-pointer text-right"
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
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold">
                Admin
              </span>
            )}
          </div>
          <div className="text-xs text-white/85 font-mono mt-0.5" dir="ltr">
            @{userProfile?.username || 'user'}
          </div>
          {userProfile?.phone && (
            <div className="text-xs text-white/70 mt-1" dir="ltr">
              {userProfile.phone}
            </div>
          )}
        </div>

        {/* Menu Items List */}
        <div className="flex-1 overflow-y-auto py-2">
          {/* Admin Account Management */}
          {isAdmin && (
            <>
              {onOpenRegisteredAccounts && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenRegisteredAccounts();
                  }}
                  className="w-full flex items-center gap-4 px-5 py-3 hover:bg-[#2481cc]/15 text-[#2481cc] transition-colors text-right cursor-pointer"
                >
                  <Users className="w-5 h-5" />
                  <span className="text-sm font-bold">شاشة الحسابات المسجلة وإدارتها</span>
                </button>
              )}
              <button
                onClick={() => {
                  onClose();
                  onOpenAdminUsers();
                }}
                className="w-full flex items-center gap-4 px-5 py-3 hover:bg-[#2481cc]/15 text-[#2481cc] transition-colors text-right cursor-pointer"
              >
                <Shield className="w-5 h-5" />
                <span className="text-sm font-bold">لوحة الأدمن (إنشاء حساب ورمز الحاسبة)</span>
              </button>
              <hr className={`my-1 ${theme === 'light' ? 'border-gray-100' : 'border-[#232e3c]'}`} />
            </>
          )}

          {/* Direct chat */}
          <button
            onClick={() => {
              onClose();
              onOpenNewChat();
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors text-right cursor-pointer"
          >
            <MessageSquare className="w-5 h-5 text-[#2481cc]" />
            <span className="text-sm font-medium">محادثة خاصة جديدة</span>
          </button>

          {/* Group */}
          <button
            onClick={() => {
              onClose();
              onOpenNewGroup();
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors text-right cursor-pointer"
          >
            <Users className="w-5 h-5 text-[#2481cc]" />
            <span className="text-sm font-medium">مجموعة جديدة</span>
          </button>

          {/* Join Group via Link */}
          <button
            onClick={() => {
              onClose();
              onOpenJoinGroup();
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors text-right cursor-pointer"
          >
            <Link2 className="w-5 h-5 text-[#2481cc]" />
            <span className="text-sm font-medium">انضمام لمجموعة برابط</span>
          </button>

          {/* Channel */}
          <button
            onClick={() => {
              onClose();
              onOpenNewChannel();
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors text-right cursor-pointer"
          >
            <Megaphone className="w-5 h-5 text-[#2481cc]" />
            <span className="text-sm font-medium">قناة جديدة</span>
          </button>

          {/* Saved Messages */}
          <button
            onClick={handleOpenSaved}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors text-right cursor-pointer"
          >
            <Bookmark className="w-5 h-5 text-[#2481cc]" />
            <span className="text-sm font-medium">الرسائل المحفوظة</span>
          </button>

          <hr className={`my-2 ${theme === 'light' ? 'border-gray-100' : 'border-[#232e3c]'}`} />

          {/* Night Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors text-right cursor-pointer"
          >
            <div className="flex items-center gap-4">
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-[#e5a643]" />
              ) : (
                <Sun className="w-5 h-5 text-[#e5a643]" />
              )}
              <span className="text-sm font-medium">
                {theme === 'dark' ? 'الوضع الليلي (مفعل)' : 'الوضع النهاري (مفعل)'}
              </span>
            </div>
            <div
              className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                theme === 'dark' ? 'bg-[#2481cc]' : 'bg-gray-300'
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
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors text-right cursor-pointer"
          >
            <Settings className="w-5 h-5 text-[#7f91a4]" />
            <span className="text-sm font-medium">تغيير الصورة والإعدادات</span>
          </button>

          {onLockToCalculator && (
            <button
              onClick={() => {
                onClose();
                onLockToCalculator();
              }}
              className="w-full flex items-center gap-4 px-5 py-3 hover:bg-amber-500/10 text-amber-400 transition-colors text-right cursor-pointer"
            >
              <Calculator className="w-5 h-5" />
              <span className="text-sm font-medium">إخفاء التطبيق (الآلة الحاسبة)</span>
            </button>
          )}

          <hr className={`my-2 ${theme === 'light' ? 'border-gray-100' : 'border-[#232e3c]'}`} />

          {/* Logout */}
          <button
            onClick={async () => {
              onClose();
              await logout('', true);
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-red-500/10 text-red-400 transition-colors text-right cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">تسجيل الخروج</span>
          </button>
        </div>

        {/* Footer */}
        <div
          className={`p-4 text-center text-xs text-[#7f91a4] border-t ${
            theme === 'light' ? 'border-gray-100' : 'border-[#232e3c]'
          }`}
        >
          JanaX Cloud Messenger • v2.0
        </div>
      </div>
    </div>
  );
};
