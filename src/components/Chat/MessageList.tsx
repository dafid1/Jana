import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  ArrowDown,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Search,
  X,
  Users,
  UserPlus,
  Loader2,
  History,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { getAvatarGradient, getInitials } from '../../utils/telegramHelpers';
import { MessageBubble } from './MessageBubble';
import { PinnedMessageBanner } from './PinnedMessageBanner';

export const MessageList: React.FC = () => {
  const { theme, wallpaper, fontSize } = useAuth();
  const {
    messages,
    loadingMessages,
    hasMoreMessages,
    isLoadingOlderMessages,
    loadOlderMessages,
    firstUnreadMessageId,
    activeChat,
    isActiveChatMember,
    joinChat,
  } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);
  const showScrollBottomRef = useRef(false);
  const lastBottomMsgIdRef = useRef<string | null>(null);
  const prevScrollHeightRef = useRef<number | null>(null);

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);
  const [joinError, setJoinError] = useState('');

  const trimmedSearchQuery = searchQuery.trim();

  const matchedMessageIds = useMemo(() => {
    if (!trimmedSearchQuery) return [];
    const normalizedQuery = trimmedSearchQuery.toLowerCase();
    return messages
      .filter((msg) => {
        if (msg.isDeleted) return false;
        if (msg.text && !msg.isSpoiler && msg.text.toLowerCase().includes(normalizedQuery)) {
          return true;
        }
        if (msg.mediaName && msg.mediaName.toLowerCase().includes(normalizedQuery)) {
          return true;
        }
        if (
          msg.pollData?.question &&
          msg.pollData.question.toLowerCase().includes(normalizedQuery)
        ) {
          return true;
        }
        if (
          msg.pollData?.options?.some((opt) =>
            opt.text.toLowerCase().includes(normalizedQuery)
          )
        ) {
          return true;
        }
        return false;
      })
      .map((msg) => msg.id);
  }, [messages, trimmedSearchQuery]);

  const activeSearchMatchId =
    trimmedSearchQuery && matchedMessageIds.length > 0
      ? matchedMessageIds[Math.min(activeMatchIndex, matchedMessageIds.length - 1)] || null
      : null;

  const scrollMessageIntoView = useCallback((messageId: string) => {
    const targetEl = document.getElementById(`msg-${messageId}`);
    if (!targetEl) return;
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const jumpToMessage = useCallback(
    (messageId: string) => {
      scrollMessageIntoView(messageId);
      setHighlightedMessageId(messageId);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedMessageId(null);
      }, 1600);
    },
    [scrollMessageIntoView]
  );

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  // Clear search query and reset scroll tracking when switching chats
  useEffect(() => {
    setSearchQuery('');
    setActiveMatchIndex(0);
    lastBottomMsgIdRef.current = null;
    prevScrollHeightRef.current = null;
  }, [activeChat?.id]);

  const prevSearchQueryRef = useRef('');
  const matchedIdsKey = matchedMessageIds.join('|');

  useEffect(() => {
    if (!trimmedSearchQuery) {
      prevSearchQueryRef.current = '';
      setActiveMatchIndex(0);
      return;
    }

    const ids = matchedIdsKey ? matchedIdsKey.split('|') : [];
    if (ids.length === 0) {
      prevSearchQueryRef.current = trimmedSearchQuery;
      setActiveMatchIndex(0);
      return;
    }

    const queryChanged = prevSearchQueryRef.current !== trimmedSearchQuery;
    prevSearchQueryRef.current = trimmedSearchQuery;

    if (queryChanged) {
      const latestIndex = ids.length - 1;
      setActiveMatchIndex(latestIndex);
      requestAnimationFrame(() => {
        scrollMessageIntoView(ids[latestIndex]);
      });
    } else {
      setActiveMatchIndex((prev) => Math.min(prev, ids.length - 1));
    }
  }, [trimmedSearchQuery, matchedIdsKey, scrollMessageIntoView]);

  const handleNavigateMatch = useCallback(
    (direction: 'prev' | 'next') => {
      if (matchedMessageIds.length === 0) return;
      const total = matchedMessageIds.length;
      const currentPos = Math.min(activeMatchIndex, total - 1);
      const nextPos =
        direction === 'prev' ? (currentPos - 1 + total) % total : (currentPos + 1) % total;
      setActiveMatchIndex(nextPos);
      const targetId = matchedMessageIds[nextPos];
      if (targetId) {
        requestAnimationFrame(() => scrollMessageIntoView(targetId));
      }
    },
    [matchedMessageIds, activeMatchIndex, scrollMessageIntoView]
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setActiveMatchIndex(0);
    searchInputRef.current?.focus();
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => scrollToBottom(false));
  }, [activeChat?.id, scrollToBottom]);

  // Preserve scroll offset when older messages are prepended; auto-scroll only when bottom message changes
  useEffect(() => {
    const container = containerRef.current;
    if (prevScrollHeightRef.current !== null && container) {
      const delta = container.scrollHeight - prevScrollHeightRef.current;
      if (delta > 0) {
        container.scrollTop += delta;
      }
      prevScrollHeightRef.current = null;
    }

    const newestId = messages.length > 0 ? messages[messages.length - 1].id : null;
    const isNewBottomMessage = newestId !== null && newestId !== lastBottomMsgIdRef.current;
    lastBottomMsgIdRef.current = newestId;

    if (isNewBottomMessage && !showScrollBottomRef.current && !trimmedSearchQuery) {
      requestAnimationFrame(() => scrollToBottom(true));
    }
  }, [messages, trimmedSearchQuery, scrollToBottom]);

  const handleLoadOlder = useCallback(() => {
    if (isLoadingOlderMessages || !hasMoreMessages) return;
    if (containerRef.current) {
      prevScrollHeightRef.current = containerRef.current.scrollHeight;
    }
    loadOlderMessages();
  }, [hasMoreMessages, isLoadingOlderMessages, loadOlderMessages]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    const nextShow = !isNearBottom;
    if (showScrollBottomRef.current !== nextShow) {
      showScrollBottomRef.current = nextShow;
      setShowScrollBottom(nextShow);
    }
  }, []);

  const getWallpaperClass = () => {
    if (wallpaper === 'emerald') return 'bg-gradient-to-b from-[#091e17] to-[#040e0b]';
    if (wallpaper === 'purple') return 'bg-gradient-to-b from-[#1b1028] to-[#0c0514]';
    if (wallpaper === 'desert') return 'bg-gradient-to-b from-[#241607] to-[#120b03]';
    if (wallpaper === 'night') return 'bg-[#090d13]';
    return theme === 'light' ? 'telegram-doodle-light' : 'telegram-doodle-dark';
  };

  const getFontSizeClass = () => {
    if (fontSize === 'small') return 'text-xs';
    if (fontSize === 'large') return 'text-base';
    return 'text-sm';
  };

  const messageItemsWithDividers = useMemo(() => {
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    let lastDate = '';

    return messages.map((msg) => {
      const msgDate = new Date(msg.createdAt);
      const msgKey = `${msgDate.getFullYear()}-${msgDate.getMonth()}-${msgDate.getDate()}`;
      const dateStr =
        msgKey === todayKey
          ? 'اليوم'
          : msgDate.toLocaleDateString('ar-SA', { month: 'long', day: 'numeric' });

      const showDateDivider = dateStr !== lastDate;
      if (showDateDivider) {
        lastDate = dateStr;
      }

      return { msg, dateStr, showDateDivider };
    });
  }, [messages]);

  return (
    <div className={`relative flex-1 flex flex-col min-h-0 ${getFontSizeClass()}`}>
      {/* In-Conversation Search Bar */}
      <div
        className={`shrink-0 border-b px-3 py-2 flex items-center gap-2 z-20 backdrop-blur-md transition-colors duration-150 ${
          theme === 'light'
            ? 'bg-white/95 border-slate-200/80 text-slate-900'
            : 'bg-[#111923]/95 border-white/[0.06] text-white'
        }`}
      >
        <div
          className={`flex-1 flex items-center gap-2 rounded-xl px-3 py-1.5 border transition-all duration-150 focus-within:border-[#2481cc] focus-within:ring-2 ${
            theme === 'light'
              ? 'bg-slate-100/90 border-slate-200/80 text-slate-900 focus-within:bg-white focus-within:ring-[#2481cc]/20'
              : 'bg-[#1a2533] border-white/[0.07] text-white focus-within:bg-[#1e2b3b] focus-within:ring-[#2481cc]/25'
          }`}
        >
          <Search className="w-4 h-4 text-[#8ea0b5] shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleNavigateMatch(e.shiftKey ? 'next' : 'prev');
              } else if (e.key === 'Escape' && searchQuery) {
                e.preventDefault();
                handleClearSearch();
              }
            }}
            placeholder="ابحث داخل المحادثة..."
            aria-label="البحث عن نصوص داخل المحادثة الحالية"
            className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm focus:outline-none placeholder:text-[#7f91a4]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="p-0.5 rounded-lg text-[#8ea0b5] hover:text-[#2481cc] transition-colors cursor-pointer"
              title="مسح البحث"
              aria-label="مسح نص البحث"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {trimmedSearchQuery && (
          <div className="flex items-center gap-1 shrink-0">
            <span
              dir="ltr"
              className={`text-[11px] font-semibold tabular-nums px-2.5 py-1 rounded-lg ${
                matchedMessageIds.length === 0
                  ? 'bg-rose-500/15 text-rose-400'
                  : theme === 'light'
                  ? 'bg-[#2481cc]/10 text-[#2481cc]'
                  : 'bg-[#2481cc]/20 text-sky-300'
              }`}
            >
              {matchedMessageIds.length === 0
                ? '0 / 0'
                : `${Math.min(activeMatchIndex + 1, matchedMessageIds.length)} / ${
                    matchedMessageIds.length
                  }`}
            </span>

            <button
              type="button"
              onClick={() => handleNavigateMatch('prev')}
              disabled={matchedMessageIds.length === 0}
              className={`min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                theme === 'light'
                  ? 'hover:bg-slate-100 text-slate-700'
                  : 'hover:bg-white/[0.08] text-slate-200'
              }`}
              title="النتيجة الأقدم"
              aria-label="النتيجة الأقدم"
            >
              <ChevronUp className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleNavigateMatch('next')}
              disabled={matchedMessageIds.length === 0}
              className={`min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                theme === 'light'
                  ? 'hover:bg-slate-100 text-slate-700'
                  : 'hover:bg-white/[0.08] text-slate-200'
              }`}
              title="النتيجة الأحدث"
              aria-label="النتيجة الأحدث"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Pinned Message Bar */}
      <PinnedMessageBanner />

      {/* Messages Scroll Area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto smooth-scroll-area px-2 sm:px-6 py-4 space-y-1 transition-colors duration-300 ${getWallpaperClass()}`}
      >
        {loadingMessages ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-[#2481cc] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeChat?.type === 'group' && !isActiveChatMember ? (
          <div className="h-full flex items-center justify-center p-6 select-none">
            <div
              className={`max-w-sm w-full rounded-3xl px-6 py-7 text-center backdrop-blur-md border shadow-2xl ${
                theme === 'light'
                  ? 'bg-white/90 border-slate-200/80 text-slate-900'
                  : 'bg-[#111923]/85 border-white/[0.08] text-white'
              }`}
            >
              <div
                className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center font-bold text-2xl text-white shadow-lg mb-3 overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
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

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2481cc]/15 text-[#2481cc] text-[11px] font-bold mb-2">
                <Users className="w-3.5 h-3.5" />
                <span>دعوة مجموعة • {activeChat.membersCount || activeChat.memberIds?.length || 1} أعضاء</span>
              </div>

              <h3 className="text-base font-extrabold mb-1">{activeChat.title}</h3>
              {activeChat.description && (
                <p
                  className={`text-xs leading-relaxed mb-4 ${
                    theme === 'light' ? 'text-slate-600' : 'text-[#8ea0b5]'
                  }`}
                >
                  {activeChat.description}
                </p>
              )}

              <p
                className={`text-[11px] leading-relaxed mb-5 ${
                  theme === 'light' ? 'text-slate-500' : 'text-[#7f91a4]'
                }`}
              >
                انضم إلى المجموعة الآن للاطلاع على الرسائل والمشاركة مع الأعضاء.
              </p>

              {joinError && (
                <div className="p-2 mb-3 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-400 text-xs font-semibold">
                  {joinError}
                </div>
              )}

              <button
                type="button"
                disabled={isJoiningGroup}
                onClick={async () => {
                  setJoinError('');
                  setIsJoiningGroup(true);
                  try {
                    await joinChat(activeChat.id);
                  } catch (err) {
                    setJoinError(err instanceof Error ? err.message : 'تعذر الانضمام إلى المجموعة');
                  } finally {
                    setIsJoiningGroup(false);
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#2481cc] hover:bg-[#1e6fb1] text-white text-xs font-bold shadow-lg shadow-[#2481cc]/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isJoiningGroup ? 'جاري الانضمام...' : 'انضمام إلى المجموعة'}</span>
              </button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center p-6 select-none">
            <div
              className={`max-w-xs w-full rounded-3xl px-6 py-6 text-center backdrop-blur-md border shadow-xl ${
                theme === 'light'
                  ? 'bg-white/80 border-slate-200/80 text-slate-800'
                  : 'bg-[#111923]/75 border-white/[0.08] text-white'
              }`}
            >
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#2481cc]/15 text-[#2481cc] flex items-center justify-center mb-3">
                <MessageCircle className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold mb-1">لا توجد رسائل بعد</p>
              <p
                className={`text-xs leading-relaxed ${
                  theme === 'light' ? 'text-slate-500' : 'text-[#8ea0b5]'
                }`}
              >
                {!isActiveChatMember && activeChat?.type === 'channel'
                  ? 'اضغط على زر الانضمام بالأسفل للاشتراك في هذه القناة ومتابعة منشوراتها'
                  : 'أرسل أول رسالة لبدء المحادثة أو شارك صورة أو فيديو أو ملصقاً أو تسجيلاً صوتياً'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Load Older Messages Pagination Button */}
            {hasMoreMessages && (
              <div className="flex justify-center pt-1 pb-3 select-none">
                <button
                  type="button"
                  disabled={isLoadingOlderMessages}
                  onClick={handleLoadOlder}
                  className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md shadow-sm transition-all cursor-pointer disabled:opacity-60 ${
                    theme === 'light'
                      ? 'bg-white/90 border-slate-200 text-[#2481cc] hover:bg-white'
                      : 'bg-[#162230]/90 border-white/[0.1] text-sky-300 hover:bg-[#1e2d3f]'
                  }`}
                >
                  {isLoadingOlderMessages ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <History className="w-3.5 h-3.5" />
                  )}
                  <span>{isLoadingOlderMessages ? 'جاري التحميل...' : 'تحميل رسائل أقدم'}</span>
                </button>
              </div>
            )}

            {messageItemsWithDividers.map(({ msg, dateStr, showDateDivider }) => (
              <React.Fragment key={msg.id}>
                {showDateDivider && (
                  <div className="flex justify-center my-3 select-none">
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold backdrop-blur-md border shadow-xs ${
                        theme === 'light'
                          ? 'bg-slate-900/45 text-white border-white/15'
                          : 'bg-[#111923]/80 text-white/90 border-white/[0.08]'
                      }`}
                    >
                      {dateStr}
                    </span>
                  </div>
                )}

                {firstUnreadMessageId === msg.id && (
                  <div className="flex items-center gap-3 my-2.5 px-2 select-none">
                    <div className="flex-1 h-px bg-[#2481cc]/35" />
                    <span className="px-3 py-0.5 rounded-full text-[11px] font-bold bg-[#2481cc]/15 text-[#2481cc] border border-[#2481cc]/30 backdrop-blur-xs">
                      رسائل غير مقروءة
                    </span>
                    <div className="flex-1 h-px bg-[#2481cc]/35" />
                  </div>
                )}

                <MessageBubble
                  message={msg}
                  isHighlighted={highlightedMessageId === msg.id}
                  searchQuery={trimmedSearchQuery}
                  isActiveSearchMatch={activeSearchMatchId === msg.id}
                  onJumpToMessage={jumpToMessage}
                />
              </React.Fragment>
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className={`absolute bottom-4 left-5 z-20 w-11 h-11 rounded-2xl shadow-xl flex items-center justify-center backdrop-blur-md transition-transform duration-150 hover:scale-105 active:scale-95 cursor-pointer border ${
            theme === 'light'
              ? 'bg-white/95 text-slate-800 border-slate-200/80'
              : 'bg-[#162230]/95 text-white border-white/[0.08]'
          }`}
          title="النزول للأسفل"
          aria-label="النزول للأسفل"
        >
          <ArrowDown className="w-5 h-5 text-[#2481cc]" />
        </button>
      )}
    </div>
  );
};
