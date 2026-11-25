import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Pen, Plus, MessageSquare, Users, Megaphone, Camera, Link2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { ChatListItem } from './ChatListItem';
import { StoriesBar } from './StoriesBar';

interface ChatListProps {
  onOpenNewChat: () => void;
  onOpenNewGroup: () => void;
  onOpenJoinGroup: () => void;
  onOpenNewChannel: () => void;
  onOpenNewStory: () => void;
  isStoriesManuallyCollapsed?: boolean;
  onCollapseStories?: () => void;
  onScrolledPastStoriesChange?: (scrolledPast: boolean) => void;
  expandStoriesSignal?: number;
}

export const ChatList: React.FC<ChatListProps> = ({
  onOpenNewChat,
  onOpenNewGroup,
  onOpenJoinGroup,
  onOpenNewChannel,
  onOpenNewStory,
  isStoriesManuallyCollapsed = false,
  onCollapseStories,
  onScrolledPastStoriesChange,
  expandStoriesSignal = 0,
}) => {
  const { theme, usersMap } = useAuth();
  const {
    chats,
    stories,
    activeChatId,
    setActiveChatId,
    filter,
    searchQuery,
    loadingChats,
    getChatDisplayInfo,
    messageSearchMatches,
    isSearchingMessages,
  } = useChat();
  const [showFabMenu, setShowFabMenu] = useState(false);
  const fabWrapperRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrolledPastRef = useRef(false);

  useEffect(() => {
    if (!showFabMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (fabWrapperRef.current && !fabWrapperRef.current.contains(e.target as Node)) {
        setShowFabMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showFabMenu]);

  // Smoothly scroll back to top when user taps collapsed story rings in header
  useEffect(() => {
    if (expandStoriesSignal > 0 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [expandStoriesSignal]);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const isPast = scrollContainerRef.current.scrollTop > 58;
    if (isPast !== lastScrolledPastRef.current) {
      lastScrolledPastRef.current = isPast;
      onScrolledPastStoriesChange?.(isPast);
    }
  }, [onScrolledPastStoriesChange]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Filter chats in real-time by contact name, username, group member, or message content
  const filteredChats = useMemo(() => {
    const qNoAt = normalizedQuery.replace(/^@/, '');
    return chats.filter((c) => {
      if (filter !== 'all' && c.type !== filter) return false;
      if (normalizedQuery) {
        const displayInfo = getChatDisplayInfo(c);
        const matchTitle = displayInfo.title.toLowerCase().includes(normalizedQuery);
        const matchUsername = (displayInfo.otherUser?.username || '').toLowerCase().includes(qNoAt);
        const matchPhone = (displayInfo.otherUser?.phone || '').toLowerCase().includes(normalizedQuery);
        const matchMember = (c.memberIds || []).some((uid) => {
          const member = usersMap[uid];
          if (!member) return false;
          return (
            member.displayName.toLowerCase().includes(normalizedQuery) ||
            member.username.toLowerCase().includes(qNoAt)
          );
        });
        const matchLastSnippet = (c.lastMessage?.text || '').toLowerCase().includes(normalizedQuery);
        const matchMessageContent = Boolean(messageSearchMatches[c.id]);
        return (
          matchTitle ||
          matchUsername ||
          matchPhone ||
          matchMember ||
          matchLastSnippet ||
          matchMessageContent
        );
      }
      return true;
    });
  }, [chats, filter, normalizedQuery, getChatDisplayInfo, usersMap, messageSearchMatches]);

  // Stories appear inside the scrollable feed (never fixed above it) when active & not collapsed/searching
  const showStoriesInFeed =
    !normalizedQuery && !isStoriesManuallyCollapsed && stories.length > 0;

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      {/* Live Search Status Strip */}
      {normalizedQuery && (
        <div
          className={`px-3.5 py-1.5 text-[11px] font-medium flex items-center justify-between border-b shrink-0 ${
            theme === 'light'
              ? 'bg-slate-50 border-slate-200/70 text-slate-600'
              : 'bg-[#0e151e] border-white/[0.06] text-[#8496ab]'
          }`}
        >
          <span className="tabular-nums">نتائج البحث: {filteredChats.length}</span>
          {isSearchingMessages && (
            <span className="text-[#2481cc]">جاري البحث في الرسائل...</span>
          )}
        </div>
      )}

      {/* Scrollable Feed: Stories at Top of Scroll + Chat Items */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto smooth-scroll-area"
      >
        {/* Scrollable Stories Tray (scrolls away cleanly with the chat list like Telegram) */}
        {showStoriesInFeed && (
          <StoriesBar
            onOpenNewStory={onOpenNewStory}
            onCollapse={onCollapseStories}
          />
        )}

        <div className="py-1.5">
          {loadingChats ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div
                    className={`w-12 h-12 rounded-full ${
                      theme === 'light' ? 'bg-gray-200' : 'bg-[#232e3c]'
                    }`}
                  />
                  <div className="flex-1 space-y-2">
                    <div
                      className={`h-4 w-1/3 rounded ${
                        theme === 'light' ? 'bg-gray-200' : 'bg-[#232e3c]'
                      }`}
                    />
                    <div
                      className={`h-3 w-3/4 rounded ${
                        theme === 'light' ? 'bg-gray-200' : 'bg-[#232e3c]'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-[#2481cc]/10 flex items-center justify-center text-[#2481cc] mb-3">
                <MessageSquare className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold mb-1">
                {searchQuery ? 'لم يتم العثور على محادثات' : 'لا توجد محادثات في هذا القسم'}
              </p>
              <p className="text-xs text-[#7f91a4]">
                {searchQuery ? 'جرب البحث بكلمة أخرى' : 'ابدأ محادثة جديدة عبر زر الإنشاء في الأسفل'}
              </p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isActive={activeChatId === chat.id}
                onClick={() => setActiveChatId(chat.id)}
                matchedMessage={normalizedQuery ? messageSearchMatches[chat.id] : undefined}
                searchHighlight={normalizedQuery || undefined}
              />
            ))
          )}
        </div>
      </div>

      {/* Floating Action Button (FAB) */}
      <div ref={fabWrapperRef} className="absolute bottom-5 left-5 z-20">
        {showFabMenu && (
          <div
            className={`absolute bottom-15 left-0 mb-2 rounded-2xl shadow-2xl border overflow-hidden p-1.5 flex flex-col gap-1 min-w-[195px] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 ${
              theme === 'light'
                ? 'bg-white/95 border-slate-200/90 text-slate-800'
                : 'bg-[#162230]/95 border-white/[0.08] text-white'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setShowFabMenu(false);
                onOpenNewStory();
              }}
              className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium rounded-xl hover:bg-[#2481cc]/12 hover:text-[#2481cc] transition-colors text-right cursor-pointer"
            >
              <Camera className="w-4 h-4 text-[#2481cc]" />
              <span>قصة جديدة</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowFabMenu(false);
                onOpenNewChannel();
              }}
              className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium rounded-xl hover:bg-[#2481cc]/12 hover:text-[#2481cc] transition-colors text-right cursor-pointer"
            >
              <Megaphone className="w-4 h-4 text-[#2481cc]" />
              <span>قناة جديدة</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowFabMenu(false);
                onOpenJoinGroup();
              }}
              className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium rounded-xl hover:bg-[#2481cc]/12 hover:text-[#2481cc] transition-colors text-right cursor-pointer"
            >
              <Link2 className="w-4 h-4 text-[#2481cc]" />
              <span>انضمام لمجموعة برابط</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowFabMenu(false);
                onOpenNewGroup();
              }}
              className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium rounded-xl hover:bg-[#2481cc]/12 hover:text-[#2481cc] transition-colors text-right cursor-pointer"
            >
              <Users className="w-4 h-4 text-[#2481cc]" />
              <span>مجموعة جديدة</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowFabMenu(false);
                onOpenNewChat();
              }}
              className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium rounded-xl hover:bg-[#2481cc]/12 hover:text-[#2481cc] transition-colors text-right cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-[#2481cc]" />
              <span>محادثة خاصة جديدة</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowFabMenu((prev) => !prev)}
          className="w-13 h-13 rounded-2xl bg-[#2481cc] hover:bg-[#1e73b8] text-white shadow-lg shadow-[#2481cc]/30 flex items-center justify-center transition-transform duration-150 hover:scale-105 active:scale-95 cursor-pointer"
          title="إنشاء محادثة جديدة"
        >
          {showFabMenu ? (
            <Plus className="w-6 h-6 rotate-45 transition-transform duration-200" />
          ) : (
            <Pen className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
};
