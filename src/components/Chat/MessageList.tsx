import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ArrowDown, ChevronDown, ChevronUp, MessageCircle, Search, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { MessageBubble } from './MessageBubble';
import { PinnedMessageBanner } from './PinnedMessageBanner';

export const MessageList: React.FC = () => {
  const { theme, wallpaper, fontSize } = useAuth();
  const { messages, loadingMessages, activeChat } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);
  const showScrollBottomRef = useRef(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  const trimmedSearchQuery = searchQuery.trim();

  const matchedMessageIds = useMemo(() => {
    if (!trimmedSearchQuery) return [];
    const normalizedQuery = trimmedSearchQuery.toLowerCase();
    return messages
      .filter((msg) => {
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

  // Clear search query when switching chats
  useEffect(() => {
    setSearchQuery('');
    setActiveMatchIndex(0);
  }, [activeChat?.id]);

  const prevSearchQueryRef = useRef('');
  const matchedIdsKey = matchedMessageIds.join('|');

  // Jump to the latest matching message when the search query changes (without resetting on unrelated incoming messages)
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

  useEffect(() => {
    if (!showScrollBottomRef.current && !trimmedSearchQuery) {
      requestAnimationFrame(() => scrollToBottom(true));
    }
  }, [messages.length, trimmedSearchQuery, scrollToBottom]);

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

  // Determine wallpaper class
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

  // Precompute date dividers once per message list update
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
        className={`shrink-0 border-b px-3 py-2 flex items-center gap-2 z-20 backdrop-blur-md transition-colors ${
          theme === 'light'
            ? 'bg-white/95 border-gray-200 text-gray-800'
            : 'bg-[#17212b]/95 border-[#0e1621] text-white'
        }`}
      >
        <div
          className={`flex-1 flex items-center gap-2 rounded-xl px-3 py-1.5 border transition-colors focus-within:border-[#2481cc] ${
            theme === 'light'
              ? 'bg-gray-100/90 border-gray-200 text-gray-900'
              : 'bg-[#242f3d] border-[#2b3a4a] text-white'
          }`}
        >
          <Search className="w-4 h-4 text-[#7f91a4] shrink-0" />
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
              className="p-0.5 rounded-full text-[#7f91a4] hover:text-[#2481cc] transition-colors cursor-pointer"
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
              className={`text-[11px] font-semibold tabular-nums px-2 py-1 rounded-lg ${
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
              className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                theme === 'light' ? 'hover:bg-gray-100 text-gray-700' : 'hover:bg-white/10 text-gray-200'
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
              className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                theme === 'light' ? 'hover:bg-gray-100 text-gray-700' : 'hover:bg-white/10 text-gray-200'
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

      {/* Messages Scroll Area with Telegram Custom Wallpaper Background */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto smooth-scroll-area px-2 sm:px-6 py-4 space-y-1 transition-colors duration-300 ${getWallpaperClass()}`}
      >
        {loadingMessages ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-[#2481cc] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none">
            <div className="w-16 h-16 rounded-full bg-black/20 flex items-center justify-center text-white/60 mb-3 backdrop-blur-xs">
              <MessageCircle className="w-8 h-8" />
            </div>
            <p className="text-sm font-semibold text-white/90 drop-shadow-xs mb-1">
              لا توجد رسائل بعد
            </p>
            <p className="text-xs text-white/70 drop-shadow-xs">
              أرسل أول رسالة لبدء المحادثة أو شارك صورة أو تسجيل صوتي!
            </p>
          </div>
        ) : (
          messageItemsWithDividers.map(({ msg, dateStr, showDateDivider }) => (
            <React.Fragment key={msg.id}>
              {showDateDivider && (
                <div className="flex justify-center my-3 select-none">
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold backdrop-blur-xs ${
                      theme === 'light'
                        ? 'bg-black/15 text-white'
                        : 'bg-black/35 text-white/90 shadow-xs'
                    }`}
                  >
                    {dateStr}
                  </span>
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
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom(true)}
          className={`absolute bottom-4 left-6 z-20 w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer border ${
            theme === 'light'
              ? 'bg-white text-gray-800 border-gray-200'
              : 'bg-[#182533] text-white border-[#2b3a4a]'
          }`}
          title="النزول للأسفل"
        >
          <ArrowDown className="w-5 h-5 text-[#2481cc]" />
        </button>
      )}
    </div>
  );
};
