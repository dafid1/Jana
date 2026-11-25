import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  CheckCheck,
  Pin,
  Bookmark,
  Megaphone,
  Users,
  VolumeX,
  Volume2,
  Mic,
} from 'lucide-react';
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

export const ChatListItem: React.FC<ChatListItemProps> = React.memo(
  ({ chat, isActive, onClick, matchedMessage, searchHighlight }) => {
    const { theme, currentUser, togglePinChat, toggleMuteChat } = useAuth();
    const { getChatDisplayInfo, chatTypingMap } = useChat();
    const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
    const contextRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!contextMenuPos) return;
      const close = () => setContextMenuPos(null);
      window.addEventListener('mousedown', close);
      window.addEventListener('scroll', close, true);
      return () => {
        window.removeEventListener('mousedown', close);
        window.removeEventListener('scroll', close, true);
      };
    }, [contextMenuPos]);

    const displayInfo = getChatDisplayInfo(chat);
    const liveTyping = chatTypingMap[chat.id];
    const snippetText = matchedMessage
      ? getMessageReplyPreview(matchedMessage)
      : chat.lastMessage?.text || 'لا توجد رسائل بعد';
    const snippetTime = matchedMessage?.createdAt || chat.lastMessage?.createdAt || chat.updatedAt;
    const isUserSender = matchedMessage
      ? matchedMessage.senderId === currentUser?.uid
      : chat.lastMessage?.senderId === currentUser?.uid;
    const readBy = matchedMessage?.readBy || chat.lastMessage?.readBy || [];
    const isReadByOthers =
      chat.type === 'saved' || readBy.some((uid) => uid !== currentUser?.uid);

    const getChatIcon = () => {
      if (chat.type === 'saved') return <Bookmark className="w-5 h-5 text-white" />;
      if (chat.type === 'channel') return <Megaphone className="w-4 h-4 text-white" />;
      if (chat.type === 'group') return <Users className="w-4 h-4 text-white" />;
      return null;
    };

    return (
      <>
        <div
          onClick={onClick}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenuPos({ x: e.clientX, y: e.clientY });
          }}
          className={`mx-2 my-0.5 rounded-2xl flex items-center gap-3 px-2.5 py-2.5 cursor-pointer transition-colors duration-150 select-none ${
            isActive
              ? theme === 'light'
                ? 'bg-[#e6f1fc] shadow-xs'
                : 'bg-[#203b57] shadow-xs'
              : theme === 'light'
              ? 'hover:bg-slate-100/90'
              : 'hover:bg-white/[0.04]'
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

            {chat.type === 'direct' && displayInfo.isOnline && (
              <div
                className={`absolute bottom-0 left-0 w-3.5 h-3.5 bg-emerald-500 border-2 rounded-full ${
                  theme === 'light' ? 'border-white' : 'border-[#111923]'
                }`}
              />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1.5 mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3
                  className={`text-sm font-semibold truncate ${
                    theme === 'light' ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  {highlightMatch(displayInfo.title, searchHighlight)}
                </h3>
                {chat.type === 'channel' && (
                  <span className="shrink-0 text-[#2481cc] text-[11px] font-bold">✓</span>
                )}
                {chat.isMuted && (
                  <VolumeX
                    className="w-3.5 h-3.5 shrink-0 text-[#8496ab]"
                    aria-label="الإشعارات مكتومة"
                  />
                )}
              </div>

              <span
                className={`text-[11px] tabular-nums shrink-0 ${
                  isActive
                    ? theme === 'light'
                      ? 'text-[#2481cc] font-medium'
                      : 'text-sky-200'
                    : theme === 'light'
                    ? 'text-slate-400'
                    : 'text-[#8496ab]'
                }`}
              >
                {formatTelegramTime(snippetTime)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-1.5">
              {liveTyping && !searchHighlight ? (
                <p className="text-xs font-semibold text-[#2481cc] truncate flex-1 flex items-center gap-1.5">
                  {liveTyping.activity === 'recording' ? (
                    <Mic className="w-3.5 h-3.5 animate-pulse shrink-0" />
                  ) : null}
                  <span className="truncate">{liveTyping.label}...</span>
                </p>
              ) : (
                <p
                  className={`text-xs truncate flex-1 ${
                    isActive
                      ? theme === 'light'
                        ? 'text-slate-700'
                        : 'text-sky-100'
                      : theme === 'light'
                      ? 'text-slate-500'
                      : 'text-[#8496ab]'
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
              )}

              <div className="flex items-center gap-1.5 shrink-0">
                {chat.isPinned && (
                  <Pin
                    className={`w-3.5 h-3.5 rotate-45 ${
                      isActive
                        ? theme === 'light'
                          ? 'text-[#2481cc]'
                          : 'text-sky-200'
                        : 'text-[#8496ab]'
                    }`}
                  />
                )}
                {chat.unreadCount && chat.unreadCount > 0 ? (
                  <span
                    className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold tabular-nums text-white inline-flex items-center justify-center ${
                      chat.isMuted ? 'bg-[#6c7d92]' : 'bg-[#2481cc]'
                    }`}
                  >
                    {chat.unreadCount}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Context Menu for Pin & Mute */}
        {contextMenuPos && (
          <div
            ref={contextRef}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              top: Math.min(contextMenuPos.y, window.innerHeight - 120),
              left: Math.min(contextMenuPos.x, window.innerWidth - 190),
            }}
            className={`fixed z-50 w-44 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-xl text-xs font-semibold ${
              theme === 'light'
                ? 'bg-white/95 border-slate-200 text-slate-800'
                : 'bg-[#162230]/95 border-white/10 text-white'
            }`}
          >
            {chat.type !== 'saved' && (
              <button
                type="button"
                onClick={() => {
                  togglePinChat(chat.id);
                  setContextMenuPos(null);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                  theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                }`}
              >
                <Pin className="w-4 h-4 text-[#2481cc] rotate-45" />
                <span>{chat.isPinned ? 'إلغاء التثبيت' : 'تثبيت في الأعلى'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                toggleMuteChat(chat.id);
                setContextMenuPos(null);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
              }`}
            >
              {chat.isMuted ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span>إلغاء كتم الإشعارات</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-[#8ea0b5]" />
                  <span>كتم الإشعارات</span>
                </>
              )}
            </button>
          </div>
        )}
      </>
    );
  }
);
