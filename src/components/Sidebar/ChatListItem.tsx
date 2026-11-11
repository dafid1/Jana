import React from 'react';
import { Check, CheckCheck, Pin, Bookmark, Megaphone, Users, Bot } from 'lucide-react';
import { Chat } from '../../types/telegram';
import { useAuth } from '../../context/AuthContext';
import { getAvatarGradient, getInitials, formatTelegramTime } from '../../utils/telegramHelpers';

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
}

export const ChatListItem: React.FC<ChatListItemProps> = ({ chat, isActive, onClick }) => {
  const { theme, currentUser } = useAuth();
  const isUserSender = chat.lastMessage?.senderId === currentUser?.uid;

  const getChatIcon = () => {
    if (chat.type === 'saved') return <Bookmark className="w-5 h-5 text-white" />;
    if (chat.type === 'channel') return <Megaphone className="w-4 h-4 text-white" />;
    if (chat.type === 'group') return <Users className="w-4 h-4 text-white" />;
    if (chat.title.includes('Bot')) return <Bot className="w-5 h-5 text-white" />;
    return null;
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors select-none ${
        isActive
          ? theme === 'light'
            ? 'bg-[#e4ecf3]'
            : 'bg-[#2b5278]'
          : theme === 'light'
          ? 'hover:bg-[#f1f1f1]'
          : 'hover:bg-[#202b36]'
      }`}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base text-white shadow-xs overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
            chat.id
          )}`}
        >
          {chat.photoURL ? (
            <img src={chat.photoURL} alt={chat.title} className="w-full h-full object-cover" />
          ) : getChatIcon() ? (
            getChatIcon()
          ) : (
            <span>{getInitials(chat.title)}</span>
          )}
        </div>

        {/* Online Indicator for direct chats */}
        {chat.type === 'direct' && !chat.title.includes('Bot') && (
          <div className="absolute bottom-0 left-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#17212b] rounded-full" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3
              className={`text-sm font-semibold truncate ${
                isActive
                  ? theme === 'light'
                    ? 'text-gray-900'
                    : 'text-white'
                  : theme === 'light'
                  ? 'text-gray-900'
                  : 'text-white'
              }`}
            >
              {chat.title}
            </h3>
            {chat.type === 'channel' && (
              <span className="shrink-0 text-[#2481cc] text-[11px] font-bold">✓</span>
            )}
          </div>

          {/* Time */}
          <span
            className={`text-[11px] shrink-0 ${
              isActive
                ? theme === 'light'
                  ? 'text-[#2481cc]'
                  : 'text-sky-200'
                : theme === 'light'
                ? 'text-gray-400'
                : 'text-[#7f91a4]'
            }`}
          >
            {formatTelegramTime(chat.lastMessage?.createdAt || chat.updatedAt)}
          </span>
        </div>

        {/* Snippet & Status */}
        <div className="flex items-center justify-between gap-1">
          <p
            className={`text-xs truncate flex-1 ${
              isActive
                ? theme === 'light'
                  ? 'text-gray-700'
                  : 'text-sky-100'
                : theme === 'light'
                ? 'text-gray-500'
                : 'text-[#7f91a4]'
            }`}
          >
            {isUserSender && (
              <span className="inline-flex items-center ml-1 align-middle text-[#2481cc]">
                <CheckCheck className="w-3.5 h-3.5 inline" />
              </span>
            )}
            {chat.lastMessage?.text || 'لا توجد رسائل بعد'}
          </p>

          {/* Badges / Pin */}
          <div className="flex items-center gap-1.5 shrink-0">
            {chat.isPinned && (
              <Pin
                className={`w-3.5 h-3.5 rotate-45 ${
                  isActive
                    ? theme === 'light'
                      ? 'text-[#2481cc]'
                      : 'text-sky-200'
                    : 'text-[#7f91a4]'
                }`}
              />
            )}
            {chat.unreadCount && chat.unreadCount > 0 ? (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#2481cc] text-white">
                {chat.unreadCount}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
