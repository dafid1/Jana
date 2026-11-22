import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Phone,
  Video,
  MoreVertical,
  Volume2,
  VolumeX,
  Info,
} from 'lucide-react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, isChatAccessibleOnServer, OperationType } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { TypingIndicator, UserProfile } from '../../types/telegram';
import {
  getAvatarGradient,
  getInitials,
  isUserOnlineByLastSeen,
  formatLastSeenArabic,
} from '../../utils/telegramHelpers';

interface ChatHeaderProps {
  onBack: () => void;
}

const TYPING_STALE_MS = 7000;

export const ChatHeader: React.FC<ChatHeaderProps> = React.memo(({ onBack }) => {
  const { theme, currentUser, usersMap } = useAuth();
  const {
    activeChat,
    showInfoDrawer,
    setShowInfoDrawer,
    startCall,
    getChatDisplayInfo,
  } = useChat();
  const [showMenu, setShowMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [rawTypingUsers, setRawTypingUsers] = useState<TypingIndicator[]>([]);
  const [directUserProfile, setDirectUserProfile] = useState<UserProfile | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const directOtherUid =
    activeChat?.type === 'direct' && currentUser
      ? activeChat.memberIds.find((id) => id !== currentUser.uid)
      : undefined;

  // Listen directly to Firestore users/{otherUid} for real-time lastSeen updates
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

  // Listen in real time to Firestore /chats/{chatId}/typing subcollection
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

  // Keep clock ticker active for stale typing expiration and real-time lastSeen online threshold
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

  const displayInfo = getChatDisplayInfo(activeChat);
  const resolvedOtherUser = directUserProfile || displayInfo.otherUser;
  const isDirectOnline =
    activeChat.type === 'direct'
      ? isUserOnlineByLastSeen(resolvedOtherUser, nowTick)
      : displayInfo.isOnline;
  const directLastSeenText =
    activeChat.type === 'direct'
      ? formatLastSeenArabic(resolvedOtherUser?.lastSeen, nowTick)
      : '';

  const activeTypers = rawTypingUsers.filter((t) => {
    const updatedMs = new Date(t.updatedAt).getTime();
    return !Number.isNaN(updatedMs) && nowTick - updatedMs < TYPING_STALE_MS;
  });

  const getTypingLabel = (): string | null => {
    if (activeTypers.length === 0) return null;
    if (activeChat.type === 'direct') {
      return 'يكتب الآن';
    }
    const names = activeTypers.map(
      (t) => usersMap[t.uid]?.displayName || t.displayName || 'مستخدم'
    );
    if (names.length === 1) {
      return `${names[0]} يكتب الآن`;
    }
    if (names.length === 2) {
      return `${names[0]} و ${names[1]} يكتبان الآن`;
    }
    return `${names.length} أعضاء يكتبون الآن`;
  };

  const typingLabel = getTypingLabel();

  return (
    <div
      className={`h-15 border-b px-4 flex items-center justify-between shrink-0 z-10 transition-colors select-none ${
        theme === 'light' ? 'bg-white border-gray-200' : 'bg-[#17212b] border-[#232e3c]'
      }`}
    >
      {/* Left (RTL Start): Avatar & Info */}
      <div
        className="flex items-center gap-3 min-w-0 cursor-pointer"
        onClick={() => setShowInfoDrawer(!showInfoDrawer)}
      >
        {/* Mobile Back Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBack();
          }}
          className="md:hidden p-1.5 -mr-1 rounded-full text-[#7f91a4] hover:text-white"
        >
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* Chat Avatar */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
            displayInfo.otherUser?.uid || activeChat.id
          )}`}
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

        {/* Title & Real-Time Typing / Presence Status */}
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
          </h2>
          {typingLabel ? (
            <div className="flex items-center gap-1.5 text-xs text-[#2481cc] font-semibold truncate">
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
                isDirectOnline
                  ? 'text-emerald-400 font-medium'
                  : theme === 'light'
                  ? 'text-gray-500'
                  : 'text-[#7f91a4]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isDirectOnline
                    ? 'bg-emerald-500'
                    : theme === 'light'
                    ? 'bg-gray-400'
                    : 'bg-[#7f91a4]'
                }`}
                aria-hidden="true"
              />
              <span className="truncate">
                {isDirectOnline
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
        {activeChat.type !== 'channel' && activeChat.type !== 'saved' && (
          <button
            onClick={() => startCall(activeChat, false)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              theme === 'light'
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-[#7f91a4] hover:text-white hover:bg-[#232e3c]'
            }`}
            title="مكالمة صوتية"
          >
            <Phone className="w-5 h-5" />
          </button>
        )}

        {activeChat.type !== 'channel' && activeChat.type !== 'saved' && (
          <button
            onClick={() => startCall(activeChat, true)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              theme === 'light'
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-[#7f91a4] hover:text-white hover:bg-[#232e3c]'
            }`}
            title="مكالمة فيديو"
          >
            <Video className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={() => setShowInfoDrawer(!showInfoDrawer)}
          className={`p-2 rounded-full transition-colors cursor-pointer ${
            showInfoDrawer
              ? 'text-[#2481cc] bg-[#2481cc]/15'
              : theme === 'light'
              ? 'text-gray-600 hover:bg-gray-100'
              : 'text-[#7f91a4] hover:text-white hover:bg-[#232e3c]'
          }`}
          title="معلومات المحادثة"
        >
          <Info className="w-5 h-5" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowMenu((prev) => !prev)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              theme === 'light'
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-[#7f91a4] hover:text-white hover:bg-[#232e3c]'
            }`}
            title="المزيد من الخيارات"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showMenu && (
            <div
              className={`absolute left-0 top-11 rounded-2xl shadow-xl border overflow-hidden p-1 min-w-[190px] z-50 animate-in fade-in zoom-in-95 duration-150 ${
                theme === 'light'
                  ? 'bg-white border-gray-200 text-gray-800'
                  : 'bg-[#1e2a38] border-[#2b3a4a] text-white'
              }`}
            >
              <button
                onClick={() => {
                  setIsMuted(!isMuted);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl hover:bg-white/5 transition-colors text-right"
              >
                {isMuted ? (
                  <>
                    <Volume2 className="w-4 h-4 text-[#2481cc]" />
                    <span>إلغاء كتم الإشعارات</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 text-[#7f91a4]" />
                    <span>كتم الإشعارات</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowInfoDrawer(true);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-xl hover:bg-white/5 transition-colors text-right"
              >
                <Info className="w-4 h-4 text-[#7f91a4]" />
                <span>عرض التفاصيل</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
