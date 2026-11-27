import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Menu, Search, X, Calculator, Shield, Camera, ArrowRight, Bookmark } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { FolderFilter } from '../../types/telegram';
import { getAvatarGradient, getInitials } from '../../utils/telegramHelpers';
import { groupStoriesByAuthor } from '../../utils/storiesHelper';

export type SearchResultTab = 'chats' | 'media' | 'links' | 'files' | 'voice';

interface SidebarHeaderProps {
  onOpenDrawer: () => void;
  onLockToCalculator?: () => void;
  onOpenRegisteredAccounts?: () => void;
  showCollapsedStories?: boolean;
  onExpandStories?: () => void;
  onOpenNewStory?: () => void;
  searchTab?: SearchResultTab;
  onSearchTabChange?: (tab: SearchResultTab) => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = React.memo(
  ({
    onOpenDrawer,
    onLockToCalculator,
    onOpenRegisteredAccounts,
    showCollapsedStories = false,
    onExpandStories,
    onOpenNewStory,
    searchTab = 'chats',
    onSearchTabChange,
  }) => {
    const { theme, isAdmin, currentUser, usersMap } = useAuth();
    const {
      chats,
      stories,
      filter,
      setFilter,
      searchQuery,
      setSearchQuery,
      setActiveChatId,
      getChatDisplayInfo,
    } = useChat();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (isSearchOpen) {
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    }, [isSearchOpen]);

    useEffect(() => {
      if (searchQuery.trim().length > 0) {
        setIsSearchOpen(true);
      }
    }, [searchQuery]);

    const { allGroups } = useMemo(
      () => groupStoriesByAuthor(stories, currentUser?.uid, usersMap),
      [stories, currentUser?.uid, usersMap]
    );

    const previewGroups = allGroups.slice(0, 3);
    const hasUnviewedStories = allGroups.some(
      (g) => g.userId !== currentUser?.uid && !g.allViewed
    );

    const frequentChats = useMemo(() => {
      return chats.slice(0, 10);
    }, [chats]);

    const tabs: { id: FolderFilter; label: string }[] = [
      { id: 'all', label: 'الكل' },
      { id: 'direct', label: 'محادثات' },
      { id: 'group', label: 'مجموعات' },
      { id: 'channel', label: 'قنوات' },
      { id: 'saved', label: 'المحفوظة' },
    ];

    const searchTabs: { id: SearchResultTab; label: string }[] = [
      { id: 'chats', label: 'المحادثات' },
      { id: 'media', label: 'الوسائط' },
      { id: 'links', label: 'الروابط' },
      { id: 'files', label: 'الملفات' },
      { id: 'voice', label: 'الصوتيات' },
    ];

    const getCount = (tabId: FolderFilter) => {
      if (tabId === 'all') return chats.length;
      return chats.filter((c) => c.type === tabId).length;
    };

    const closeSearch = () => {
      setSearchQuery('');
      onSearchTabChange?.('chats');
      setIsSearchOpen(false);
    };

    return (
      <div
        className={`border-b shrink-0 transition-colors ${
          theme === 'light'
            ? 'bg-white border-slate-200/80'
            : 'bg-[#17212b] border-white/[0.06]'
        }`}
      >
        {/* Top Bar (Telegram Style: Menu + Title / Collapsing Story Rings + Actions) */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 min-h-[54px]">
          {isSearchOpen ? (
            <div className="flex items-center gap-2 flex-1 animate-in fade-in duration-150">
              <button
                type="button"
                onClick={closeSearch}
                className={`min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                  theme === 'light'
                    ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    : 'text-[#8496ab] hover:text-white hover:bg-white/[0.06]'
                }`}
                title="إغلاق البحث"
                aria-label="إغلاق البحث"
              >
                <ArrowRight className="w-5 h-5" />
              </button>

              <div className="relative flex-1">
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      closeSearch();
                    }
                  }}
                  aria-label="ابحث في المحادثات أو الرسائل"
                  placeholder="بحث"
                  className={`w-full py-1.5 px-2 text-sm bg-transparent outline-hidden ${
                    theme === 'light'
                      ? 'text-slate-900 placeholder-slate-400'
                      : 'text-white placeholder-[#7f91a4]'
                  }`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="مسح البحث"
                    title="مسح البحث"
                    className={`absolute inset-y-0 left-1 flex items-center cursor-pointer p-1 ${
                      theme === 'light'
                        ? 'text-slate-400 hover:text-slate-700'
                        : 'text-[#8496ab] hover:text-white'
                    }`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Start Zone: Menu + Brand + Telegram Collapsed Overlapping Story Avatars */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={onOpenDrawer}
                  className={`min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                    theme === 'light'
                      ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      : 'text-[#8496ab] hover:text-white hover:bg-white/[0.06]'
                  }`}
                  title="القائمة الرئيسية"
                  aria-label="القائمة الرئيسية"
                >
                  <Menu className="w-5 h-5" />
                </button>

                <span className="text-[17px] font-bold tracking-tight whitespace-nowrap shrink-0">
                  JanaX
                </span>

                {/* Collapsed Overlapping Mini-Story Cluster (Telegram Header Morph) */}
                {showCollapsedStories && previewGroups.length > 0 && onExpandStories && (
                  <button
                    type="button"
                    onClick={onExpandStories}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-all cursor-pointer shrink-0 animate-in fade-in zoom-in-95 duration-200 ${
                      theme === 'light'
                        ? 'bg-slate-100/90 hover:bg-slate-200/70'
                        : 'bg-[#202b36] hover:bg-[#273543]'
                    }`}
                    title="عرض القصص"
                    aria-label="عرض القصص"
                  >
                    <div className="flex items-center -space-x-2 space-x-reverse">
                      {previewGroups.map((g) => (
                        <div
                          key={g.userId}
                          className={`w-6 h-6 rounded-full p-[1.5px] shrink-0 ${
                            g.allViewed && g.userId !== currentUser?.uid
                              ? 'bg-slate-500/45'
                              : 'bg-gradient-to-tr from-[#3390ec] via-[#38bdf8] to-[#34d399]'
                          }`}
                        >
                          <div
                            className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center text-[9px] font-bold text-white border ${
                              theme === 'light' ? 'border-white' : 'border-[#17212b]'
                            } bg-gradient-to-tr ${getAvatarGradient(g.userId)}`}
                          >
                            {g.userAvatar ? (
                              <img
                                src={g.userAvatar}
                                alt={g.userName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>{getInitials(g.userName)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <span
                      className={`text-[11px] font-bold whitespace-nowrap ${
                        hasUnviewedStories ? 'text-[#3390ec]' : 'opacity-80'
                      }`}
                    >
                      القصص
                    </span>
                  </button>
                )}
              </div>

              {/* End Zone: Add Story + Search + Admin + Calculator Lock */}
              <div className="flex items-center gap-0.5 shrink-0">
                {onOpenNewStory && (
                  <button
                    type="button"
                    onClick={onOpenNewStory}
                    aria-label="إضافة قصة"
                    title="إضافة قصة"
                    className={`min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                      theme === 'light'
                        ? 'text-slate-600 hover:bg-slate-100 hover:text-[#3390ec]'
                        : 'text-[#8496ab] hover:text-[#3390ec] hover:bg-white/[0.06]'
                    }`}
                  >
                    <Camera className="w-4.5 h-4.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  aria-label="بحث"
                  title="بحث"
                  className={`min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                    theme === 'light'
                      ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      : 'text-[#8496ab] hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <Search className="w-4.5 h-4.5" />
                </button>

                {isAdmin && onOpenRegisteredAccounts && (
                  <button
                    type="button"
                    onClick={onOpenRegisteredAccounts}
                    aria-label="شاشة الحسابات المسجلة"
                    title="شاشة الحسابات المسجلة"
                    className={`min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                      theme === 'light'
                        ? 'text-[#3390ec] hover:bg-blue-50'
                        : 'text-[#5288c1] hover:bg-[#3390ec]/15'
                    }`}
                  >
                    <Shield className="w-4.5 h-4.5" />
                  </button>
                )}

                {onLockToCalculator && (
                  <button
                    type="button"
                    onClick={onLockToCalculator}
                    aria-label="إخفاء والعودة للآلة الحاسبة"
                    title="إخفاء والعودة للآلة الحاسبة"
                    className={`min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                      theme === 'light'
                        ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        : 'text-[#8496ab] hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    <Calculator className="w-4.5 h-4.5" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Telegram Global Search: Horizontal Top Contacts Strip + Result Tabs */}
        {isSearchOpen ? (
          <div className="animate-in fade-in duration-150">
            {!searchQuery.trim() && frequentChats.length > 0 && (
              <div className="px-3 pt-1 pb-2.5 flex items-center gap-3 overflow-x-auto no-scrollbar">
                {frequentChats.map((c) => {
                  const info = getChatDisplayInfo(c);
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => {
                        setActiveChatId(c.id);
                        closeSearch();
                      }}
                      className="flex flex-col items-center gap-1 w-14 shrink-0 cursor-pointer group"
                    >
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs text-white overflow-hidden shadow-xs transition-transform group-hover:scale-105 bg-gradient-to-tr ${getAvatarGradient(
                          info.otherUser?.uid || c.id
                        )}`}
                      >
                        {c.type === 'saved' ? (
                          <Bookmark className="w-5 h-5 text-white" />
                        ) : info.photoURL ? (
                          <img
                            src={info.photoURL}
                            alt={info.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{getInitials(info.title)}</span>
                        )}
                      </div>
                      <span className="text-[11px] font-medium truncate w-full text-center opacity-85">
                        {info.title.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-1 px-3 overflow-x-auto no-scrollbar scroll-smooth">
              {searchTabs.map((t) => {
                const isActive = searchTab === t.id;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => onSearchTabChange?.(t.id)}
                    className={`relative px-3 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      isActive
                        ? 'text-[#3390ec]'
                        : theme === 'light'
                        ? 'text-slate-500 hover:text-slate-900'
                        : 'text-[#8496ab] hover:text-white'
                    }`}
                  >
                    <span>{t.label}</span>
                    {isActive && (
                      <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#3390ec] rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Telegram Folder Tabs */
          <div className="flex items-center gap-1 px-3 overflow-x-auto no-scrollbar scroll-smooth">
            {tabs.map((tab) => {
              const isActive = filter === tab.id;
              const count = getCount(tab.id);
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`relative px-3 py-2.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'text-[#3390ec]'
                      : theme === 'light'
                      ? 'text-slate-500 hover:text-slate-900'
                      : 'text-[#8496ab] hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-full leading-none ${
                        isActive
                          ? 'bg-[#3390ec] text-white'
                          : theme === 'light'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-white/[0.08] text-[#8496ab]'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                  {isActive && (
                    <div className="absolute bottom-0 left-2 right-2 h-[2.5px] bg-[#3390ec] rounded-t-full" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);
