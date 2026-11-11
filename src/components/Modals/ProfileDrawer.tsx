import React, { useState } from 'react';
import {
  X,
  Bell,
  BellOff,
  Image as ImageIcon,
  FileText,
  Link2,
  Users,
  Shield,
  Phone,
  Bookmark,
  Share2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { getAvatarGradient, getInitials } from '../../utils/telegramHelpers';

export const ProfileDrawer: React.FC = () => {
  const { theme } = useAuth();
  const { activeChat, showInfoDrawer, setShowInfoDrawer, messages } = useChat();
  const [activeMediaTab, setActiveMediaTab] = useState<'media' | 'files'>('media');
  const [notifications, setNotifications] = useState(true);

  if (!showInfoDrawer || !activeChat) return null;

  // Filter media from chat messages
  const mediaMessages = messages.filter((m) => m.type === 'image' && m.mediaUrl);
  const fileMessages = messages.filter((m) => m.type === 'file' && m.mediaUrl);

  return (
    <div
      className={`w-80 border-r flex flex-col h-full shrink-0 z-20 shadow-xl select-none transition-all duration-300 ${
        theme === 'light' ? 'bg-white border-gray-200' : 'bg-[#17212b] border-[#232e3c]'
      }`}
    >
      {/* Header */}
      <div
        className={`h-15 px-4 flex items-center justify-between border-b shrink-0 ${
          theme === 'light' ? 'border-gray-200' : 'border-[#232e3c]'
        }`}
      >
        <span className="font-bold text-sm">معلومات المحادثة</span>
        <button
          onClick={() => setShowInfoDrawer(false)}
          className="p-1.5 rounded-full text-[#7f91a4] hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Profile Details Scroll Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Big Avatar & Title */}
        <div className="p-6 flex flex-col items-center text-center border-b border-white/5">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center font-bold text-3xl text-white shadow-lg mb-3 overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
              activeChat.id
            )}`}
          >
            {activeChat.photoURL ? (
              <img
                src={activeChat.photoURL}
                alt={activeChat.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{getInitials(activeChat.title)}</span>
            )}
          </div>

          <h3 className="font-bold text-base leading-tight mb-1">{activeChat.title}</h3>
          <p className="text-xs text-[#7f91a4]">
            {activeChat.type === 'channel'
              ? `${activeChat.membersCount?.toLocaleString() || '1,420,500'} مشترك`
              : activeChat.type === 'group'
              ? `${activeChat.membersCount || activeChat.memberIds?.length || 12} عضو`
              : 'متصل الآن'}
          </p>
        </div>

        {/* Info Rows */}
        <div className="p-4 space-y-4 text-xs border-b border-white/5">
          {/* Description / Bio */}
          {activeChat.description && (
            <div>
              <div className="text-[11px] text-[#7f91a4] mb-0.5">الوصف</div>
              <p className="font-medium leading-relaxed">{activeChat.description}</p>
            </div>
          )}

          {/* Username */}
          <div>
            <div className="text-[11px] text-[#7f91a4] mb-0.5">اسم المستخدم</div>
            <p className="font-mono text-[#2481cc] font-semibold" dir="ltr">
              @{activeChat.title.replace(/\s+/g, '_').toLowerCase()}
            </p>
          </div>

          {/* Notifications Toggle */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              {notifications ? (
                <Bell className="w-4 h-4 text-[#2481cc]" />
              ) : (
                <BellOff className="w-4 h-4 text-[#7f91a4]" />
              )}
              <span className="font-medium">الإشعارات</span>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                notifications ? 'bg-[#2481cc]' : 'bg-gray-400'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform ${
                  notifications ? '-translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Shared Media Tabs */}
        <div className="p-4">
          <div className="flex border-b border-white/10 text-xs font-semibold mb-3">
            <button
              onClick={() => setActiveMediaTab('media')}
              className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
                activeMediaTab === 'media'
                  ? 'text-[#2481cc] border-b-2 border-[#2481cc]'
                  : 'text-[#7f91a4] hover:text-white'
              }`}
            >
              الصور ({mediaMessages.length})
            </button>
            <button
              onClick={() => setActiveMediaTab('files')}
              className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
                activeMediaTab === 'files'
                  ? 'text-[#2481cc] border-b-2 border-[#2481cc]'
                  : 'text-[#7f91a4] hover:text-white'
              }`}
            >
              الملفات ({fileMessages.length})
            </button>
          </div>

          {activeMediaTab === 'media' ? (
            mediaMessages.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#7f91a4]">لا توجد وسائط مشاركة بعد</div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {mediaMessages.map((m) => (
                  <div key={m.id} className="aspect-square rounded-lg overflow-hidden bg-black/20">
                    <img
                      src={m.mediaUrl}
                      alt="Media"
                      className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            )
          ) : fileMessages.length === 0 ? (
            <div className="text-center py-6 text-xs text-[#7f91a4]">لا توجد ملفات مشاركة بعد</div>
          ) : (
            <div className="space-y-2">
              {fileMessages.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 p-2 rounded-xl bg-white/5 text-xs"
                >
                  <FileText className="w-4 h-4 text-[#2481cc] shrink-0" />
                  <div className="flex-1 truncate font-medium">{m.mediaName || 'ملف'}</div>
                  <span className="text-[10px] text-[#7f91a4]">{m.mediaSize || '1.2MB'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
