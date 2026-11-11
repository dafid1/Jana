import React from 'react';
import {
  X,
  User,
  Users,
  Megaphone,
  MessageSquare,
  Bookmark,
  Moon,
  Sun,
  Settings,
  LogOut,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { getAvatarGradient, getInitials } from '../../utils/telegramHelpers';

interface LeftDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNewChat: () => void;
  onOpenNewGroup: () => void;
  onOpenNewChannel: () => void;
  onOpenSettings: () => void;
}

export const LeftDrawer: React.FC<LeftDrawerProps> = ({
  isOpen,
  onClose,
  onOpenNewChat,
  onOpenNewGroup,
  onOpenNewChannel,
  onOpenSettings,
}) => {
  const { userProfile, theme, toggleTheme, logout } = useAuth();
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

          {/* Avatar */}
          <div className="w-16 h-16 rounded-full mb-3 flex items-center justify-center font-bold text-xl text-white shadow-md overflow-hidden bg-gradient-to-tr from-[#2481cc] to-[#43b5e4]">
            {userProfile?.photoURL ? (
              <img
                src={userProfile.photoURL}
                alt={userProfile.displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{getInitials(userProfile?.displayName)}</span>
            )}
          </div>

          {/* Details */}
          <div className="font-bold text-lg leading-tight truncate">
            {userProfile?.displayName || 'مستخدم تيليجرام'}
          </div>
          <div className="text-xs text-white/80 font-mono mt-0.5" dir="ltr">
            {userProfile?.username || '@username'}
          </div>
          <div className="text-xs text-white/70 mt-1" dir="ltr">
            {userProfile?.phone || '+966 50 000 0000'}
          </div>
        </div>

        {/* Menu Items List */}
        <div className="flex-1 overflow-y-auto py-2">
          {/* Group */}
          <button
            onClick={() => {
              onClose();
              onOpenNewGroup();
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors text-right"
          >
            <Users className="w-5 h-5 text-[#2481cc]" />
            <span className="text-sm font-medium">مجموعة جديدة</span>
          </button>

          {/* Channel */}
          <button
            onClick={() => {
              onClose();
              onOpenNewChannel();
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors text-right"
          >
            <Megaphone className="w-5 h-5 text-[#2481cc]" />
            <span className="text-sm font-medium">قناة جديدة</span>
          </button>

          {/* Direct chat */}
          <button
            onClick={() => {
              onClose();
              onOpenNewChat();
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors text-right"
          >
            <MessageSquare className="w-5 h-5 text-[#2481cc]" />
            <span className="text-sm font-medium">محادثة جديدة</span>
          </button>

          {/* Saved Messages */}
          <button
            onClick={handleOpenSaved}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors text-right"
          >
            <Bookmark className="w-5 h-5 text-[#2481cc]" />
            <span className="text-sm font-medium">الرسائل المحفوظة</span>
          </button>

          <hr className={`my-2 ${theme === 'light' ? 'border-gray-100' : 'border-[#232e3c]'}`} />

          {/* Night Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors text-right"
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
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors text-right"
          >
            <Settings className="w-5 h-5 text-[#7f91a4]" />
            <span className="text-sm font-medium">الإعدادات</span>
          </button>

          <hr className={`my-2 ${theme === 'light' ? 'border-gray-100' : 'border-[#232e3c]'}`} />

          {/* Logout */}
          <button
            onClick={async () => {
              onClose();
              await logout();
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-red-500/10 text-red-400 transition-colors text-right"
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
          Telegram Web v10.4 • Firebase Powered
        </div>
      </div>
    </div>
  );
};
