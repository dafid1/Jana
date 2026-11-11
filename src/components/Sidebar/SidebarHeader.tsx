import React from 'react';
import { Menu, Search, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { FolderFilter } from '../../types/telegram';

interface SidebarHeaderProps {
  onOpenDrawer: () => void;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({ onOpenDrawer }) => {
  const { theme } = useAuth();
  const { chats, filter, setFilter, searchQuery, setSearchQuery } = useChat();

  const tabs: { id: FolderFilter; label: string }[] = [
    { id: 'all', label: 'الكل' },
    { id: 'direct', label: 'محادثات' },
    { id: 'group', label: 'مجموعات' },
    { id: 'channel', label: 'قنوات' },
    { id: 'saved', label: 'المحفوظة' },
  ];

  const getCount = (tabId: FolderFilter) => {
    if (tabId === 'all') return chats.length;
    return chats.filter((c) => c.type === tabId).length;
  };

  return (
    <div
      className={`border-b shrink-0 ${
        theme === 'light' ? 'bg-white border-gray-200' : 'bg-[#17212b] border-[#232e3c]'
      }`}
    >
      {/* Search and Menu Bar */}
      <div className="flex items-center gap-3 p-3">
        {/* Hamburger Menu Button */}
        <button
          onClick={onOpenDrawer}
          className={`p-2 rounded-full transition-colors cursor-pointer ${
            theme === 'light'
              ? 'text-gray-600 hover:bg-gray-100'
              : 'text-[#7f91a4] hover:text-white hover:bg-[#232e3c]'
          }`}
          title="القائمة الرئيسية"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Telegram Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-[#7f91a4]" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث..."
            className={`w-full pr-9 pl-8 py-2 text-sm rounded-full outline-hidden transition-all duration-200 ${
              theme === 'light'
                ? 'bg-[#f1f1f1] text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-1 focus:ring-[#2481cc]'
                : 'bg-[#242f3d] text-white placeholder-[#7f91a4] focus:bg-[#2c3848] focus:ring-1 focus:ring-[#2481cc]'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 left-2.5 flex items-center text-[#7f91a4] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Telegram Folder Tabs */}
      <div className="flex items-center gap-1 px-3 overflow-x-auto no-scrollbar scroll-smooth">
        {tabs.map((tab) => {
          const isActive = filter === tab.id;
          const count = getCount(tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`relative px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'text-[#2481cc]'
                  : theme === 'light'
                  ? 'text-gray-500 hover:text-gray-800'
                  : 'text-[#7f91a4] hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive
                      ? 'bg-[#2481cc] text-white'
                      : theme === 'light'
                      ? 'bg-gray-200 text-gray-600'
                      : 'bg-[#232e3c] text-[#7f91a4]'
                  }`}
                >
                  {count}
                </span>
              )}
              {/* Active Tab Underline Indicator */}
              {isActive && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#2481cc] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
