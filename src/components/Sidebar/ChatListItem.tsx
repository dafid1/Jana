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
  Archive,
  ArchiveRestore,
  MailOpen,
  MessageSquareDot,
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
  isArchived?: boolean;
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
      <mark className="bg-[#3390ec]/30 text-inherit rounded px-0.5 font-semibold">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export const ChatListItem: React.FC<ChatListItemProps> = React.memo(
  ({ chat, isActive, onClick, matchedMessage, searchHighlight, isArchived = false }) => {
    const {
      theme,
      currentUser,
      userProfile,
      togglePinChat,
      toggleMuteChat,
      toggleArchiveChat,
      toggleMarkChatUnread,
    } = useAuth();
    const { getChatDisplayInfo, chatTypingMap } = useChat();
    const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
    const [swipeX, setSwipeX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);

    const contextRef = useRef<HTMLDivElement>(null);
    const startRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
    const gestureAxisRef = useRef<'none' | 'horizontal' | 'vertical'>('none');
    const suppressClickRef = useRef(false);
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

    const isManualUnread = Boolean(userProfile?.manualUnreadChatIds?.includes(chat.id));

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

    const canArchive = chat.type !== 'saved';

    const handlePointerDown = (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      startRef.current = { x: e.clientX, y: e.clientY, active: true };
      gestureAxisRef.current = 'none';
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (e.pointerType !== 'mouse') {
        const cx = e.clientX;
        const cy = e.clientY;
        longPressTimerRef.current = setTimeout(() => {
          suppressClickRef.current = true;
          setContextMenuPos({ x: cx, y: cy });
        }, 480);
      }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (!startRef.current.active) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;

      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }

      if (!canArchive) return;

      if (gestureAxisRef.current === 'none') {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          gestureAxisRef.current = 'horizontal';
          setIsSwiping(true);
        } else if (Math.abs(dy) > 10) {
          gestureAxisRef.current = 'vertical';
          startRef.current.active = false;
          return;
        }
      }

      if (gestureAxisRef.current === 'horizontal') {
        const clamped = Math.max(-92, Math.min(0, dx));
        setSwipeX(clamped);
      }
    };

    const handlePointerEnd = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (!startRef.current.active) return;
      startRef.current.active = false;

      if (gestureAxisRef.current === 'horizontal') {
        if (swipeX <= -64 && canArchive) {
          suppressClickRef.current = true;
          toggleArchiveChat(chat.id).catch(() => {});
        }
        setIsSwiping(false);
        setSwipeX(0);
      }
      gestureAxisRef.current = 'none';
    };

    return (
      <>
        <div className="relative overflow-hidden">
          {/* Swipe-to-Archive Background Pill (Telegram Android behavior) */}
          {canArchive && swipeX < -6 && (
            <div
              className={`absolute inset-y-0 left-0 right-0 flex items-center justify-end px-5 ${
                Math.abs(swipeX) >= 64 ? 'bg-[#3390ec]' : 'bg-[#6c7d92]'
              } text-white transition-colors`}
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                {isArchived ? (
                  <>
                    <ArchiveRestore className="w-4 h-4" />
                    <span>إلغاء الأرشفة</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4" />
                    <span>أرشفة</span>
                  </>
                )}
              </div>
            </div>
          )}

          <div
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              onClick();
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenuPos({ x: e.clientX, y: e.clientY });
            }}
            style={{
              transform: swipeX !== 0 ? `translateX(${swipeX}px)` : undefined,
              transition: isSwiping ? 'none' : 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className={`relative flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-150 select-none touch-pan-y ${
              isActive
                ? theme === 'light'
                  ? 'bg-[#e7f2fc]'
                  : 'bg-[#2b5278]'
                : theme === 'light'
                ? 'bg-white hover:bg-slate-100/80'
                : 'bg-[#17212b] hover:bg-[#202b36]'
            }`}
          >
            {/* Avatar */}
            <div className="relative shrink-0">
              <div
                className={`w-[50px] h-[50px] rounded-full flex items-center justify-center font-bold text-base text-white shadow-xs overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
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
                    isActive
                      ? theme === 'light'
                        ? 'border-[#e7f2fc]'
                        : 'border-[#2b5278]'
                      : theme === 'light'
                      ? 'border-white'
                      : 'border-[#17212b]'
                  }`}
                />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1.5 mb-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h3
                    className={`text-[14.5px] font-semibold truncate ${
                      theme === 'light' ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    {highlightMatch(displayInfo.title, searchHighlight)}
                  </h3>
                  {chat.type === 'channel' && (
                    <span
                      className={`shrink-0 text-[11px] font-bold ${
                        isActive && theme === 'dark' ? 'text-sky-200' : 'text-[#3390ec]'
                      }`}
                    >
                      ✓
                    </span>
                  )}
                  {chat.isMuted && (
                    <VolumeX
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive && theme === 'dark' ? 'text-white/70' : 'text-[#7f91a4]'
                      }`}
                      aria-label="الإشعارات مكتومة"
                    />
                  )}
                </div>

                <span
                  className={`text-[11px] tabular-nums shrink-0 ${
                    isActive
                      ? theme === 'light'
                        ? 'text-[#3390ec] font-medium'
                        : 'text-sky-100'
                      : theme === 'light'
                      ? 'text-slate-400'
                      : 'text-[#7f91a4]'
                  }`}
                >
                  {formatTelegramTime(snippetTime)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-1.5">
                {liveTyping && !searchHighlight ? (
                  <p
                    className={`text-xs font-semibold truncate flex-1 flex items-center gap-1.5 ${
                      isActive && theme === 'dark' ? 'text-sky-200' : 'text-[#3390ec]'
                    }`}
                  >
                    {liveTyping.activity === 'recording' ? (
                      <Mic className="w-3.5 h-3.5 animate-pulse shrink-0" />
                    ) : null}
                    <span className="truncate">{liveTyping.label}...</span>
                  </p>
                ) : (
                  <p
                    className={`text-[13px] truncate flex-1 ${
                      isActive
                        ? theme === 'light'
                          ? 'text-slate-700'
                          : 'text-sky-100'
                        : theme === 'light'
                        ? 'text-slate-500'
                        : 'text-[#7f91a4]'
                    }`}
                  >
                    {isUserSender && (
                      <span
                        className={`inline-flex items-center ml-1 align-middle ${
                          isReadByOthers
                            ? isActive && theme === 'dark'
                              ? 'text-sky-200'
                              : 'text-[#3390ec]'
                            : 'opacity-65'
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
                            ? 'text-[#3390ec]'
                            : 'text-sky-200'
                          : 'text-[#7f91a4]'
                      }`}
                    />
                  )}
                  {chat.unreadCount && chat.unreadCount > 0 ? (
                    <span
                      className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums text-white inline-flex items-center justify-center ${
                        chat.isMuted ? 'bg-[#6c7d92]' : 'bg-[#3390ec]'
                      }`}
                    >
                      {chat.unreadCount}
                    </span>
                  ) : isManualUnread ? (
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        chat.isMuted ? 'bg-[#6c7d92]' : 'bg-[#3390ec]'
                      }`}
                      title="غير مقروء"
                    />
                  ) : null}
                </div>
              </div>
            </div>

            {/* Telegram Hairline Divider inset past Avatar */}
            <div
              className={`absolute bottom-0 left-0 right-[74px] h-px pointer-events-none ${
                theme === 'light' ? 'bg-slate-200/70' : 'bg-black/25'
              }`}
            />
          </div>
        </div>

        {/* Telegram Context Menu (Right-Click or Mobile Long-Press) */}
        {contextMenuPos && (
          <div
            ref={contextRef}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              top: Math.min(contextMenuPos.y, window.innerHeight - 210),
              left: Math.min(contextMenuPos.x, window.innerWidth - 205),
            }}
            className={`fixed z-50 w-48 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-xl text-xs font-semibold animate-in fade-in zoom-in-95 duration-150 ${
              theme === 'light'
                ? 'bg-white/95 border-slate-200 text-slate-800'
                : 'bg-[#17212b]/95 border-white/10 text-white'
            }`}
          >
            {chat.type !== 'saved' && (
              <button
                type="button"
                onClick={() => {
                  togglePinChat(chat.id);
                  setContextMenuPos(null);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                  theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                }`}
              >
                <Pin className="w-4 h-4 text-[#3390ec] rotate-45" />
                <span>{chat.isPinned ? 'إلغاء التثبيت' : 'تثبيت في الأعلى'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                toggleMarkChatUnread(chat.id);
                setContextMenuPos(null);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
              }`}
            >
              {isManualUnread ? (
                <>
                  <MailOpen className="w-4 h-4 text-[#3390ec]" />
                  <span>تمييز كمقروء</span>
                </>
              ) : (
                <>
                  <MessageSquareDot className="w-4 h-4 text-[#3390ec]" />
                  <span>تمييز كغير مقروء</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                toggleMuteChat(chat.id);
                setContextMenuPos(null);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
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

            {canArchive && (
              <button
                type="button"
                onClick={() => {
                  toggleArchiveChat(chat.id);
                  setContextMenuPos(null);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                  theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                }`}
              >
                {isArchived ? (
                  <>
                    <ArchiveRestore className="w-4 h-4 text-[#3390ec]" />
                    <span>إلغاء الأرشفة</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4 text-[#8ea0b5]" />
                    <span>أرشفة المحادثة</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </>
    );
  }
);
