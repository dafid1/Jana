import React, { useState, useEffect, useRef, lazy, Suspense, ComponentType } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { CalculatorVault } from './components/Calculator/CalculatorVault';
import { SidebarHeader } from './components/Sidebar/SidebarHeader';
import { ChatList } from './components/Sidebar/ChatList';
import { ChatHeader } from './components/Chat/ChatHeader';
import { MessageList } from './components/Chat/MessageList';
import { ChatInput } from './components/Chat/ChatInput';
import { LeftDrawer } from './components/Sidebar/LeftDrawer';
import { LoginModal } from './components/Modals/LoginModal';
import { AdminUsersModal } from './components/Modals/AdminUsersModal';
import { AdminAccountsScreen } from './components/Admin/AdminAccountsScreen';
import { ErrorBoundary } from './components/Common/ErrorBoundary';

function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  retries = 2
) {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await importer();
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
        }
      }
    }
    throw lastError;
  });
}

const CALC_FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23f59e0b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='16' height='20' x='4' y='2' rx='2'/%3E%3Cline x1='8' x2='16' y1='6' y2='6'/%3E%3Cline x1='16' x2='16' y1='14' y2='18'/%3E%3Cpath d='M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01'/%3E%3C/svg%3E";
const JANAX_FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%232AABEE'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z'/%3E%3C/svg%3E";

const CallModal = lazyWithRetry(() =>
  import('./components/Chat/CallModal').then((m) => ({ default: m.CallModal }))
);
const ProfileDrawer = lazyWithRetry(() =>
  import('./components/Modals/ProfileDrawer').then((m) => ({ default: m.ProfileDrawer }))
);
const NewChatModal = lazyWithRetry(() =>
  import('./components/Modals/NewChatModal').then((m) => ({ default: m.NewChatModal }))
);
const NewGroupModal = lazyWithRetry(() =>
  import('./components/Modals/NewGroupModal').then((m) => ({ default: m.NewGroupModal }))
);
const NewChannelModal = lazyWithRetry(() =>
  import('./components/Modals/NewChannelModal').then((m) => ({ default: m.NewChannelModal }))
);
const PollModal = lazyWithRetry(() =>
  import('./components/Modals/PollModal').then((m) => ({ default: m.PollModal }))
);
const SettingsModal = lazyWithRetry(() =>
  import('./components/Modals/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const StoryViewerModal = lazyWithRetry(() =>
  import('./components/Modals/StoryViewerModal').then((m) => ({ default: m.StoryViewerModal }))
);
const NewStoryModal = lazyWithRetry(() =>
  import('./components/Modals/NewStoryModal').then((m) => ({ default: m.NewStoryModal }))
);
const MediaViewerModal = lazyWithRetry(() =>
  import('./components/Modals/MediaViewerModal').then((m) => ({ default: m.MediaViewerModal }))
);

const JanaXApp: React.FC = () => {
  const {
    currentUser,
    loading,
    isAutoLoggingIn,
    lockCounter,
    theme,
    unlockWithCalculatorCode,
  } = useAuth();
  const {
    activeChat,
    setActiveChatId,
    showInfoDrawer,
    callState,
    activeStoryIndex,
    activeMediaUrl,
    pendingInviteStatus,
    clearPendingInviteStatus,
  } = useChat();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const prevLockCounterRef = useRef(lockCounter);

  // Modals state
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [groupModalMode, setGroupModalMode] = useState<'create' | 'join' | null>(null);
  const [isNewChannelOpen, setIsNewChannelOpen] = useState(false);
  const [isPollOpen, setIsPollOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewStoryOpen, setIsNewStoryOpen] = useState(false);
  const [isAdminUsersOpen, setIsAdminUsersOpen] = useState(false);
  const [isAdminAccountsOpen, setIsAdminAccountsOpen] = useState(false);

  // Re-hide behind Calculator automatically on inactivity/background timeout logout or leaving app
  useEffect(() => {
    if (lockCounter !== prevLockCounterRef.current) {
      prevLockCounterRef.current = lockCounter;
      setIsLeftDrawerOpen(false);
      setIsAdminUsersOpen(false);
      setIsAdminAccountsOpen(false);
      setActiveChatId(null);
      setIsUnlocked(false);
    }
  }, [lockCounter, setActiveChatId]);

  // Sync browser tab title & icon so the app looks like a genuine Calculator when locked
  useEffect(() => {
    document.title = isUnlocked ? 'JanaX' : 'الآلة الحاسبة';
    const iconLink = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (iconLink) {
      iconLink.href = isUnlocked ? JANAX_FAVICON : CALC_FAVICON;
    }
  }, [isUnlocked]);

  const handleCalculatorUnlock = async (enteredCode: string) => {
    setActiveChatId(null);
    setIsUnlocked(true);
    const ok = await unlockWithCalculatorCode(enteredCode);
    if (!ok) {
      setIsUnlocked(false);
    }
  };

  if (!isUnlocked) {
    return <CalculatorVault onUnlock={handleCalculatorUnlock} />;
  }

  if (loading || isAutoLoggingIn) {
    return (
      <div className="h-dvh w-screen flex flex-col items-center justify-center bg-[#0e1621] text-white select-none">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#2481cc] to-[#38bdf8] flex items-center justify-center mb-4 shadow-xl animate-pulse font-black text-2xl tracking-tight">
          JX
        </div>
        <div className="text-sm font-bold mb-3 tracking-wide text-sky-200">
          {isAutoLoggingIn ? 'جاري تسجيل الدخول...' : 'JanaX'}
        </div>
        <div className="w-6 h-6 border-2 border-[#2481cc] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className={`h-dvh w-screen overflow-hidden flex flex-col font-sans ${
        theme === 'light' ? 'theme-light text-gray-900' : 'theme-dark text-white'
      }`}
    >
      {/* Invite Link Join Toast Notification */}
      {pendingInviteStatus && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border bg-[#17212b] border-[#2b3a4a] text-white text-xs font-bold animate-in fade-in slide-in-from-top-3 duration-200">
          {pendingInviteStatus.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{pendingInviteStatus.message}</span>
          <button
            onClick={clearPendingInviteStatus}
            className="p-1 rounded-full hover:bg-white/10 text-[#7f91a4] hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main JanaX Layout Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar (Chats List, Stories & Folders) */}
        <aside
          className={`w-full md:w-85 lg:w-96 flex flex-col shrink-0 border-l border-white/5 transition-all ${
            activeChat ? 'hidden md:flex' : 'flex'
          } ${theme === 'light' ? 'bg-white' : 'bg-[#17212b]'}`}
        >
          <SidebarHeader
            onOpenDrawer={() => setIsLeftDrawerOpen(true)}
            onOpenRegisteredAccounts={() => setIsAdminAccountsOpen(true)}
            onLockToCalculator={() => {
              setIsLeftDrawerOpen(false);
              setIsAdminUsersOpen(false);
              setIsAdminAccountsOpen(false);
              setActiveChatId(null);
              setIsUnlocked(false);
            }}
          />
          <ChatList
            onOpenNewChat={() => setIsNewChatOpen(true)}
            onOpenNewGroup={() => setGroupModalMode('create')}
            onOpenJoinGroup={() => setGroupModalMode('join')}
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
                اختر محادثة من القائمة لبدء المراسلة في JanaX
              </div>
            </div>
          )}
        </main>

        {/* Right Slide-over: Chat Info Panel */}
        {showInfoDrawer && activeChat && (
          <Suspense fallback={null}>
            <ProfileDrawer />
          </Suspense>
        )}
      </div>

      {/* Lazy-Loaded Modals & Overlays */}
      <Suspense fallback={null}>
        {!currentUser && <LoginModal />}

        {isLeftDrawerOpen && (
          <LeftDrawer
            isOpen={isLeftDrawerOpen}
            onClose={() => setIsLeftDrawerOpen(false)}
            onOpenNewChat={() => setIsNewChatOpen(true)}
            onOpenNewGroup={() => setGroupModalMode('create')}
            onOpenJoinGroup={() => setGroupModalMode('join')}
            onOpenNewChannel={() => setIsNewChannelOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenAdminUsers={() => setIsAdminUsersOpen(true)}
            onOpenRegisteredAccounts={() => setIsAdminAccountsOpen(true)}
            onLockToCalculator={() => {
              setIsLeftDrawerOpen(false);
              setIsAdminUsersOpen(false);
              setIsAdminAccountsOpen(false);
              setActiveChatId(null);
              setIsUnlocked(false);
            }}
          />
        )}

        {callState.isActive && <CallModal />}
        {activeStoryIndex !== null && <StoryViewerModal />}
        {activeMediaUrl && <MediaViewerModal />}

        {isNewChatOpen && (
          <NewChatModal
            isOpen={isNewChatOpen}
            onClose={() => setIsNewChatOpen(false)}
            onOpenAdminUsers={() => setIsAdminUsersOpen(true)}
          />
        )}

        {groupModalMode !== null && (
          <NewGroupModal
            isOpen={groupModalMode !== null}
            initialTab={groupModalMode || 'create'}
            onClose={() => setGroupModalMode(null)}
          />
        )}

        {isNewChannelOpen && (
          <NewChannelModal isOpen={isNewChannelOpen} onClose={() => setIsNewChannelOpen(false)} />
        )}

        {isNewStoryOpen && (
          <NewStoryModal isOpen={isNewStoryOpen} onClose={() => setIsNewStoryOpen(false)} />
        )}

        {isPollOpen && <PollModal isOpen={isPollOpen} onClose={() => setIsPollOpen(false)} />}
        {isSettingsOpen && (
          <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        )}
        {isAdminUsersOpen && (
          <AdminUsersModal
            isOpen={isAdminUsersOpen}
            onClose={() => setIsAdminUsersOpen(false)}
            onOpenRegisteredAccounts={() => setIsAdminAccountsOpen(true)}
          />
        )}

        {isAdminAccountsOpen && (
          <AdminAccountsScreen
            isOpen={isAdminAccountsOpen}
            onClose={() => setIsAdminAccountsOpen(false)}
          />
        )}
      </Suspense>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ChatProvider>
          <JanaXApp />
        </ChatProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
