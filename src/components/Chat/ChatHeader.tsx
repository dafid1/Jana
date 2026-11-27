import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  Video,
  MoreVertical,
  Volume2,
  VolumeX,
  Info,
  X,
  Forward,
  Bookmark,
  Copy,
  CheckSquare,
  Check,
  Trash2,
  Pin,
  Ban,
  LogOut,
  Mic,
} from 'lucide-react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  isChatAccessibleOnServer,
  OperationType,
} from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { TypingIndicator, UserProfile } from '../../types/telegram';
import {
  getAvatarGradient,
  getInitials,
  isUserOnlineByLastSeen,
  formatLastSeenArabic,
} from '../../utils/telegramHelpers';
import { useBackHandler } from '../../utils/androidBackNavigation';

const TYPING_STALE_MS = 7000;

export const ChatHeader: React.FC = React.memo(() => {
  const {
    theme,
    currentUser,
    usersMap,
    userProfile,
    toggleMuteChat,
    togglePinChat,
    toggleBlockUser,
  } = useAuth();
  const {
    activeChat,
    showInfoDrawer,
    setShowInfoDrawer,
    startCall,
    getChatDisplayInfo,
    messages,
    isSelectionMode,
    selectedMessageIds,
    selectedMessages,
    enterSelectionMode,
    selectAllMessages,
    clearSelection,
    openForwardModal,
    forwardMessages,
    deleteMessages,
    isActiveChatMember,
    isActiveChatModerator,
    isActiveChatBlocked,
    leaveChat,
  } = useChat();

  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedSelection, setCopiedSelection] = useState(false);
  const [savingToSaved, setSavingToSaved] = useState(false);
  const [rawTypingUsers, setRawTypingUsers] = useState<TypingIndicator[]>([]);
  const [directUserProfile, setDirectUserProfile] = useState<UserProfile | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const menuRef = useRef<HTMLDivElement>(null);

  useBackHandler(showDeleteConfirm, () => setShowDeleteConfirm(false), 50);

  useEffect(() => {
    if (!isSelectionMode) {
      setShowDeleteConfirm(false);
      return;
    }
    const handleSelectionEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) setShowDeleteConfirm(false);
        else clearSelection();
      }
    };
    window.addEventListener('keydown', handleSelectionEscape);
    return () => window.removeEventListener('keydown', handleSelectionEscape);
  }, [isSelectionMode, showDeleteConfirm, clearSelection]);

  useEffect(() => {
    if (!showMenu) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [showMenu]);

  const directOtherUid =
    activeChat?.type === 'direct' && currentUser
      ? activeChat.memberIds.find((id) => id !== currentUser.uid)
      : undefined;

  useEffect(() => {
    if (!currentUser || !directOtherUid) {
      setDirectUserProfile(null);
      return;
    }

    const userRef = doc(db, 'users', directOtherUid);
    const unsubscribe = onSnapshot(
      userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setDirectUserProfile(docSnap.data() as UserProfile);
          setNowTick(Date.now());
        } else {
          setDirectUserProfile(null);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${directOtherUid}`);
      }
    );

    return () => unsubscribe();
  }, [currentUser, directOtherUid]);

  const canListenTyping = Boolean(
    currentUser &&
      activeChat &&
      activeChat.type !== 'saved' &&
      (activeChat.type === 'channel' ||
        activeChat.createdBy === currentUser.uid ||
        (Array.isArray(activeChat.memberIds) && activeChat.memberIds.includes(currentUser.uid)))
  );

  useEffect(() => {
    if (!currentUser || !activeChat || !canListenTyping) {
      setRawTypingUsers([]);
      return;
    }

    let cancelled = false;
    const chatId = activeChat.id;
    const typingRef = collection(db, 'chats', chatId, 'typing');
    const unsubscribe = onSnapshot(
      typingRef,
      (snapshot) => {
        if (cancelled) return;
        const list: TypingIndicator[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as TypingIndicator;
          if (data.uid !== currentUser.uid && data.isTyping) {
            list.push(data);
          }
        });
        setRawTypingUsers(list);
        setNowTick(Date.now());
      },
      async (error) => {
        const fbCode = (error as { code?: string })?.code;
        if (fbCode === 'permission-denied') {
          const accessible = await isChatAccessibleOnServer(chatId, currentUser.uid);
          if (!accessible) {
            if (!cancelled) setRawTypingUsers([]);
            return;
          }
        }
        handleFirestoreError(error, OperationType.GET, `chats/${chatId}/typing`);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [currentUser, activeChat?.id, canListenTyping]);

  useEffect(() => {
    const isTypingActive = rawTypingUsers.length > 0;
    const isDirectChat = activeChat?.type === 'direct';
    if (!isTypingActive && !isDirectChat) return;

    const intervalMs = isTypingActive ? 1500 : 10000;
    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, intervalMs);
    return () => clearInterval(interval);
  }, [rawTypingUsers.length, activeChat?.type]);

  if (!activeChat) return null;

  const isMuted = Boolean(userProfile?.mutedChatIds?.includes(activeChat.id));
  const isPinned = Boolean(userProfile?.pinnedChatIds?.includes(activeChat.id));
  const displayInfo = getChatDisplayInfo(activeChat);
  const resolvedOtherUser = directUserProfile || displayInfo.otherUser;
  const hidesPresence = Boolean(resolvedOtherUser?.privacyHideLastSeen);

  const isDirectOnline =
    activeChat.type === 'direct' && !isActiveChatBlocked && !hidesPresence
      ? isUserOnlineByLastSeen(resolvedOtherUser, nowTick)
      : false;
  const directLastSeenText =
    activeChat.type === 'direct' && !isActiveChatBlocked && !hidesPresence
      ? formatLastSeenArabic(resolvedOtherUser?.lastSeen, nowTick)
      : '';

  const activeTypers = rawTypingUsers.filter((t) => {
    const updatedMs = new Date(t.updatedAt).getTime();
    return !Number.isNaN(updatedMs) && nowTick - updatedMs < TYPING_STALE_MS;
  });

  const isAnyRecording = activeTypers.some((t) => t.activity === 'recording');

  const getTypingLabel = (): string | null => {
    if (activeTypers.length === 0) return null;
    if (activeChat.type === 'direct') {
      return isAnyRecording ? 'يسجل رسالة صوتية' : 'يكتب الآن';
    }
    const names = activeTypers.map(
      (t) => usersMap[t.uid]?.displayName || t.displayName || 'مستخدم'
    );
    if (names.length === 1) {
      return isAnyRecording ? `${names[0]} يسجل رسالة صوتية` : `${names[0]} يكتب الآن`;
    }
    if (names.length === 2) {
      return isAnyRecording
        ? `${names[0]} و ${names[1]} يسجلان صوتاً`
        : `${names[0]} و ${names[1]} يكتبان الآن`;
    }
    return `${names.length} أعضاء يتفاعلون الآن`;
  };

  const typingLabel = getTypingLabel();

  const selectedCount = selectedMessageIds.length;
  const allSelected = messages.length > 0 && selectedCount >= messages.length;
  const hasCopyableText = selectedMessages.some((m) => Boolean(m.text?.trim()) && !m.isDeleted);
  const canDeleteSelectedForEveryone =
    selectedMessages.length > 0 &&
    selectedMessages.some((m) => m.senderId === currentUser?.uid || isActiveChatModerator);

  const handleCopySelected = () => {
    const joined = selectedMessages
      .filter((m) => !m.isDeleted)
      .map((m) => m.text?.trim())
      .filter(Boolean)
      .join('\n');
    if (!joined) return;
    navigator.clipboard.writeText(joined);
    setCopiedSelection(true);
    setTimeout(() => setCopiedSelection(false), 1800);
  };

  const handleQuickSaveSelected = async () => {
    if (selectedMessages.length === 0 || savingToSaved) return;
    setSavingToSaved(true);
    try {
      await forwardMessages(selectedMessages, [{ isSaved: true }]);
    } finally {
      setSavingToSaved(false);
    }
  };

  const handleDeleteSelected = async (mode: 'me' | 'everyone') => {
    if (selectedMessageIds.length === 0 || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteMessages(selectedMessageIds, mode);
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isSelectionMode) {
    return (
      <>
        <div
          className={`h-15 border-b px-3 sm:px-4 flex items-center justify-between shrink-0 z-10 backdrop-blur-md transition-colors duration-150 select-none ${
            theme === 'light'
              ? 'bg-white/95 border-slate-200/80 text-slate-900'
              : 'bg-[#17212b]/95 border-white/[0.06] text-white'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={clearSelection}
              aria-label="إلغاء تحديد الرسائل"
              className={`min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-[#2481cc]/15 text-[#2481cc] text-xs font-extrabold tabular-nums">
                {selectedCount}
              </span>
              <span className="text-sm font-bold truncate">
                {selectedCount === 0
                  ? 'اختر الرسائل'
                  : selectedCount === 1
                  ? 'رسالة محددة'
                  : 'رسائل محددة'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (allSelected) {
                  enterSelectionMode();
                } else {
                  selectAllMessages();
                }
              }}
              className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {allSelected ? 'إلغاء الكل' : 'تحديد الكل'}
            </button>

            {hasCopyableText && (
              <button
                type="button"
                onClick={handleCopySelected}
                className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl transition-colors cursor-pointer ${
                  copiedSelection
                    ? 'text-emerald-500 bg-emerald-500/15'
                    : theme === 'light'
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
                }`}
                title="نسخ المحدد"
              >
                {copiedSelection ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            )}

            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => setShowDeleteConfirm(true)}
              className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                theme === 'light'
                  ? 'text-rose-600 hover:bg-rose-50'
                  : 'text-rose-400 hover:bg-rose-500/10'
              }`}
              title="حذف المحدد"
              aria-label="حذف المحدد"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {activeChat.type !== 'saved' && (
              <button
                type="button"
                disabled={selectedCount === 0 || savingToSaved}
                onClick={handleQuickSaveSelected}
                className={`min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  theme === 'light'
                    ? 'text-amber-600 hover:bg-amber-50'
                    : 'text-amber-400 hover:bg-amber-500/10'
                }`}
                title="حفظ في الرسائل المحفوظة"
              >
                <Bookmark className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => openForwardModal(selectedMessages)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2481cc] hover:bg-[#1e6fb1] text-white text-xs font-bold shadow-sm shadow-[#2481cc]/25 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Forward className="w-4 h-4" />
              <span>تحويل</span>
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-xs rounded-3xl p-5 border shadow-2xl text-right space-y-3 ${
                theme === 'light'
                  ? 'bg-white border-slate-200 text-slate-900'
                  : 'bg-[#111923] border-white/[0.08] text-white'
              }`}
            >
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <Trash2 className="w-4 h-4" />
                <span>حذف {selectedCount} رسائل</span>
              </div>
              <p className="text-xs text-[#8ea0b5] leading-relaxed">
                اختر ما إذا كنت تريد إخفاء الرسائل لديك فقط أم حذفها نهائياً للجميع.
              </p>
              <div className="space-y-2 pt-1">
                {canDeleteSelectedForEveryone && (
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => handleDeleteSelected('everyone')}
                    className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isDeleting ? 'جاري الحذف...' : 'حذف للجميع'}
                  </button>
                )}
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleDeleteSelected('me')}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                    theme === 'light'
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                      : 'bg-white/[0.08] hover:bg-white/[0.14] text-white'
                  }`}
                >
                  حذف لدي فقط
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-2 rounded-xl text-xs font-semibold text-[#8ea0b5] hover:underline cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div
      className={`h-15 border-b px-3 sm:px-4 flex items-center justify-between shrink-0 z-10 backdrop-blur-md transition-colors duration-150 select-none ${
        theme === 'light'
          ? 'bg-white/95 border-slate-200/80'
          : 'bg-[#17212b]/95 border-white/[0.06]'
      }`}
    >
      {/* Left (RTL Start): Avatar & Info */}
      <div
        className="flex items-center gap-3 min-w-0 cursor-pointer"
        onClick={() => setShowInfoDrawer(!showInfoDrawer)}
      >
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 overflow-hidden bg-gradient-to-tr ring-1 ${
            theme === 'light' ? 'ring-black/5' : 'ring-white/10'
          } ${getAvatarGradient(displayInfo.otherUser?.uid || activeChat.id)}`}
        >
          {displayInfo.photoURL ? (
            <img
              src={displayInfo.photoURL}
              alt={displayInfo.title}
              decoding="async"
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{getInitials(displayInfo.title)}</span>
          )}
        </div>

        <div className="min-w-0">
          <h2
            className={`text-sm font-bold truncate leading-tight flex items-center gap-1.5 ${
              theme === 'light' ? 'text-gray-900' : 'text-white'
            }`}
          >
            <span className="truncate">{displayInfo.title}</span>
            {activeChat.type === 'channel' && (
              <span className="text-[#2481cc] text-[12px] font-bold">✓</span>
            )}
            {isMuted && <VolumeX className="w-3.5 h-3.5 text-[#8ea0b5] shrink-0" />}
          </h2>
          {typingLabel ? (
            <div className="flex items-center gap-1.5 text-xs text-[#2481cc] font-semibold truncate">
              {isAnyRecording && <Mic className="w-3.5 h-3.5 animate-pulse shrink-0" />}
              <span className="truncate">{typingLabel}</span>
              <span className="inline-flex items-center gap-0.5 shrink-0" aria-hidden="true">
                <span className="w-1 h-1 rounded-full bg-[#2481cc] animate-bounce [animation-delay:0ms]" />
                <span className="w-1 h-1 rounded-full bg-[#2481cc] animate-bounce [animation-delay:150ms]" />
                <span className="w-1 h-1 rounded-full bg-[#2481cc] animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          ) : activeChat.type === 'direct' ? (
            <div
              className={`flex items-center gap-1.5 text-xs truncate transition-colors ${
                isActiveChatBlocked
                  ? 'text-rose-400 font-medium'
                  : isDirectOnline
                  ? 'text-emerald-400 font-medium'
                  : theme === 'light'
                  ? 'text-gray-500'
                  : 'text-[#7f91a4]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isActiveChatBlocked
                    ? 'bg-rose-500'
                    : isDirectOnline
                    ? 'bg-emerald-500'
                    : theme === 'light'
                    ? 'bg-gray-400'
                    : 'bg-[#7f91a4]'
                }`}
                aria-hidden="true"
              />
              <span className="truncate">
                {isActiveChatBlocked
                  ? 'مستخدم محظور'
                  : hidesPresence
                  ? 'آخر ظهور مخفي'
                  : isDirectOnline
                  ? 'متصل'
                  : directLastSeenText
                  ? `غير متصل • آخر ظهور ${directLastSeenText}`
                  : 'غير متصل'}
              </span>
            </div>
          ) : (
            <p
              className={`text-xs truncate transition-colors ${
                displayInfo.isOnline
                  ? 'text-emerald-400 font-medium'
                  : theme === 'light'
                  ? 'text-gray-500'
                  : 'text-[#7f91a4]'
              }`}
            >
              {displayInfo.subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right (RTL End): Actions */}
      <div className="flex items-center gap-1">
        {isActiveChatMember &&
          !isActiveChatBlocked &&
          activeChat.type !== 'channel' &&
          activeChat.type !== 'saved' && (
            <>
              <button
                type="button"
                onClick={() => startCall(activeChat, false)}
                className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors duration-150 cursor-pointer ${
                  theme === 'light'
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
                }`}
                title="مكالمة صوتية"
                aria-label="مكالمة صوتية"
              >
                <Phone className="w-[18px] h-[18px]" />
              </button>

              <button
                type="button"
                onClick={() => startCall(activeChat, true)}
                className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors duration-150 cursor-pointer ${
                  theme === 'light'
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
                }`}
                title="مكالمة فيديو"
                aria-label="مكالمة فيديو"
              >
                <Video className="w-[18px] h-[18px]" />
              </button>
            </>
          )}

        <button
          type="button"
          onClick={() => setShowInfoDrawer(!showInfoDrawer)}
          className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors duration-150 cursor-pointer ${
            showInfoDrawer
              ? 'text-[#2481cc] bg-[#2481cc]/15'
              : theme === 'light'
              ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
          }`}
          title="معلومات المحادثة"
          aria-label="معلومات المحادثة"
        >
          <Info className="w-[18px] h-[18px]" />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu((prev) => !prev)}
            className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors duration-150 cursor-pointer ${
              showMenu
                ? 'text-[#2481cc] bg-[#2481cc]/15'
                : theme === 'light'
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
            }`}
            title="المزيد من الخيارات"
            aria-label="المزيد من الخيارات"
          >
            <MoreVertical className="w-[18px] h-[18px]" />
          </button>

          {showMenu && (
            <div
              className={`absolute left-0 top-12 rounded-2xl shadow-2xl border overflow-hidden p-1.5 min-w-[210px] z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 ${
                theme === 'light'
                  ? 'bg-white/95 border-slate-200/80 text-slate-800'
                  : 'bg-[#162230]/95 border-white/[0.08] text-white'
              }`}
            >
              {activeChat.type !== 'saved' && (
                <button
                  type="button"
                  onClick={() => {
                    togglePinChat(activeChat.id);
                    setShowMenu(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition-colors duration-150 text-right cursor-pointer ${
                    theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <Pin className={`w-4 h-4 rotate-45 ${isPinned ? 'text-[#2481cc]' : 'text-[#8ea0b5]'}`} />
                  <span>{isPinned ? 'إلغاء تثبيت المحادثة' : 'تثبيت المحادثة'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  toggleMuteChat(activeChat.id);
                  setShowMenu(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition-colors duration-150 text-right cursor-pointer ${
                  theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                }`}
              >
                {isMuted ? (
                  <>
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    <span>إلغاء كتم الإشعارات</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 text-[#8ea0b5]" />
                    <span>كتم الإشعارات</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  enterSelectionMode();
                  setShowMenu(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition-colors duration-150 text-right cursor-pointer ${
                  theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                }`}
              >
                <CheckSquare className="w-4 h-4 text-[#2481cc]" />
                <span>تحديد رسائل</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowInfoDrawer(true);
                  setShowMenu(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition-colors duration-150 text-right cursor-pointer ${
                  theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                }`}
              >
                <Info className="w-4 h-4 text-[#8ea0b5]" />
                <span>عرض التفاصيل</span>
              </button>

              {activeChat.type === 'direct' && directOtherUid && (
                <button
                  type="button"
                  onClick={() => {
                    toggleBlockUser(directOtherUid);
                    setShowMenu(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition-colors duration-150 text-right cursor-pointer ${
                    isActiveChatBlocked
                      ? 'text-emerald-400 hover:bg-emerald-500/10'
                      : 'text-rose-400 hover:bg-rose-500/10'
                  }`}
                >
                  <Ban className="w-4 h-4" />
                  <span>{isActiveChatBlocked ? 'إلغاء حظر المستخدم' : 'حظر المستخدم'}</span>
                </button>
              )}

              {isActiveChatMember &&
                (activeChat.type === 'group' || activeChat.type === 'channel') &&
                activeChat.createdBy !== currentUser?.uid && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      leaveChat(activeChat.id);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl text-rose-400 hover:bg-rose-500/10 transition-colors duration-150 text-right cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{activeChat.type === 'channel' ? 'إلغاء الاشتراك' : 'مغادرة المجموعة'}</span>
                  </button>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
