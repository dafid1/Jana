import React, { useState, useEffect, useRef, useCallback, lazy, Suspense, ComponentType } from 'react';
import { X, CheckCircle2, AlertCircle, Forward } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { CalculatorVault } from './components/Calculator/CalculatorVault';
import { SidebarHeader, SearchResultTab } from './components/Sidebar/SidebarHeader';
import { ChatList } from './components/Sidebar/ChatList';
import { ChatHeader } from './components/Chat/ChatHeader';
import { MessageList } from './components/Chat/MessageList';
import { ChatInput } from './components/Chat/ChatInput';
import { LeftDrawer } from './components/Sidebar/LeftDrawer';
import { LoginModal } from './components/Modals/LoginModal';
import { AdminUsersModal } from './components/Modals/AdminUsersModal';
import { AdminAccountsScreen } from './components/Admin/AdminAccountsScreen';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { PendingSharePayload } from './types/telegram';
import {
  useAndroidBackNavigationRoot,
  useBackHandler,
  syncNativeBackInterception,
} from './utils/androidBackNavigation';
import {
  setNativeScreenSecurity,
  fetchNativePendingShare,
  clearNativePendingShare,
} from './utils/vaultBridge';

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
const IncomingCallOverlay = lazyWithRetry(() =>
  import('./components/Chat/IncomingCallOverlay').then((m) => ({ default: m.IncomingCallOverlay }))
);
const DecoyVaultView = lazyWithRetry(() =>
  import('./components/Vault/DecoyVaultView').then((m) => ({ default: m.DecoyVaultView }))
);
const ShareTargetModal = lazyWithRetry(() =>
  import('./components/Modals/ShareTargetModal').then((m) => ({ default: m.ShareTargetModal }))
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
const ForwardModal = lazyWithRetry(() =>
  import('./components/Modals/ForwardModal').then((m) => ({ default: m.ForwardModal }))
);

const JanaXApp: React.FC = () => {
  const {
    currentUser,
    userProfile,
    loading,
    isAutoLoggingIn,
    lockCounter,
    theme,
    unlockWithCalculatorCode,
  } = useAuth();
  const {
    activeChat,
    activeChatId,
    setActiveChatId,
    showInfoDrawer,
    setShowInfoDrawer,
    callState,
    incomingCall,
    endCall,
    activeStoryIndex,
    setActiveStoryIndex,
    activeMediaUrl,
    setActiveMediaUrl,
    pendingInviteStatus,
    clearPendingInviteStatus,
    isSelectionMode,
    clearSelection,
    replyingTo,
    setReplyingTo,
    editingMessage,
    setEditingMessage,
    forwardingMessages,
    closeForwardModal,
    forwardToast,
    clearForwardToast,
  } = useChat();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockMode, setUnlockMode] = useState<'real' | 'decoy'>('real');
  const [pendingShare, setPendingShare] = useState<PendingSharePayload | null>(null);
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
  const [isStoriesManuallyCollapsed, setIsStoriesManuallyCollapsed] = useState(false);
  const [isScrolledPastStories, setIsScrolledPastStories] = useState(false);
  const [expandStoriesSignal, setExpandStoriesSignal] = useState(0);
  const [searchTab, setSearchTab] = useState<SearchResultTab>('chats');

  const lockToCalculator = useCallback(() => {
    setIsLeftDrawerOpen(false);
    setIsNewChatOpen(false);
    setGroupModalMode(null);
    setIsNewChannelOpen(false);
    setIsPollOpen(false);
    setIsSettingsOpen(false);
    setIsNewStoryOpen(false);
    setIsAdminUsersOpen(false);
    setIsAdminAccountsOpen(false);
    setShowInfoDrawer(false);
    setPendingShare(null);
    clearSelection();
    setReplyingTo(null);
    setEditingMessage(null);
    closeForwardModal();
    setActiveMediaUrl(null);
    setActiveStoryIndex(null);
    setActiveChatId(null);
    setIsStoriesManuallyCollapsed(false);
    setIsScrolledPastStories(false);
    setUnlockMode('real');
    setIsUnlocked(false);
    syncNativeBackInterception(false);
  }, [
    clearSelection,
    closeForwardModal,
    setActiveChatId,
    setActiveMediaUrl,
    setActiveStoryIndex,
    setEditingMessage,
    setReplyingTo,
    setShowInfoDrawer,
  ]);

  // Root Android / mobile browser Back navigation integration
  useAndroidBackNavigationRoot(isUnlocked);

  // Decoy workspace back returns to Calculator
  useBackHandler(isUnlocked && unlockMode === 'decoy', lockToCalculator, 98);

  // Share target modal back
  useBackHandler(
    isUnlocked && unlockMode === 'real' && pendingShare !== null,
    () => {
      setPendingShare(null);
      clearNativePendingShare();
    },
    96
  );

  // Priority-ordered back layers (higher priority closes first)
  useBackHandler(isUnlocked && activeMediaUrl !== null, () => setActiveMediaUrl(null), 100);
  useBackHandler(isUnlocked && activeStoryIndex !== null, () => setActiveStoryIndex(null), 95);
  useBackHandler(isUnlocked && callState.isActive, () => endCall(), 90);
  useBackHandler(
    isUnlocked && Boolean(forwardingMessages && forwardingMessages.length > 0),
    () => closeForwardModal(),
    85
  );

  useBackHandler(isUnlocked && isPollOpen, () => setIsPollOpen(false), 70);
  useBackHandler(isUnlocked && isNewStoryOpen, () => setIsNewStoryOpen(false), 70);
  useBackHandler(isUnlocked && isNewChannelOpen, () => setIsNewChannelOpen(false), 70);
  useBackHandler(isUnlocked && groupModalMode !== null, () => setGroupModalMode(null), 70);
  useBackHandler(isUnlocked && isNewChatOpen, () => setIsNewChatOpen(false), 70);
  useBackHandler(isUnlocked && isAdminAccountsOpen, () => setIsAdminAccountsOpen(false), 70);
  useBackHandler(isUnlocked && isAdminUsersOpen, () => setIsAdminUsersOpen(false), 70);
  useBackHandler(isUnlocked && isSettingsOpen, () => setIsSettingsOpen(false), 70);

  useBackHandler(isUnlocked && isLeftDrawerOpen, () => setIsLeftDrawerOpen(false), 60);

  // Back from LoginModal or auto-login screen returns cleanly to Calculator Vault
  useBackHandler(isUnlocked && (loading || isAutoLoggingIn || !currentUser), lockToCalculator, 55);

  // Inside an active chat: close info drawer -> selection mode -> reply/edit -> exit chat back to Chats List
  useBackHandler(
    isUnlocked && Boolean(activeChat) && showInfoDrawer,
    () => setShowInfoDrawer(false),
    35
  );
  useBackHandler(
    isUnlocked && Boolean(activeChat) && isSelectionMode,
    () => clearSelection(),
    30
  );
  useBackHandler(
    isUnlocked && Boolean(activeChat) && Boolean(replyingTo || editingMessage),
    () => {
      setReplyingTo(null);
      setEditingMessage(null);
    },
    25
  );
  useBackHandler(
    isUnlocked && activeChatId !== null,
    () => {
      setShowInfoDrawer(false);
      clearSelection();
      setReplyingTo(null);
      setEditingMessage(null);
      setActiveChatId(null);
    },
    20
  );

  // On Chats List root screen: pressing Back returns to Calculator Vault
  useBackHandler(isUnlocked, lockToCalculator, 10);

  // Re-hide behind Calculator automatically on inactivity/background timeout logout or leaving app
  useEffect(() => {
    if (lockCounter !== prevLockCounterRef.current) {
      prevLockCounterRef.current = lockCounter;
      lockToCalculator();
    }
  }, [lockCounter, lockToCalculator]);

  // Sync browser tab title & icon so the app looks like a genuine Calculator when locked or in decoy mode
  useEffect(() => {
    const showRealIdentity = isUnlocked && unlockMode === 'real';
    document.title = showRealIdentity ? 'JanaX' : 'الآلة الحاسبة';
    const iconLink = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (iconLink) {
      iconLink.href = showRealIdentity ? JANAX_FAVICON : CALC_FAVICON;
    }
  }, [isUnlocked, unlockMode]);

  // Sync Android FLAG_SECURE screen protection when in real unlocked vault
  useEffect(() => {
    const enableSecure =
      isUnlocked && unlockMode === 'real' && userProfile?.screenSecurityEnabled !== false;
    setNativeScreenSecurity(enableSecure);
  }, [isUnlocked, unlockMode, userProfile?.screenSecurityEnabled]);

  // Listen for Android ACTION_SEND incoming share payloads once unlocked in real mode
  useEffect(() => {
    if (!isUnlocked || unlockMode !== 'real' || !currentUser) return;

    let cancelled = false;
    const checkShare = async () => {
      const payload = await fetchNativePendingShare();
      if (!cancelled && payload) {
        setPendingShare(payload);
      }
    };

    checkShare();
    window.__janaxOnNativeShare = () => {
      checkShare();
    };

    return () => {
      cancelled = true;
      delete window.__janaxOnNativeShare;
    };
  }, [isUnlocked, unlockMode, currentUser]);

  const handleCalculatorUnlock = async (enteredCode: string) => {
    setActiveChatId(null);
    const mode = await unlockWithCalculatorCode(enteredCode);
    if (!mode) {
      setIsUnlocked(false);
      setUnlockMode('real');
      return;
    }
    setUnlockMode(mode);
    setIsUnlocked(true);
  };

  if (!isUnlocked) {
    return <CalculatorVault onUnlock={handleCalculatorUnlock} />;
  }

  if (unlockMode === 'decoy') {
    return (
      <Suspense fallback={null}>
        <DecoyVaultView onLockToCalculator={lockToCalculator} />
      </Suspense>
    );
  }

  if (loading || isAutoLoggingIn) {
    return (
      <div className="h-dvh w-screen flex flex-col items-center justify-center bg-[#0b1118] text-white select-none">
        <div className="w-16 h-16 rounded-2xl bg-[#2481cc] flex items-center justify-center mb-4 shadow-xl shadow-[#2481cc]/25 ring-1 ring-white/15 font-extrabold text-2xl tracking-tight">
          JX
        </div>
        <div className="text-sm font-semibold mb-3 tracking-wide text-slate-200">
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

      {/* Forward Toast Notification */}
      {forwardToast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold animate-in fade-in slide-in-from-top-3 duration-200 ${
            theme === 'light'
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#17212b] border-[#2b3a4a] text-white'
          }`}
        >
          <Forward className="w-4 h-4 text-[#2481cc] shrink-0" />
          <span>{forwardToast.message}</span>
          {forwardToast.targetChatId && (
            <button
              type="button"
              onClick={() => {
                if (forwardToast.targetChatId) {
                  setActiveChatId(forwardToast.targetChatId);
                }
                clearForwardToast();
              }}
              className="px-2.5 py-1 rounded-lg bg-[#2481cc]/15 text-[#2481cc] hover:bg-[#2481cc] hover:text-white transition-colors cursor-pointer"
            >
              فتح المحادثة
            </button>
          )}
          <button
            type="button"
            onClick={clearForwardToast}
            className="p-1 rounded-full hover:bg-white/10 text-[#7f91a4] hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main JanaX Layout Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar (Chats List, Stories, Folders & Full-Screen Telegram Compose Flows) */}
        <aside
          className={`relative w-full md:w-85 lg:w-96 flex flex-col shrink-0 border-l transition-colors overflow-hidden ${
            activeChat && !(isNewChatOpen || groupModalMode !== null || isNewChannelOpen)
              ? 'hidden md:flex'
              : 'flex'
          } ${
            theme === 'light'
              ? 'bg-white border-slate-200/90'
              : 'bg-[#17212b] border-[#0e1621]'
          }`}
        >
          <SidebarHeader
            onOpenDrawer={() => setIsLeftDrawerOpen(true)}
            onOpenRegisteredAccounts={() => setIsAdminAccountsOpen(true)}
            onLockToCalculator={lockToCalculator}
            showCollapsedStories={isStoriesManuallyCollapsed || isScrolledPastStories}
            onExpandStories={() => {
              setIsStoriesManuallyCollapsed(false);
              setExpandStoriesSignal((n) => n + 1);
            }}
            onOpenNewStory={() => setIsNewStoryOpen(true)}
            searchTab={searchTab}
            onSearchTabChange={setSearchTab}
          />
          <ChatList
            onOpenNewChat={() => setIsNewChatOpen(true)}
            onOpenNewStory={() => setIsNewStoryOpen(true)}
            isStoriesManuallyCollapsed={isStoriesManuallyCollapsed}
            onCollapseStories={() => setIsStoriesManuallyCollapsed(true)}
            onScrolledPastStoriesChange={setIsScrolledPastStories}
            expandStoriesSignal={expandStoriesSignal}
            searchTab={searchTab}
          />

          <Suspense fallback={null}>
            {isNewChatOpen && (
              <NewChatModal
                isOpen={isNewChatOpen}
                onClose={() => setIsNewChatOpen(false)}
                onOpenAdminUsers={() => setIsAdminUsersOpen(true)}
                onOpenNewGroup={() => setGroupModalMode('create')}
                onOpenNewChannel={() => setIsNewChannelOpen(true)}
                onOpenJoinGroup={() => setGroupModalMode('join')}
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
              <NewChannelModal
                isOpen={isNewChannelOpen}
                onClose={() => setIsNewChannelOpen(false)}
              />
            )}
          </Suspense>
        </aside>

        {/* Center / Main Chat Area */}
        <main
          className={`flex-1 flex flex-col min-w-0 transition-all ${
            !activeChat || isNewChatOpen || groupModalMode !== null || isNewChannelOpen
              ? 'hidden md:flex'
              : 'flex'
          }`}
        >
          {activeChat ? (
            showInfoDrawer ? (
              <Suspense fallback={null}>
                <ProfileDrawer />
              </Suspense>
            ) : (
              <div className="flex-1 flex flex-col h-full min-w-0">
                <ChatHeader />
                <MessageList />
                <ChatInput onOpenPollModal={() => setIsPollOpen(true)} />
              </div>
            )
          ) : (
            <div
              className={`h-full flex flex-col items-center justify-center p-8 text-center select-none ${
                theme === 'light' ? 'telegram-doodle-light' : 'telegram-doodle-dark'
              }`}
            >
              <div
                className={`max-w-sm px-7 py-6 rounded-3xl border backdrop-blur-md shadow-xl flex flex-col items-center gap-3 ${
                  theme === 'light'
                    ? 'bg-white/90 border-slate-200/80 text-slate-900'
                    : 'bg-[#17212b]/90 border-white/[0.08] text-white'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-[#3390ec]/15 text-[#3390ec] flex items-center justify-center">
                  <svg className="w-7 h-7 -ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight mb-1">مرحباً بك في JanaX</h2>
                  <p
                    className={`text-xs leading-relaxed ${
                      theme === 'light' ? 'text-slate-500' : 'text-[#8496ab]'
                    }`}
                  >
                    اختر محادثة من القائمة الجانبية أو ابدأ تواصلاً جديداً عبر زر الإنشاء
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
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
            onLockToCalculator={lockToCalculator}
          />
        )}

        {incomingCall && !callState.isActive && <IncomingCallOverlay />}
        {callState.isActive && <CallModal />}
        {activeStoryIndex !== null && <StoryViewerModal />}
        {activeMediaUrl && <MediaViewerModal />}
        {forwardingMessages && forwardingMessages.length > 0 && <ForwardModal />}

        {pendingShare && (
          <ShareTargetModal
            payload={pendingShare}
            onClose={() => {
              setPendingShare(null);
              clearNativePendingShare();
            }}
          />
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
