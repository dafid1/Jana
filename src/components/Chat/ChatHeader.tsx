import React, { useState } from 'react';
import {
  ArrowRight,
  Phone,
  Video,
  Search,
  MoreVertical,
  Volume2,
  VolumeX,
  Trash2,
  Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { getAvatarGradient, getInitials } from '../../utils/telegramHelpers';

interface ChatHeaderProps {
  onBack: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ onBack }) => {
  const { theme } = useAuth();
  const { activeChat, showInfoDrawer, setShowInfoDrawer, startCall, typingStatus } = useChat();
  const [showMenu, setShowMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  if (!activeChat) return null;

  const getSubtitle = () => {
    if (typingStatus) {
      return typingStatus;
    }
    if (activeChat.type === 'channel') {
      return `${activeChat.membersCount?.toLocaleString() || '1,420,500'} مشترك`;
    }
    if (activeChat.type === 'group') {
      return `${activeChat.membersCount || activeChat.memberIds?.length || 12} عضواً`;
    }
    if (activeChat.type === 'saved') {
      return 'سحابتك الشخصية للرسائل والملاحظات';
    }
    if (activeChat.title.includes('Bot')) {
      return 'بوت آلي • خدمة متواصلة';
    }
    return 'متصل الآن';
  };

  return (
    <div
      className={`h-15 border-b px-4 flex items-center justify-between shrink-0 z-10 transition-colors select-none ${
        theme === 'light' ? 'bg-white border-gray-200' : 'bg-[#17212b] border-[#232e3c]'
      }`}
    >
      {/* Left (RTL Start): Avatar & Info */}
      <div
        className="flex items-center gap-3 min-w-0 cursor-pointer"
        onClick={() => setShowInfoDrawer(!showInfoDrawer)}
      >
        {/* Mobile Back Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBack();
          }}
          className="md:hidden p-1.5 -mr-1 rounded-full text-[#7f91a4] hover:text-white"
        >
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* Chat Avatar */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
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

        {/* Title & Status */}
        <div className="min-w-0">
          <h2
            className={`text-sm font-bold truncate leading-tight flex items-center gap-1.5 ${
              theme === 'light' ? 'text-gray-900' : 'text-white'
            }`}
          >
            <span className="truncate">{activeChat.title}</span>
            {activeChat.type === 'channel' && (
              <span className="text-[#2481cc] text-[12px] font-bold">✓</span>
            )}
          </h2>
          <p
            className={`text-xs truncate transition-colors ${
              typingStatus
                ? 'text-[#2481cc] font-semibold animate-pulse'
                : activeChat.type === 'direct' && !activeChat.title.includes('Bot')
                ? 'text-emerald-400 font-medium'
                : theme === 'light'
                ? 'text-gray-500'
                : 'text-[#7f91a4]'
            }`}
          >
            {getSubtitle()}
          </p>
        </div>
      </div>

      {/* Right (RTL End): Actions */}
      <div className="flex items-center gap-1">
        {/* Audio Call Button */}
        {activeChat.type !== 'channel' && activeChat.type !== 'saved' && (
          <button
            onClick={() => startCall(activeChat, false)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              theme === 'light'
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-[#7f91a4] hover:text-white hover:bg-[#232e3c]'
            }`}
            title="مكالمة صوتية"
          >
            <Phone className="w-5 h-5" />
          </button>
        )}

        {/* Video Call Button */}
        {activeChat.type !== 'channel' && activeChat.type !== 'saved' && (
          <button
            onClick={() => startCall(activeChat, true)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              theme === 'light'
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-[#7f91a4] hover:text-white hover:bg-[#232e3c]'
            }`}
            title="مكالمة فيديو"
          >
            <Video className="w-5 h-5" />
          </button>
        )}

        {/* Chat Info Drawer Button */}
        <button
          onClick={() => setShowInfoDrawer(!showInfoDrawer)}
          className={`p-2 rounded-full transition-colors cursor-pointer ${
            showInfoDrawer
              ? 'text-[#2481cc] bg-[#2481cc]/15'
              : theme === 'light'
              ? 'text-gray-600 hover:bg-gray-100'
              : 'text-[#7f91a4] hover:text-white hover:bg-[#232e3c]'
          }`}
          title="معلومات المحادثة"
        >
          <Info className="w-5 h-5" />
        </button>

        {/* More Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu((prev) => !prev)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              theme === 'light'
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-[#7f91a4] hover:text-white hover:bg-[#232e3c]'
            }`}
            title="المزيد من الخيارات"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showMenu && (
            <div
              className={`absolute left-0 top-11 rounded-2xl shadow-xl border overflow-hidden p-1 min-w-[190px] z-50 animate-in fade-in zoom-in-95 duration-150 ${
                theme === 'light'
                  ? 'bg-white border-gray-200 text-gray-800'
                  : 'bg-[#1e2a38] border-[#2b3a4a] text-white'
              }`}
            >
              <button
                onClick={() => {
                  setIsMuted(!isMuted);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl hover:bg-white/5 transition-colors text-right"
              >
                {isMuted ? (
                  <>
                    <Volume2 className="w-4 h-4 text-[#2481cc]" />
                    <span>إلغاء كتم الإشعارات</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 text-[#7f91a4]" />
                    <span>كتم الإشعارات</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowInfoDrawer(true);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl hover:bg-white/5 transition-colors text-right"
              >
                <Info className="w-4 h-4 text-[#7f91a4]" />
                <span>عرض التفاصيل</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
