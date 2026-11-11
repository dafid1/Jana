import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { SidebarHeader } from './components/Sidebar/SidebarHeader';
import { ChatList } from './components/Sidebar/ChatList';
import { LeftDrawer } from './components/Sidebar/LeftDrawer';
import { ChatHeader } from './components/Chat/ChatHeader';
import { MessageList } from './components/Chat/MessageList';
import { ChatInput } from './components/Chat/ChatInput';
import { CallModal } from './components/Chat/CallModal';
import { ProfileDrawer } from './components/Modals/ProfileDrawer';
import { LoginModal } from './components/Modals/LoginModal';
import { NewChatModal } from './components/Modals/NewChatModal';
import { NewGroupModal } from './components/Modals/NewGroupModal';
import { NewChannelModal } from './components/Modals/NewChannelModal';
import { PollModal } from './components/Modals/PollModal';
import { SettingsModal } from './components/Modals/SettingsModal';
import { StoryViewerModal } from './components/Modals/StoryViewerModal';
import { NewStoryModal } from './components/Modals/NewStoryModal';
import { MediaViewerModal } from './components/Modals/MediaViewerModal';

const TelegramApp: React.FC = () => {
  const { currentUser, loading, theme } = useAuth();
  const { activeChat, setActiveChatId } = useChat();

  // Modals state
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [isNewChannelOpen, setIsNewChannelOpen] = useState(false);
  const [isPollOpen, setIsPollOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewStoryOpen, setIsNewStoryOpen] = useState(false);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0e1621] text-white select-none">
        <div className="w-16 h-16 rounded-full bg-[#2481cc] flex items-center justify-center mb-4 shadow-xl animate-pulse">
          <svg className="w-8 h-8 text-white -ml-0.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
          </svg>
        </div>
        <div className="w-6 h-6 border-2 border-[#2481cc] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex flex-col font-sans ${
        theme === 'light' ? 'theme-light text-gray-900' : 'theme-dark text-white'
      }`}
    >
      {/* If not logged in, show login modal */}
      {!currentUser && <LoginModal />}

      {/* Main Telegram Layout Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Chats List, Stories & Folders) */}
        <aside
          className={`w-full md:w-85 lg:w-96 flex flex-col shrink-0 border-l border-white/5 transition-all ${
            activeChat ? 'hidden md:flex' : 'flex'
          } ${theme === 'light' ? 'bg-white' : 'bg-[#17212b]'}`}
        >
          <SidebarHeader onOpenDrawer={() => setIsLeftDrawerOpen(true)} />
          <ChatList
            onOpenNewChat={() => setIsNewChatOpen(true)}
            onOpenNewGroup={() => setIsNewGroupOpen(true)}
            onOpenNewChannel={() => setIsNewChannelOpen(true)}
            onOpenNewStory={() => setIsNewStoryOpen(true)}
          />
        </aside>

        {/* Center / Main Chat Area */}
        <main
          className={`flex-1 flex flex-col min-w-0 transition-all ${
            !activeChat ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activeChat ? (
            <div className="flex-1 flex flex-col h-full min-w-0">
              <ChatHeader onBack={() => setActiveChatId(null)} />
              <MessageList />
              <ChatInput onOpenPollModal={() => setIsPollOpen(true)} />
            </div>
          ) : (
            <div
              className={`h-full flex flex-col items-center justify-center p-6 text-center select-none ${
                theme === 'light' ? 'telegram-doodle-light' : 'telegram-doodle-dark'
              }`}
            >
              <div className="px-5 py-2.5 rounded-full bg-black/30 backdrop-blur-md text-white/90 text-xs font-semibold shadow-md">
                اختر محادثة من القائمة لبدء المراسلة الفورية
              </div>
            </div>
          )}
        </main>

        {/* Right Slide-over: Chat Info Panel */}
        <ProfileDrawer />
      </div>

      {/* Slide Navigation Menu (Drawer) */}
      <LeftDrawer
        isOpen={isLeftDrawerOpen}
        onClose={() => setIsLeftDrawerOpen(false)}
        onOpenNewChat={() => setIsNewChatOpen(true)}
        onOpenNewGroup={() => setIsNewGroupOpen(true)}
        onOpenNewChannel={() => setIsNewChannelOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Fullscreen Video / Voice Encrypted Call Screen */}
      <CallModal />

      {/* Fullscreen Story Viewer */}
      <StoryViewerModal />

      {/* Fullscreen Image Lightbox */}
      <MediaViewerModal />

      {/* Modals */}
      <NewChatModal isOpen={isNewChatOpen} onClose={() => setIsNewChatOpen(false)} />
      <NewGroupModal isOpen={isNewGroupOpen} onClose={() => setIsNewGroupOpen(false)} />
      <NewChannelModal isOpen={isNewChannelOpen} onClose={() => setIsNewChannelOpen(false)} />
      <NewStoryModal isOpen={isNewStoryOpen} onClose={() => setIsNewStoryOpen(false)} />
      <PollModal isOpen={isPollOpen} onClose={() => setIsPollOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <TelegramApp />
      </ChatProvider>
    </AuthProvider>
  );
}
