import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Pen, MessageSquare, Camera, Archive, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { ChatListItem } from './ChatListItem';
import { StoriesBar } from './StoriesBar';
import { SearchResultTab } from './SidebarHeader';
import { useBackHandler } from '../../utils/androidBackNavigation';

interface ChatListProps {
  onOpenNewChat: () => void;
  onOpenNewStory: () => void;
  isStoriesManuallyCollapsed?: boolean;
  onCollapseStories?: () => void;
  onScrolledPastStoriesChange?: (scrolledPast: boolean) => void;
  expandStoriesSignal?: number;
  searchTab?: SearchResultTab;
}

export const ChatList: React.FC<ChatListProps> = ({
  onOpenNewChat,
  onOpenNewStory,
  isStoriesManuallyCollapsed = false,
  onCollapseStories,
  onScrolledPastStoriesChange,
  expandStoriesSignal = 0,
  searchTab = 'chats',
}) => {
  const { theme, usersMap, userProfile } = useAuth();
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

  const [isArchivedOpen, setIsArchivedOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrolledPastRef = useRef(false);

  useBackHandler(isArchivedOpen, () => setIsArchivedOpen(false), 62);

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

  const archivedSet = useMemo(
    () => new Set(userProfile?.archivedChatIds || []),
    [userProfile?.archivedChatIds]
  );

  const archivedChats = useMemo(
    () => chats.filter((c) => c.type !== 'saved' && archivedSet.has(c.id)),
    [chats, archivedSet]
  );

  const archivedPreviewTitles = useMemo(
    () =>
      archivedChats
        .slice(0, 3)
        .map((c) => getChatDisplayInfo(c).title)
        .join('، '),
    [archivedChats, getChatDisplayInfo]
  );

  const archivedUnreadCount = useMemo(
    () => archivedChats.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
    [archivedChats]
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Filter active or search-matched chats
  const filteredChats = useMemo(() => {
    const qNoAt = normalizedQuery.replace(/^@/, '');
    return chats.filter((c) => {
      if (!normalizedQuery && c.type !== 'saved' && archivedSet.has(c.id)) {
        return false;
      }
      if (filter !== 'all' && c.type !== filter) return false;

      if (normalizedQuery) {
        const matched = messageSearchMatches[c.id];
        if (searchTab !== 'chats') {
          if (!matched) return false;
          if (searchTab === 'media') {
            return matched.type === 'image' || matched.type === 'video';
          }
          if (searchTab === 'links') {
            return Boolean(matched.linkPreview || /https?:\/\//i.test(matched.text || ''));
          }
          if (searchTab === 'files') {
            return matched.type === 'file';
          }
          if (searchTab === 'voice') {
            return matched.type === 'voice';
          }
        }

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
        const matchMessageContent = Boolean(matched);
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
  }, [
    chats,
    filter,
    normalizedQuery,
    searchTab,
    archivedSet,
    getChatDisplayInfo,
    usersMap,
    messageSearchMatches,
  ]);

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
              : 'bg-[#0e1621] border-white/[0.06] text-[#8496ab]'
          }`}
        >
          <span className="tabular-nums">نتائج البحث: {filteredChats.length}</span>
          {isSearchingMessages && (
            <span className="text-[#3390ec]">جاري البحث في الرسائل...</span>
          )}
        </div>
      )}

      {/* Scrollable Feed: Stories + Archived Row + Chat Items */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto smooth-scroll-area"
      >
        {showStoriesInFeed && (
          <StoriesBar
            onOpenNewStory={onOpenNewStory}
            onCollapse={onCollapseStories}
          />
        )}

        {/* Telegram Archived Chats Entry Row */}
        {!normalizedQuery && filter === 'all' && archivedChats.length > 0 && (
          <button
            type="button"
            onClick={() => setIsArchivedOpen(true)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-right transition-colors cursor-pointer relative ${
              theme === 'light'
                ? 'bg-white hover:bg-slate-100/80'
                : 'bg-[#17212b] hover:bg-[#202b36]'
            }`}
          >
            <div className="w-[50px] h-[50px] rounded-full bg-[#6c7d92] text-white flex items-center justify-center shrink-0">
              <Archive className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-[14.5px] font-semibold truncate">المحادثات المؤرشفة</span>
                {archivedUnreadCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#6c7d92] text-white text-[11px] font-bold tabular-nums inline-flex items-center justify-center">
                    {archivedUnreadCount}
                  </span>
                )}
              </div>
              <p className="text-[13px] truncate text-[#7f91a4]">
                {archivedPreviewTitles || `${archivedChats.length} محادثات`}
              </p>
            </div>
            <div
              className={`absolute bottom-0 left-0 right-[74px] h-px pointer-events-none ${
                theme === 'light' ? 'bg-slate-200/70' : 'bg-black/25'
              }`}
            />
          </button>
        )}

        <div className="pb-24">
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
              <div className="w-16 h-16 rounded-full bg-[#3390ec]/10 flex items-center justify-center text-[#3390ec] mb-3">
                <MessageSquare className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold mb-1">
                {searchQuery ? 'لم يتم العثور على نتائج' : 'لا توجد محادثات في هذا القسم'}
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
                isArchived={archivedSet.has(chat.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Telegram Android Dual Floating Action Buttons: Mini Story Camera + Primary Pen FAB */}
      {!isArchivedOpen && (
        <div className="absolute bottom-5 left-5 z-20 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onOpenNewStory}
            aria-label="إضافة قصة"
            title="إضافة قصة"
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer border ${
              theme === 'light'
                ? 'bg-white text-[#3390ec] border-slate-200/80 hover:bg-slate-50'
                : 'bg-[#233140] text-[#5288c1] border-white/10 hover:bg-[#2a3b4d]'
            }`}
          >
            <Camera className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onOpenNewChat}
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer bg-[#3390ec] hover:bg-[#2481cc] text-white shadow-[#3390ec]/30"
            title="رسالة جديدة"
            aria-label="رسالة جديدة"
          >
            <Pen className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Full-Height Telegram Archived Chats Screen */}
      {isArchivedOpen && (
        <div
          className={`absolute inset-0 z-30 flex flex-col select-none tg-slide-in ${
            theme === 'light' ? 'bg-white text-slate-900' : 'bg-[#17212b] text-white'
          }`}
        >
          <header
            className={`h-14 px-2 flex items-center gap-2 border-b shrink-0 ${
              theme === 'light' ? 'bg-white border-slate-200/80' : 'bg-[#17212b] border-white/[0.06]'
            }`}
          >
            <button
              type="button"
              onClick={() => setIsArchivedOpen(false)}
              aria-label="العودة للمحادثات"
              className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'text-slate-600 hover:bg-slate-100'
                  : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold truncate">المحادثات المؤرشفة</h2>
          </header>

          <div className="flex-1 overflow-y-auto smooth-scroll-area">
            {archivedChats.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-[#3390ec]/10 flex items-center justify-center text-[#3390ec] mb-3">
                  <Archive className="w-8 h-8" />
                </div>
                <p className="text-sm font-semibold mb-1">لا توجد محادثات مؤرشفة</p>
                <p className="text-xs text-[#7f91a4]">
                  اسحب أي محادثة أو استخدم القائمة لأرشفتها هنا
                </p>
              </div>
            ) : (
              archivedChats.map((chat) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  isActive={activeChatId === chat.id}
                  onClick={() => setActiveChatId(chat.id)}
                  isArchived
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
