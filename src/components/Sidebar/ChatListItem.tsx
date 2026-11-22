import React from 'react';
import { Check, CheckCheck, Pin, Bookmark, Megaphone, Users } from 'lucide-react';
import { Chat, Message } from '../../types/telegram';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import {
  getAvatarGradient,
  getInitials,
  formatTelegramTime,
  getMessageReplyPreview,
} from '../../utils/telegramHelpers';

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
  matchedMessage?: Message;
  searchHighlight?: string;
}

function highlightMatch(text: string, query?: string): React.ReactNode {
  if (!query || !text) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[#2481cc]/35 text-inherit rounded px-0.5 font-semibold">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export const ChatListItem: React.FC<ChatListItemProps> = React.memo(({
  chat,
  isActive,
  onClick,
  matchedMessage,
  searchHighlight,
}) => {
  const { theme, currentUser } = useAuth();
  const { getChatDisplayInfo } = useChat();

  const displayInfo = getChatDisplayInfo(chat);
  const snippetText = matchedMessage
    ? getMessageReplyPreview(matchedMessage)
    : chat.lastMessage?.text || 'لا توجد رسائل بعد';
  const snippetTime = matchedMessage?.createdAt || chat.lastMessage?.createdAt || chat.updatedAt;
  const isUserSender = matchedMessage
    ? matchedMessage.senderId === currentUser?.uid
    : chat.lastMessage?.senderId === currentUser?.uid;
  const readBy = matchedMessage?.readBy || chat.lastMessage?.readBy || [];
  const isReadByOthers =
    chat.type === 'saved' ||
    readBy.some((uid) => uid !== currentUser?.uid);

  const getChatIcon = () => {
    if (chat.type === 'saved') return <Bookmark className="w-5 h-5 text-white" />;
    if (chat.type === 'channel') return <Megaphone className="w-4 h-4 text-white" />;
    if (chat.type === 'group') return <Users className="w-4 h-4 text-white" />;
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
            displayInfo.otherUser?.uid || chat.id
          )}`}
        >
          {displayInfo.photoURL ? (
            <img
              src={displayInfo.photoURL}
              alt={displayInfo.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          ) : getChatIcon() ? (
            getChatIcon()
          ) : (
            <span>{getInitials(displayInfo.title)}</span>
          )}
        </div>

        {/* Real Online Indicator for direct chats */}
        {chat.type === 'direct' && displayInfo.isOnline && (
          <div className="absolute bottom-0 left-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#17212b] rounded-full" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3
              className={`text-sm font-semibold truncate ${
                theme === 'light' ? 'text-gray-900' : 'text-white'
              }`}
            >
              {highlightMatch(displayInfo.title, searchHighlight)}
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
            {formatTelegramTime(snippetTime)}
          </span>
        </div>

        {/* Snippet & Real Read Status */}
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
              <span
                className={`inline-flex items-center ml-1 align-middle ${
                  isReadByOthers ? 'text-[#38bdf8]' : 'opacity-65'
                }`}
                title={isReadByOthers ? 'تمت القراءة' : 'تم الإرسال'}
              >
                {isReadByOthers ? (
                  <CheckCheck className="w-3.5 h-3.5 inline" />
                ) : (
                  <Check className="w-3.5 h-3.5 inline" />
                )}
              </span>
            )}
            {highlightMatch(snippetText, searchHighlight)}
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
});
