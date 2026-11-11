import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, MessageCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { MessageBubble } from './MessageBubble';
import { PinnedMessageBanner } from './PinnedMessageBanner';

export const MessageList: React.FC = () => {
  const { theme, wallpaper, fontSize } = useAuth();
  const { messages, loadingMessages, activeChat } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [activeChat?.id]);

  useEffect(() => {
    if (!showScrollBottom) {
      scrollToBottom(true);
    }
  }, [messages.length]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    setShowScrollBottom(!isNearBottom);
  };

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

  // Group messages by date
  const renderMessagesWithDateDividers = () => {
    let lastDate = '';

    return messages.map((msg) => {
      const msgDate = new Date(msg.createdAt);
      const isToday =
        msgDate.getDate() === new Date().getDate() &&
        msgDate.getMonth() === new Date().getMonth() &&
        msgDate.getFullYear() === new Date().getFullYear();

      const dateStr = isToday
        ? 'اليوم'
        : msgDate.toLocaleDateString('ar-SA', { month: 'long', day: 'numeric' });

      let showDateDivider = false;
      if (dateStr !== lastDate) {
        showDateDivider = true;
        lastDate = dateStr;
      }

      return (
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
          <MessageBubble message={msg} />
        </React.Fragment>
      );
    });
  };

  return (
    <div className={`relative flex-1 flex flex-col min-h-0 ${getFontSizeClass()}`}>
      {/* Pinned Message Bar */}
      <PinnedMessageBanner />

      {/* Messages Scroll Area with Telegram Custom Wallpaper Background */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto px-2 sm:px-6 py-4 space-y-1 transition-colors duration-300 ${getWallpaperClass()}`}
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
          renderMessagesWithDateDividers()
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
