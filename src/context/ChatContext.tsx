import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  deleteField,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  arrayUnion,
  writeBatch,
  increment,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  isChatAccessibleOnServer,
  OperationType,
} from '../firebase/config';
import { useAuth } from './AuthContext';
import {
  Chat,
  Message,
  FolderFilter,
  PollData,
  MessageType,
  Story,
  CallState,
  CallDocument,
  UserProfile,
  GroupInvite,
  UserStickerDoc,
  TypingIndicator,
} from '../types/telegram';
import {
  tgAudio,
  generateInviteCode,
  parseInviteTarget,
  buildChatInviteLink,
  isUserOnlineByLastSeen,
  formatLastSeenArabic,
  getMessageReplyPreview,
  compressImageFile,
  formatBytes,
} from '../utils/telegramHelpers';
import { extractRichLinkPreview } from '../utils/linkPreview';
import { enrichMessageLinkPreview, getCloudRtcConfig } from '../utils/apiClient';
import { uploadMediaWithFallback } from '../utils/mediaStorage';
import { triggerMessageNotification } from '../utils/vaultBridge';

const DEFAULT_MESSAGE_PAGE_SIZE = 45;
const MESSAGE_PAGE_STEP = 40;
const TYPING_STALE_MS = 7000;

const fireConfetti = (opts: { particleCount: number; spread: number; origin?: { y: number } }) => {
  import('canvas-confetti')
    .then((mod) => mod.default(opts))
    .catch(() => {});
};

interface ChatDisplayInfo {
  title: string;
  photoURL?: string;
  isOnline: boolean;
  subtitle: string;
  otherUser?: UserProfile;
}

export interface ChatTypingSummary {
  label: string;
  activity: 'typing' | 'recording';
}

interface ChatContextType {
  chats: Chat[];
  activeChat: Chat | null;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  messages: Message[];
  loadingChats: boolean;
  loadingMessages: boolean;
  hasMoreMessages: boolean;
  isLoadingOlderMessages: boolean;
  loadOlderMessages: () => void;
  firstUnreadMessageId: string | null;
  filter: FolderFilter;
  setFilter: (f: FolderFilter) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  messageSearchMatches: Record<string, Message>;
  isSearchingMessages: boolean;
  replyingTo: Message | null;
  setReplyingTo: (m: Message | null) => void;
  editingMessage: Message | null;
  setEditingMessage: (m: Message | null) => void;
  showInfoDrawer: boolean;
  setShowInfoDrawer: (show: boolean) => void;
  activeMediaUrl: string | null;
  setActiveMediaUrl: (url: string | null) => void;
  stories: Story[];
  addStory: (mediaUrl: string, caption?: string) => Promise<void>;
  markStoryViewed: (storyId: string) => Promise<void>;
  activeStoryIndex: number | null;
  setActiveStoryIndex: (idx: number | null) => void;
  callState: CallState;
  incomingCall: CallDocument | null;
  startCall: (chat: Chat, isVideo?: boolean) => Promise<void>;
  acceptIncomingCall: () => Promise<void>;
  declineIncomingCall: () => Promise<void>;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  typingStatus: string | null;
  chatTypingMap: Record<string, ChatTypingSummary>;
  updateTypingStatus: (
    isTyping: boolean,
    targetChatId?: string,
    activity?: 'typing' | 'recording'
  ) => Promise<void>;
  getChatDisplayInfo: (chat: Chat) => ChatDisplayInfo;
  isChatBlockedByMe: (chat: Chat | null) => boolean;
  isActiveChatBlocked: boolean;
  isActiveChatModerator: boolean;
  canPostInActiveChat: boolean;
  startDirectChat: (targetUser: UserProfile) => Promise<string>;
  createGroup: (data: {
    title: string;
    description?: string;
    photoURL?: string;
    memberIds: string[];
  }) => Promise<string>;
  addMembersToGroup: (chatId: string, newMemberIds: string[]) => Promise<void>;
  updateGroupOrChannelInfo: (
    chatId: string,
    data: { title: string; description?: string; photoURL?: string }
  ) => Promise<void>;
  promoteChatAdmin: (chatId: string, targetUid: string) => Promise<void>;
  demoteChatAdmin: (chatId: string, targetUid: string) => Promise<void>;
  kickMemberFromChat: (chatId: string, targetUid: string, ban?: boolean) => Promise<void>;
  unbanMemberFromChat: (chatId: string, targetUid: string) => Promise<void>;
  regenerateInviteLink: (chatId: string) => Promise<string>;
  leaveChat: (chatId: string) => Promise<void>;
  joinGroupByInvite: (codeOrLink: string) => Promise<Chat>;
  sendMessage: (
    text: string,
    type?: MessageType,
    extra?: Partial<Message>,
    targetChatIdOverride?: string
  ) => Promise<void>;
  sendVideoMessage: (
    file: File,
    caption?: string,
    onProgress?: (percent: number) => void
  ) => Promise<void>;
  deleteMessages: (messageIds: string[], mode: 'me' | 'everyone') => Promise<void>;
  editMessageText: (messageId: string, newText: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  pinMessage: (messageId: string, isPinned: boolean) => Promise<void>;
  createChat: (chatData: Omit<Chat, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<string>;
  voteInPoll: (messageId: string, optionId: string) => Promise<void>;
  sendDiceRoll: (emoji?: string) => Promise<void>;
  userStickers: UserStickerDoc[];
  sendStickerMessage: (sticker: {
    id: string;
    emoji: string;
    name: string;
    label: string;
    url: string;
    isCustom?: boolean;
  }) => Promise<void>;
  saveCustomSticker: (file: File, label?: string, emoji?: string) => Promise<UserStickerDoc>;
  deleteCustomSticker: (stickerId: string) => Promise<void>;
  pinnedMessage: Message | null;
  pendingInviteStatus: { message: string; type: 'success' | 'error' } | null;
  clearPendingInviteStatus: () => void;
  isActiveChatMember: boolean;
  openInviteLink: (codeOrLink: string) => Promise<Chat>;
  joinChat: (chatId: string) => Promise<Chat>;
  resolveInvitePreview: (codeOrLink: string) => Promise<Chat | null>;
  ensureChatInviteLink: (chatId: string) => Promise<string>;
  isSelectionMode: boolean;
  selectedMessageIds: string[];
  selectedMessages: Message[];
  enterSelectionMode: (initialMessageId?: string) => void;
  toggleMessageSelection: (messageId: string) => void;
  selectAllMessages: () => void;
  clearSelection: () => void;
  forwardingMessages: Message[] | null;
  openForwardModal: (msgs: Message[]) => void;
  closeForwardModal: () => void;
  forwardMessages: (
    msgs: Message[],
    targets: { chatId?: string; user?: UserProfile; isSaved?: boolean }[],
    optionalComment?: string
  ) => Promise<{ targetChatIds: string[]; count: number }>;
  forwardToast: { message: string; type: 'success' | 'error'; targetChatId?: string } | null;
  clearForwardToast: () => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, userProfile, usersMap, isAdmin } = useAuth();
  const [rawChats, setRawChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageLimit, setMessageLimit] = useState<number>(DEFAULT_MESSAGE_PAGE_SIZE);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<string | null>(null);

  const [filter, setFilter] = useState<FolderFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageSearchMatches, setMessageSearchMatches] = useState<Record<string, Message>>({});
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  const [replyingTo, setReplyingToState] = useState<Message | null>(null);
  const [editingMessage, setEditingMessageState] = useState<Message | null>(null);

  const setReplyingTo = useCallback((msg: Message | null) => {
    setReplyingToState(msg);
    if (msg) {
      setEditingMessageState(null);
    }
  }, []);

  const setEditingMessage = useCallback((msg: Message | null) => {
    setEditingMessageState(msg);
    if (msg) {
      setReplyingToState(null);
    }
  }, []);

  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [activeMediaUrl, setActiveMediaUrl] = useState<string | null>(null);
  const [chatTypingMap, setChatTypingMap] = useState<Record<string, ChatTypingSummary>>({});
  const [pendingInviteStatus, setPendingInviteStatus] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [forwardingMessages, setForwardingMessages] = useState<Message[] | null>(null);
  const [forwardToast, setForwardToast] = useState<{
    message: string;
    type: 'success' | 'error';
    targetChatId?: string;
  } | null>(null);

  // Cloud Stories & Stickers
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [userStickers, setUserStickers] = useState<UserStickerDoc[]>([]);

  // Real WebRTC Call State
  const [incomingCall, setIncomingCall] = useState<CallDocument | null>(null);
  const [callState, setCallState] = useState<CallState>({
    isActive: false,
    callId: null,
    direction: undefined,
    isVideo: false,
    status: 'calling',
    duration: 0,
    isMuted: false,
    isCameraOff: false,
    chat: null,
    localStream: null,
    remoteStream: null,
  });

  const [previewChat, setPreviewChat] = useState<Chat | null>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const forwardToastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const seededRef = useRef<string | null>(null);
  const activeChatIdRef = useRef<string | null>(null);
  activeChatIdRef.current = activeChatId;
  const previewChatRef = useRef<Chat | null>(null);
  previewChatRef.current = previewChat;
  const invitePreviewCacheRef = useRef<Map<string, { chat: Chat | null; ts: number }>>(
    new Map()
  );
  const cachedChatMessagesRef = useRef<Map<string, { updatedAt: string; items: Message[] }>>(
    new Map()
  );
  const prevChatMessageTimesRef = useRef<Map<string, string>>(new Map());
  const chatsSnapshotInitializedRef = useRef(false);
  const firstUnreadComputedForChatRef = useRef<string | null>(null);

  // WebRTC Refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const activeCallDocUnsubRef = useRef<(() => void) | null>(null);
  const activeCallCandidatesUnsubRef = useRef<(() => void) | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const addedCandidateIdsRef = useRef<Set<string>>(new Set());
  const callStateRef = useRef<CallState>(callState);
  callStateRef.current = callState;
  const incomingCallRef = useRef<CallDocument | null>(incomingCall);
  incomingCallRef.current = incomingCall;
  const callConnectedAtRef = useRef<number | null>(null);
  const callLogPostedIdsRef = useRef<Set<string>>(new Set());

  // Enrich & sort chats using persisted user pinnedChatIds / mutedChatIds
  const pinnedIdsSet = useMemo(
    () => new Set(userProfile?.pinnedChatIds || []),
    [userProfile?.pinnedChatIds]
  );
  const mutedIdsSet = useMemo(
    () => new Set(userProfile?.mutedChatIds || []),
    [userProfile?.mutedChatIds]
  );
  const blockedIdsSet = useMemo(
    () => new Set(userProfile?.blockedUserIds || []),
    [userProfile?.blockedUserIds]
  );

  const chats = useMemo(() => {
    const enriched = rawChats.map((c) => ({
      ...c,
      isPinned: c.type === 'saved' || pinnedIdsSet.has(c.id),
      isMuted: mutedIdsSet.has(c.id),
    }));
    enriched.sort((a, b) => {
      if (a.type === 'saved' && b.type !== 'saved') return -1;
      if (b.type === 'saved' && a.type !== 'saved') return 1;
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });
    return enriched;
  }, [rawChats, pinnedIdsSet, mutedIdsSet]);

  const chatsRef = useRef<Chat[]>([]);
  chatsRef.current = chats;

  const activeChat = useMemo(
    () =>
      chats.find((c) => c.id === activeChatId) ||
      (previewChat && previewChat.id === activeChatId
        ? {
            ...previewChat,
            isPinned: previewChat.type === 'saved' || pinnedIdsSet.has(previewChat.id),
            isMuted: mutedIdsSet.has(previewChat.id),
          }
        : null),
    [chats, activeChatId, previewChat, pinnedIdsSet, mutedIdsSet]
  );

  const isActiveChatMember = useMemo(() => {
    if (!currentUser || !activeChat) return false;
    if (activeChat.id === `saved_${currentUser.uid}` || activeChat.type === 'saved') {
      return true;
    }
    return (
      Array.isArray(activeChat.memberIds) && activeChat.memberIds.includes(currentUser.uid)
    );
  }, [currentUser, activeChat]);

  const isChatBlockedByMe = useCallback(
    (chat: Chat | null): boolean => {
      if (!chat || chat.type !== 'direct' || !currentUser) return false;
      const otherUid = chat.memberIds.find((id) => id !== currentUser.uid);
      return Boolean(otherUid && blockedIdsSet.has(otherUid));
    },
    [currentUser, blockedIdsSet]
  );

  const isActiveChatBlocked = useMemo(
    () => isChatBlockedByMe(activeChat),
    [activeChat, isChatBlockedByMe]
  );

  const isActiveChatModerator = useMemo(() => {
    if (!currentUser || !activeChat) return false;
    return Boolean(
      isAdmin ||
        activeChat.createdBy === currentUser.uid ||
        (Array.isArray(activeChat.adminIds) && activeChat.adminIds.includes(currentUser.uid))
    );
  }, [currentUser, activeChat, isAdmin]);

  const canPostInActiveChat = useMemo(() => {
    if (!activeChat || !isActiveChatMember || isActiveChatBlocked) return false;
    if (activeChat.type === 'channel') {
      return isActiveChatModerator;
    }
    return true;
  }, [activeChat, isActiveChatMember, isActiveChatBlocked, isActiveChatModerator]);

  const pinnedMessage = useMemo(
    () => messages.find((m) => m.isPinned && !m.isDeleted) || null,
    [messages]
  );

  const selectedMessages = useMemo(() => {
    if (selectedMessageIds.length === 0) return [];
    const idSet = new Set(selectedMessageIds);
    return messages
      .filter((m) => idSet.has(m.id))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, selectedMessageIds]);

  const typingStatus = activeChatId ? chatTypingMap[activeChatId]?.label || null : null;

  const clearPendingInviteStatus = useCallback(() => setPendingInviteStatus(null), []);
  const clearForwardToast = useCallback(() => {
    if (forwardToastTimerRef.current) {
      clearTimeout(forwardToastTimerRef.current);
      forwardToastTimerRef.current = null;
    }
    setForwardToast(null);
  }, []);

  const showForwardToast = useCallback(
    (payload: { message: string; type: 'success' | 'error'; targetChatId?: string }) => {
      if (forwardToastTimerRef.current) {
        clearTimeout(forwardToastTimerRef.current);
      }
      setForwardToast(payload);
      forwardToastTimerRef.current = setTimeout(() => {
        setForwardToast(null);
        forwardToastTimerRef.current = null;
      }, 4200);
    },
    []
  );

  const enterSelectionMode = useCallback((initialMessageId?: string) => {
    setIsSelectionMode(true);
    setReplyingToState(null);
    setEditingMessageState(null);
    if (initialMessageId) {
      setSelectedMessageIds((prev) =>
        prev.includes(initialMessageId) ? prev : [...prev, initialMessageId]
      );
    }
  }, []);

  const toggleMessageSelection = useCallback((messageId: string) => {
    setSelectedMessageIds((prev) =>
      prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId]
    );
  }, []);

  const selectAllMessages = useCallback(() => {
    setIsSelectionMode(true);
    setSelectedMessageIds(messages.map((m) => m.id));
  }, [messages]);

  const clearSelection = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedMessageIds([]);
  }, []);

  const openForwardModal = useCallback((msgs: Message[]) => {
    if (!msgs || msgs.length === 0) return;
    const ordered = [...msgs].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    setForwardingMessages(ordered);
  }, []);

  const closeForwardModal = useCallback(() => {
    setForwardingMessages(null);
  }, []);

  const loadOlderMessages = useCallback(() => {
    if (!hasMoreMessages || isLoadingOlderMessages) return;
    setIsLoadingOlderMessages(true);
    setMessageLimit((prev) => prev + MESSAGE_PAGE_STEP);
  }, [hasMoreMessages, isLoadingOlderMessages]);

  // Resolve display name/avatar dynamically (respecting privacyHideLastSeen & blocked status)
  const getChatDisplayInfo = useCallback(
    (chat: Chat): ChatDisplayInfo => {
      if (chat.type === 'direct' && currentUser) {
        const otherUid = chat.memberIds.find((id) => id !== currentUser.uid);
        const otherUser = otherUid ? usersMap[otherUid] : undefined;
        if (otherUser) {
          const isBlocked = blockedIdsSet.has(otherUser.uid);
          const hidesPresence = Boolean(otherUser.privacyHideLastSeen);
          const online = !isBlocked && !hidesPresence && isUserOnlineByLastSeen(otherUser);
          const lastSeenText =
            !isBlocked && !hidesPresence ? formatLastSeenArabic(otherUser.lastSeen) : '';
          return {
            title: otherUser.displayName || otherUser.username,
            photoURL: otherUser.photoURL,
            isOnline: online,
            subtitle: isBlocked
              ? 'مستخدم محظور'
              : hidesPresence
              ? 'آخر ظهور مخفي'
              : online
              ? 'متصل'
              : lastSeenText
              ? `غير متصل • آخر ظهور ${lastSeenText}`
              : 'غير متصل',
            otherUser,
          };
        }
        return {
          title: chat.title,
          photoURL: chat.photoURL,
          isOnline: false,
          subtitle: 'محادثة خاصة',
        };
      }

      if (chat.type === 'saved') {
        return {
          title: 'الرسائل المحفوظة',
          photoURL: undefined,
          isOnline: false,
          subtitle: 'سحابتك الشخصية للرسائل والملفات',
        };
      }

      if (chat.type === 'channel') {
        return {
          title: chat.title,
          photoURL: chat.photoURL,
          isOnline: false,
          subtitle: `${chat.membersCount || chat.memberIds?.length || 1} مشترك`,
        };
      }

      return {
        title: chat.title,
        photoURL: chat.photoURL,
        isOnline: false,
        subtitle: `${chat.memberIds?.length || chat.membersCount || 1} أعضاء`,
      };
    },
    [currentUser, usersMap, blockedIdsSet]
  );

  // Add Cloud Story
  const addStory = async (mediaUrl: string, caption = '') => {
    if (!currentUser) return;
    try {
      const storyRef = doc(collection(db, 'stories'));
      const newStory: Story = {
        id: storyRef.id,
        userId: currentUser.uid,
        userName: userProfile?.displayName || userProfile?.username || 'مستخدم',
        userAvatar: userProfile?.photoURL || '',
        mediaUrl,
        caption,
        viewedBy: [currentUser.uid],
        createdAt: new Date().toISOString(),
      };
      await setDoc(storyRef, newStory);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'stories');
    }
  };

  const markStoryViewed = async (storyId: string) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'stories', storyId), {
        viewedBy: arrayUnion(currentUser.uid),
      }).catch(() => {});
    } catch {
      // Ignore
    }
  };

  // ==================== REAL WEBRTC AUDIO / VIDEO CALLING ====================

  const cleanupWebRTCResources = useCallback(() => {
    tgAudio.stopCallingTone();
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    if (activeCallDocUnsubRef.current) {
      activeCallDocUnsubRef.current();
      activeCallDocUnsubRef.current = null;
    }
    if (activeCallCandidatesUnsubRef.current) {
      activeCallCandidatesUnsubRef.current();
      activeCallCandidatesUnsubRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
      } catch {
        // Ignore close failure
      }
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // Ignore
        }
      });
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // Ignore
        }
      });
      remoteStreamRef.current = null;
    }
    pendingIceCandidatesRef.current = [];
    addedCandidateIdsRef.current.clear();
    callConnectedAtRef.current = null;
  }, []);

  const postCallSummaryMessage = useCallback(
    async (
      callId: string,
      chat: Chat | null,
      isVideo: boolean,
      status: 'missed' | 'declined' | 'ended',
      durationSec: number
    ) => {
      if (!currentUser || !chat || callLogPostedIdsRef.current.has(callId)) return;
      callLogPostedIdsRef.current.add(callId);

      const label =
        status === 'missed'
          ? isVideo
            ? '📹 مكالمة فيديو فائتة'
            : '📞 مكالمة صوتية فائتة'
          : status === 'declined'
          ? isVideo
            ? '📹 تم رفض مكالمة الفيديو'
            : '📞 تم رفض المكالمة الصوتية'
          : isVideo
          ? `📹 مكالمة فيديو (${Math.max(1, durationSec)} ث)`
          : `📞 مكالمة صوتية (${Math.max(1, durationSec)} ث)`;

      try {
        const now = new Date().toISOString();
        await addDoc(collection(db, 'chats', chat.id, 'messages'), {
          chatId: chat.id,
          senderId: currentUser.uid,
          senderName: userProfile?.displayName || userProfile?.username || 'مستخدم',
          senderPhoto: userProfile?.photoURL || '',
          senderColor: userProfile?.avatarColor || '#2481cc',
          text: label,
          type: 'call',
          callInfo: {
            isVideo,
            status,
            duration: durationSec,
          },
          readBy: [currentUser.uid],
          createdAt: now,
        });

        await updateDoc(doc(db, 'chats', chat.id), {
          updatedAt: now,
          lastMessage: {
            text: label,
            senderId: currentUser.uid,
            senderName: userProfile?.displayName || 'مستخدم',
            createdAt: now,
            type: 'call',
            readBy: [currentUser.uid],
          },
        }).catch(() => {});
      } catch {
        // Non-fatal
      }
    },
    [currentUser, userProfile]
  );

  const startCallDurationTimer = useCallback(() => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callConnectedAtRef.current = Date.now();
    callTimerRef.current = setInterval(() => {
      setCallState((prev) => ({ ...prev, duration: prev.duration + 1 }));
    }, 1000);
  }, []);

  const setupPeerConnection = useCallback(
    async (callId: string, isVideo: boolean) => {
      if (!currentUser) return null;

      let localStream: MediaStream | null = null;
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: isVideo,
          });
        } catch {
          if (isVideo) {
            try {
              localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false,
              });
            } catch {
              localStream = null;
            }
          }
        }
      }

      const remoteStream = new MediaStream();
      localStreamRef.current = localStream;
      remoteStreamRef.current = remoteStream;

      const rtcConfig = await getCloudRtcConfig();
      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream!);
        });
      } else {
        // Add receive-only transceivers so SDP offer/answer still succeeds cleanly
        pc.addTransceiver('audio', { direction: 'recvonly' });
        if (isVideo) {
          pc.addTransceiver('video', { direction: 'recvonly' });
        }
      }

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          event.streams[0].getTracks().forEach((t) => {
            if (!remoteStream.getTracks().some((rt) => rt.id === t.id)) {
              remoteStream.addTrack(t);
            }
          });
        } else if (event.track) {
          if (!remoteStream.getTracks().some((rt) => rt.id === event.track.id)) {
            remoteStream.addTrack(event.track);
          }
        }
        setCallState((prev) => ({
          ...prev,
          remoteStream,
        }));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidateJson = event.candidate.toJSON();
          addDoc(collection(db, 'calls', callId, 'candidates'), {
            senderId: currentUser.uid,
            candidate: candidateJson as Record<string, unknown>,
            createdAt: new Date().toISOString(),
          }).catch(() => {});
        }
      };

      // Subscribe to remote ICE candidates
      const candidatesUnsub = onSnapshot(
        collection(db, 'calls', callId, 'candidates'),
        (snap) => {
          snap.docChanges().forEach(async (change) => {
            if (change.type !== 'added') return;
            if (addedCandidateIdsRef.current.has(change.doc.id)) return;
            const data = change.doc.data() as {
              senderId?: string;
              candidate?: RTCIceCandidateInit;
            };
            if (!data?.candidate || data.senderId === currentUser.uid) return;
            addedCandidateIdsRef.current.add(change.doc.id);

            if (pc.remoteDescription && pc.remoteDescription.type) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              } catch {
                // Ignore stale ICE candidate
              }
            } else {
              pendingIceCandidatesRef.current.push(data.candidate);
            }
          });
        },
        () => {}
      );
      activeCallCandidatesUnsubRef.current = candidatesUnsub;

      return { pc, localStream, remoteStream };
    },
    [currentUser]
  );

  const flushPendingIceCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const queue = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];
    for (const c of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        // Ignore invalid candidate
      }
    }
  }, []);

  const finishAndCloseCallUI = useCallback(
    (finalStatus: 'ended' | 'declined') => {
      cleanupWebRTCResources();
      setCallState((prev) => ({ ...prev, status: finalStatus, localStream: null, remoteStream: null }));
      setTimeout(() => {
        setCallState({
          isActive: false,
          callId: null,
          direction: undefined,
          isVideo: false,
          status: 'calling',
          duration: 0,
          isMuted: false,
          isCameraOff: false,
          chat: null,
          localStream: null,
          remoteStream: null,
        });
      }, 650);
    },
    [cleanupWebRTCResources]
  );

  const startCall = useCallback(
    async (chat: Chat, isVideo = false) => {
      if (!currentUser || callStateRef.current.isActive) return;
      if (isChatBlockedByMe(chat)) {
        setPendingInviteStatus({
          message: 'لا يمكنك إجراء مكالمة مع مستخدم محظور',
          type: 'error',
        });
        return;
      }

      const calleeIds = (chat.memberIds || []).filter((id) => id !== currentUser.uid);
      if (calleeIds.length === 0 || chat.type === 'saved' || chat.type === 'channel') {
        return;
      }

      const callDocRef = doc(collection(db, 'calls'));
      const callId = callDocRef.id;
      const now = new Date().toISOString();

      tgAudio.startCallingTone();
      setCallState({
        isActive: true,
        callId,
        direction: 'outgoing',
        isVideo,
        status: 'calling',
        duration: 0,
        isMuted: false,
        isCameraOff: false,
        chat,
        localStream: null,
        remoteStream: null,
      });

      const setup = await setupPeerConnection(callId, isVideo);
      if (!setup) {
        finishAndCloseCallUI('ended');
        return;
      }

      const { pc, localStream, remoteStream } = setup;
      setCallState((prev) => ({
        ...prev,
        localStream,
        remoteStream,
      }));

      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: isVideo,
        });
        await pc.setLocalDescription(offer);

        const callPayload: CallDocument = {
          id: callId,
          chatId: chat.id,
          callerId: currentUser.uid,
          callerName: userProfile?.displayName || userProfile?.username || 'مستخدم',
          callerPhoto: userProfile?.photoURL || '',
          calleeIds: calleeIds.slice(0, 20),
          isVideo,
          status: 'ringing',
          offer: {
            type: 'offer',
            sdp: offer.sdp || '',
          },
          createdAt: now,
          updatedAt: now,
        };

        await setDoc(callDocRef, callPayload);

        // Listen for answer / status changes
        const unsubCall = onSnapshot(
          callDocRef,
          async (snap) => {
            if (!snap.exists()) return;
            const data = snap.data() as CallDocument;

            if (data.answer?.sdp && pc.signalingState !== 'closed' && !pc.currentRemoteDescription) {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                await flushPendingIceCandidates(pc);
              } catch {
                // Ignore
              }
            }

            if (data.status === 'connected' && callStateRef.current.status !== 'connected') {
              if (callTimeoutRef.current) {
                clearTimeout(callTimeoutRef.current);
                callTimeoutRef.current = null;
              }
              tgAudio.stopCallingTone();
              tgAudio.playPopSound();
              setCallState((prev) => ({ ...prev, status: 'connected' }));
              startCallDurationTimer();
            } else if (data.status === 'declined') {
              await postCallSummaryMessage(callId, chat, isVideo, 'declined', 0);
              finishAndCloseCallUI('declined');
            } else if (data.status === 'ended' || data.status === 'missed') {
              const finalDur = callStateRef.current.duration;
              await postCallSummaryMessage(
                callId,
                chat,
                isVideo,
                data.status === 'missed' ? 'missed' : 'ended',
                finalDur
              );
              finishAndCloseCallUI('ended');
            }
          },
          () => {}
        );
        activeCallDocUnsubRef.current = unsubCall;

        // Auto-miss after 45s if unanswered
        callTimeoutRef.current = setTimeout(async () => {
          if (callStateRef.current.callId === callId && callStateRef.current.status === 'calling') {
            const ts = new Date().toISOString();
            await updateDoc(callDocRef, {
              status: 'missed',
              endedAt: ts,
              updatedAt: ts,
            }).catch(() => {});
            await postCallSummaryMessage(callId, chat, isVideo, 'missed', 0);
            finishAndCloseCallUI('ended');
          }
        }, 45_000);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `calls/${callId}`);
        finishAndCloseCallUI('ended');
      }
    },
    [
      currentUser,
      userProfile,
      isChatBlockedByMe,
      setupPeerConnection,
      flushPendingIceCandidates,
      startCallDurationTimer,
      postCallSummaryMessage,
      finishAndCloseCallUI,
    ]
  );

  const acceptIncomingCall = useCallback(async () => {
    const call = incomingCallRef.current;
    if (!currentUser || !call) return;

    tgAudio.stopCallingTone();
    setIncomingCall(null);

    const linkedChat =
      chatsRef.current.find((c) => c.id === call.chatId) ||
      ({
        id: call.chatId,
        type: 'direct',
        title: call.callerName,
        photoURL: call.callerPhoto,
        createdBy: call.callerId,
        createdAt: call.createdAt,
        updatedAt: call.updatedAt,
        memberIds: [call.callerId, currentUser.uid],
      } as Chat);

    setCallState({
      isActive: true,
      callId: call.id,
      direction: 'incoming',
      isVideo: call.isVideo,
      status: 'connected',
      duration: 0,
      isMuted: false,
      isCameraOff: false,
      chat: linkedChat,
      localStream: null,
      remoteStream: null,
    });

    const setup = await setupPeerConnection(call.id, call.isVideo);
    if (!setup) {
      finishAndCloseCallUI('ended');
      return;
    }

    const { pc, localStream, remoteStream } = setup;
    setCallState((prev) => ({
      ...prev,
      localStream,
      remoteStream,
    }));

    try {
      if (call.offer?.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(call.offer));
        await flushPendingIceCandidates(pc);
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const now = new Date().toISOString();
      const callDocRef = doc(db, 'calls', call.id);
      await updateDoc(callDocRef, {
        status: 'connected',
        answer: {
          type: 'answer',
          sdp: answer.sdp || '',
        },
        updatedAt: now,
      });

      tgAudio.playPopSound();
      startCallDurationTimer();

      const unsubCall = onSnapshot(
        callDocRef,
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as CallDocument;
          if (data.status === 'ended' || data.status === 'declined' || data.status === 'missed') {
            finishAndCloseCallUI('ended');
          }
        },
        () => {}
      );
      activeCallDocUnsubRef.current = unsubCall;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `calls/${call.id}`);
      finishAndCloseCallUI('ended');
    }
  }, [
    currentUser,
    setupPeerConnection,
    flushPendingIceCandidates,
    startCallDurationTimer,
    finishAndCloseCallUI,
  ]);

  const declineIncomingCall = useCallback(async () => {
    const call = incomingCallRef.current;
    tgAudio.stopCallingTone();
    setIncomingCall(null);
    if (!call) return;

    const now = new Date().toISOString();
    await updateDoc(doc(db, 'calls', call.id), {
      status: 'declined',
      endedAt: now,
      updatedAt: now,
    }).catch(() => {});
  }, []);

  const endCall = useCallback(() => {
    const current = callStateRef.current;
    const callId = current.callId;
    const duration = current.duration;
    const wasConnected = current.status === 'connected';
    const chat = current.chat;
    const isVideo = current.isVideo;
    const direction = current.direction;

    if (callId) {
      const now = new Date().toISOString();
      const nextStatus = wasConnected ? 'ended' : direction === 'outgoing' ? 'missed' : 'ended';
      updateDoc(doc(db, 'calls', callId), {
        status: nextStatus,
        endedAt: now,
        updatedAt: now,
      }).catch(() => {});

      if (direction === 'outgoing') {
        postCallSummaryMessage(
          callId,
          chat,
          isVideo,
          wasConnected ? 'ended' : 'missed',
          duration
        );
      }
    }

    finishAndCloseCallUI('ended');
  }, [finishAndCloseCallUI, postCallSummaryMessage]);

  const toggleMute = useCallback(() => {
    setCallState((prev) => {
      const nextMuted = !prev.isMuted;
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !nextMuted;
        });
      }
      return { ...prev, isMuted: nextMuted };
    });
  }, []);

  const toggleCamera = useCallback(() => {
    setCallState((prev) => {
      const nextOff = !prev.isCameraOff;
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = !nextOff;
        });
      }
      return { ...prev, isCameraOff: nextOff };
    });
  }, []);

  // Listen for incoming WebRTC calls in real time
  useEffect(() => {
    if (!currentUser) {
      setIncomingCall(null);
      cleanupWebRTCResources();
      return;
    }

    const q = query(
      collection(db, 'calls'),
      where('calleeIds', 'array-contains', currentUser.uid),
      where('status', '==', 'ringing')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const nowMs = Date.now();
        let freshIncoming: CallDocument | null = null;
        snapshot.forEach((docSnap) => {
          const data = { ...(docSnap.data() as CallDocument), id: docSnap.id };
          const createdMs = new Date(data.createdAt).getTime();
          if (
            data.callerId !== currentUser.uid &&
            !blockedIdsSet.has(data.callerId) &&
            !Number.isNaN(createdMs) &&
            nowMs - createdMs < 60_000
          ) {
            freshIncoming = data;
          }
        });

        if (callStateRef.current.isActive) {
          return;
        }

        if (freshIncoming) {
          setIncomingCall(freshIncoming);
          tgAudio.startCallingTone();
        } else if (incomingCallRef.current) {
          setIncomingCall(null);
          tgAudio.stopCallingTone();
        }
      },
      () => {
        // Ignore transient call listener errors
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser, blockedIdsSet, cleanupWebRTCResources]);

  // Ensure personal Saved Messages cloud space exists
  const ensureSavedMessagesChat = async (userId: string, userName: string) => {
    if (seededRef.current === userId) return;
    seededRef.current = userId;
    try {
      const savedChatId = `saved_${userId}`;
      const savedRef = doc(db, 'chats', savedChatId);
      const snap = await getDoc(savedRef);
      if (snap.exists()) return;

      const now = new Date().toISOString();
      const batch = writeBatch(db);
      batch.set(savedRef, {
        id: savedChatId,
        type: 'saved',
        title: 'الرسائل المحفوظة',
        avatarColor: '#2481cc',
        description: 'مساحتك السحابية الخاصة لحفظ الملاحظات والصور والروابط والملفات.',
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        memberIds: [userId],
        membersCount: 1,
        isPinned: true,
        unreadCounts: { [userId]: 0 },
        lastMessage: {
          text: 'أهلاً بك في سحابة JanaX للرسائل المحفوظة!',
          senderId: userId,
          senderName: userName,
          createdAt: now,
          type: 'text',
          readBy: [userId],
        },
      });

      const welcomeMsgRef = doc(collection(db, 'chats', savedChatId, 'messages'));
      batch.set(welcomeMsgRef, {
        chatId: savedChatId,
        senderId: userId,
        senderName: userName,
        text: 'أهلاً بك في سحابة JanaX للرسائل المحفوظة! يمكنك تخزين ملاحظاتك وملفاتك هنا بأمان.',
        type: 'text',
        readBy: [userId],
        createdAt: now,
      });

      await batch.commit();
    } catch (err) {
      seededRef.current = null;
      handleFirestoreError(err, OperationType.WRITE, `chats/saved_${userId}`);
    }
  };

  // Real-time listen to chats + discreet/normal incoming message notifications
  useEffect(() => {
    if (!currentUser) {
      setRawChats([]);
      setActiveChatId(null);
      setMessages([]);
      setSearchQuery('');
      setReplyingToState(null);
      setEditingMessageState(null);
      setIsSelectionMode(false);
      setSelectedMessageIds([]);
      setForwardingMessages(null);
      setPreviewChat(null);
      setChatTypingMap({});
      invitePreviewCacheRef.current.clear();
      cachedChatMessagesRef.current.clear();
      prevChatMessageTimesRef.current.clear();
      chatsSnapshotInitializedRef.current = false;
      setLoadingChats(false);
      seededRef.current = null;
      return;
    }

    setLoadingChats(true);
    const chatsQuery = query(
      collection(db, 'chats'),
      where('memberIds', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      chatsQuery,
      async (snapshot) => {
        const loadedChats: Chat[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Chat;
          const myUnread = data.unreadCounts?.[currentUser.uid] || 0;
          loadedChats.push({
            ...data,
            id: docSnap.id,
            unreadCount: myUnread,
          });
        });

        // Trigger notifications on newly arriving messages in other chats or background
        if (chatsSnapshotInitializedRef.current) {
          for (const chat of loadedChats) {
            const last = chat.lastMessage;
            if (!last || !last.createdAt) continue;
            const prevAt = prevChatMessageTimesRef.current.get(chat.id);
            if (prevAt !== last.createdAt && last.senderId !== currentUser.uid) {
              const isMuted = mutedIdsSet.has(chat.id);
              const isBlockedSender = blockedIdsSet.has(last.senderId);
              const isSameVisibleChat =
                activeChatIdRef.current === chat.id &&
                typeof document !== 'undefined' &&
                !document.hidden;

              if (!isMuted && !isBlockedSender && !isSameVisibleChat) {
                tgAudio.playReceiveSound();
                const displayInfo = getChatDisplayInfo(chat);
                triggerMessageNotification({
                  title:
                    chat.type === 'direct'
                      ? displayInfo.title
                      : `${displayInfo.title} • ${last.senderName}`,
                  body: last.text || 'رسالة جديدة',
                  discreet: Boolean(userProfile?.discreetNotifications),
                }).catch(() => {});
              }
            }
          }
        }

        const nextTimes = new Map<string, string>();
        loadedChats.forEach((c) => {
          if (c.lastMessage?.createdAt) {
            nextTimes.set(c.id, c.lastMessage.createdAt);
          }
        });
        prevChatMessageTimesRef.current = nextTimes;
        chatsSnapshotInitializedRef.current = true;

        if (loadedChats.length === 0) {
          setRawChats([]);
          setActiveChatId((prev) =>
            prev && previewChatRef.current?.id === prev ? prev : null
          );
          await ensureSavedMessagesChat(
            currentUser.uid,
            userProfile?.displayName || userProfile?.username || 'أنا'
          );
        } else {
          setRawChats(loadedChats);
          setActiveChatId((prev) =>
            prev &&
            (loadedChats.some((c) => c.id === prev) || previewChatRef.current?.id === prev)
              ? prev
              : null
          );
          if (
            previewChatRef.current &&
            loadedChats.some((c) => c.id === previewChatRef.current?.id)
          ) {
            setPreviewChat(null);
          }
        }
        setLoadingChats(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'chats');
        setLoadingChats(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Listen to typing / recording indicators for top chats (powers ChatListItem & ChatHeader)
  const trackedTypingChatIdsKey = useMemo(() => {
    const ids = chats
      .filter((c) => c.type !== 'saved')
      .slice(0, 12)
      .map((c) => c.id);
    if (activeChatId && !activeChatId.startsWith('saved_') && !ids.includes(activeChatId)) {
      ids.unshift(activeChatId);
    }
    return ids.join('|');
  }, [chats, activeChatId]);

  useEffect(() => {
    if (!currentUser || !trackedTypingChatIdsKey) {
      setChatTypingMap({});
      return;
    }

    const ids = trackedTypingChatIdsKey.split('|').filter(Boolean);
    const rawMap = new Map<string, TypingIndicator[]>();
    let cancelled = false;

    const recompute = () => {
      if (cancelled) return;
      const nowMs = Date.now();
      const next: Record<string, ChatTypingSummary> = {};
      rawMap.forEach((typers, chatId) => {
        const active = typers.filter((t) => {
          const ts = new Date(t.updatedAt).getTime();
          return !Number.isNaN(ts) && nowMs - ts < TYPING_STALE_MS;
        });
        if (active.length === 0) return;

        const targetChat = chatsRef.current.find((c) => c.id === chatId);
        const recording = active.some((t) => t.activity === 'recording');
        if (targetChat?.type === 'direct') {
          next[chatId] = {
            activity: recording ? 'recording' : 'typing',
            label: recording ? 'يسجل رسالة صوتية' : 'يكتب الآن',
          };
        } else {
          const names = active.map(
            (t) => usersMap[t.uid]?.displayName || t.displayName || 'مستخدم'
          );
          if (names.length === 1) {
            next[chatId] = {
              activity: recording ? 'recording' : 'typing',
              label: recording ? `${names[0]} يسجل صوتاً` : `${names[0]} يكتب الآن`,
            };
          } else {
            next[chatId] = {
              activity: recording ? 'recording' : 'typing',
              label: `${names.length} أعضاء يتفاعلون الآن`,
            };
          }
        }
      });
      setChatTypingMap(next);
    };

    const unsubs = ids.map((chatId) =>
      onSnapshot(
        collection(db, 'chats', chatId, 'typing'),
        (snap) => {
          const active: TypingIndicator[] = [];
          snap.forEach((docSnap) => {
            const d = docSnap.data() as TypingIndicator;
            if (d.uid !== currentUser.uid && d.isTyping) {
              active.push(d);
            }
          });
          rawMap.set(chatId, active);
          recompute();
        },
        () => {}
      )
    );

    const expireTimer = setInterval(recompute, 1500);
    return () => {
      cancelled = true;
      clearInterval(expireTimer);
      unsubs.forEach((u) => u());
    };
  }, [currentUser, trackedTypingChatIdsKey, usersMap]);

  // Real-time listen to cloud stories
  useEffect(() => {
    if (!currentUser) {
      setStories([]);
      return;
    }

    const q = query(collection(db, 'stories'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Story[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as Story), id: docSnap.id });
        });
        setStories(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'stories');
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Real-time listen to personal & recent stickers in Firestore
  useEffect(() => {
    if (!currentUser) {
      setUserStickers([]);
      return;
    }

    const stickersPath = `users/${currentUser.uid}/stickers`;
    const q = query(
      collection(db, 'users', currentUser.uid, 'stickers'),
      orderBy('lastUsedAt', 'desc'),
      limit(60)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: UserStickerDoc[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as UserStickerDoc), id: docSnap.id });
        });
        setUserStickers(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, stickersPath);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Real-time listener for currently previewed (unjoined) group or channel
  const previewChatId = previewChat?.id || null;
  useEffect(() => {
    if (!currentUser || !previewChatId) return;
    const chatRef = doc(db, 'chats', previewChatId);
    const unsubscribe = onSnapshot(
      chatRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          setPreviewChat(null);
          return;
        }
        const updated = { ...(docSnap.data() as Chat), id: docSnap.id };
        setPreviewChat(updated);
      },
      () => {}
    );
    return () => unsubscribe();
  }, [currentUser, previewChatId]);

  // Clear previewChat when navigating away from it
  useEffect(() => {
    if (previewChat && activeChatId !== previewChat.id) {
      setPreviewChat(null);
    }
  }, [activeChatId, previewChat]);

  // Handle ?join=INVITE_CODE or ?channel=ID or ?group=ID URL parameter automatically after login
  useEffect(() => {
    if (!currentUser) return;
    const params = new URLSearchParams(window.location.search);
    const joinParam =
      params.get('join') || params.get('channel') || params.get('group') || params.get('chat');
    if (joinParam) {
      const paramKey = params.has('join')
        ? 'join'
        : params.has('channel')
        ? 'channel'
        : params.has('group')
        ? 'group'
        : 'chat';
      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({}, document.title, cleanUrl);

      openInviteLink(`?${paramKey}=${joinParam}`).catch((err: unknown) => {
        setPendingInviteStatus({
          message: err instanceof Error ? err.message : 'رابط الدعوة غير صالح أو منتهي',
          type: 'error',
        });
      });
    }
  }, [currentUser]);

  const canListenActiveChatMessages = Boolean(
    currentUser &&
      activeChat &&
      (activeChat.id === `saved_${currentUser.uid}` ||
        activeChat.type === 'saved' ||
        activeChat.type === 'channel' ||
        activeChat.createdBy === currentUser.uid ||
        (Array.isArray(activeChat.memberIds) && activeChat.memberIds.includes(currentUser.uid)))
  );

  // Reset per-chat UI & pagination when switching active chat
  useEffect(() => {
    setIsSelectionMode(false);
    setSelectedMessageIds([]);
    setForwardingMessages(null);
    setShowInfoDrawer(false);
    setReplyingToState(null);
    setEditingMessageState(null);
    setMessageLimit(DEFAULT_MESSAGE_PAGE_SIZE);
    setHasMoreMessages(false);
    setIsLoadingOlderMessages(false);
    setFirstUnreadMessageId(null);
    firstUnreadComputedForChatRef.current = null;
  }, [activeChatId]);

  // Real-time paginated listen to messages of active chat + Read Receipts marking
  useEffect(() => {
    if (!currentUser || !activeChatId || !canListenActiveChatMessages) {
      setMessages([]);
      setLoadingMessages(false);
      setIsLoadingOlderMessages(false);
      setHasMoreMessages(false);
      return;
    }

    let cancelled = false;
    const chatId = activeChatId;
    if (messageLimit === DEFAULT_MESSAGE_PAGE_SIZE) {
      setLoadingMessages(true);
    }

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(messageLimit));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        if (cancelled) return;
        const descMsgs: Message[] = [];
        const unreadMessageIds: string[] = [];

        snapshot.forEach((docSnap) => {
          const msgData = docSnap.data() as Omit<Message, 'id'>;
          if (Array.isArray(msgData.deletedFor) && msgData.deletedFor.includes(currentUser.uid)) {
            return;
          }
          const msg: Message = {
            id: docSnap.id,
            ...msgData,
          };
          descMsgs.push(msg);

          if (
            msg.senderId !== currentUser.uid &&
            !(msg.readBy || []).includes(currentUser.uid)
          ) {
            unreadMessageIds.push(docSnap.id);
          }
        });

        const loadedMsgs = descMsgs.reverse();
        setHasMoreMessages(snapshot.docs.length >= messageLimit);
        setMessages(loadedMsgs);
        setLoadingMessages(false);
        setIsLoadingOlderMessages(false);

        if (firstUnreadComputedForChatRef.current !== chatId) {
          firstUnreadComputedForChatRef.current = chatId;
          const firstUnread = loadedMsgs.find(
            (m) =>
              m.senderId !== currentUser.uid &&
              !(m.readBy || []).includes(currentUser.uid) &&
              !m.isDeleted
          );
          setFirstUnreadMessageId(firstUnread?.id || null);
        }

        const activeChatSummary =
          chatsRef.current.find((c) => c.id === chatId) ||
          (previewChatRef.current?.id === chatId ? previewChatRef.current : undefined);
        const isCurrentMember = Boolean(
          chatId === `saved_${currentUser.uid}` ||
            activeChatSummary?.memberIds?.includes(currentUser.uid)
        );

        cachedChatMessagesRef.current.set(chatId, {
          updatedAt: activeChatSummary?.updatedAt || '',
          items: [...descMsgs],
        });

        // Real read receipt persistence to Firestore
        if (isCurrentMember && unreadMessageIds.length > 0) {
          try {
            const batch = writeBatch(db);
            unreadMessageIds.forEach((msgId) => {
              const mRef = doc(db, 'chats', chatId, 'messages', msgId);
              batch.update(mRef, { readBy: arrayUnion(currentUser.uid) });
            });
            await batch.commit();
          } catch (err) {
            console.warn('Could not mark some messages read:', err);
          }
        }

        const currentChat = chatsRef.current.find((c) => c.id === chatId);
        const hasUnreadBadge = (currentChat?.unreadCounts?.[currentUser.uid] || 0) > 0;
        const lastReadByMissing =
          isCurrentMember &&
          currentChat?.lastMessage &&
          currentChat.lastMessage.senderId !== currentUser.uid &&
          !(currentChat.lastMessage.readBy || []).includes(currentUser.uid);

        if (isCurrentMember && (hasUnreadBadge || lastReadByMissing)) {
          updateDoc(doc(db, 'chats', chatId), {
            [`unreadCounts.${currentUser.uid}`]: 0,
            'lastMessage.readBy': arrayUnion(currentUser.uid),
          }).catch(() => {});
        }
      },
      async (error) => {
        const fbCode = (error as { code?: string })?.code;
        if (fbCode === 'permission-denied') {
          const accessible = await isChatAccessibleOnServer(chatId, currentUser.uid);
          if (!accessible) {
            if (!cancelled) {
              setRawChats((prev) => prev.filter((c) => c.id !== chatId));
              setActiveChatId((prev) => (prev === chatId ? null : prev));
              setMessages([]);
              setLoadingMessages(false);
              setIsLoadingOlderMessages(false);
            }
            return;
          }
        }
        handleFirestoreError(error, OperationType.GET, `chats/${chatId}/messages`);
        setLoadingMessages(false);
        setIsLoadingOlderMessages(false);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [currentUser, activeChatId, canListenActiveChatMessages, messageLimit]);

  // Real-time search across message content of all user chats (cached + Firestore)
  useEffect(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!currentUser || !trimmed) {
      setMessageSearchMatches({});
      setIsSearchingMessages(false);
      return;
    }

    const findMatchInMessages = (items: Message[], term: string): Message | undefined => {
      return items.find((m) => {
        if (m.isDeleted) return false;
        if (Array.isArray(m.deletedFor) && m.deletedFor.includes(currentUser.uid)) return false;
        const text = (m.text || '').toLowerCase();
        const mediaName = (m.mediaName || '').toLowerCase();
        const pollQ = (m.pollData?.question || '').toLowerCase();
        return text.includes(term) || mediaName.includes(term) || pollQ.includes(term);
      });
    };

    const computeMatchesFromCache = (): Record<string, Message> => {
      const next: Record<string, Message> = {};
      chatsRef.current.forEach((chat) => {
        const cached = cachedChatMessagesRef.current.get(chat.id);
        if (cached) {
          const hit = findMatchInMessages(cached.items, trimmed);
          if (hit) next[chat.id] = hit;
        }
      });
      return next;
    };

    setMessageSearchMatches(computeMatchesFromCache());

    let cancelled = false;
    const chatsNeedingFetch = chats.filter((chat) => {
      const cached = cachedChatMessagesRef.current.get(chat.id);
      return !cached || cached.updatedAt !== (chat.updatedAt || '');
    });

    if (chatsNeedingFetch.length === 0) {
      setIsSearchingMessages(false);
      return;
    }

    setIsSearchingMessages(true);
    const timer = setTimeout(async () => {
      try {
        await Promise.all(
          chatsNeedingFetch.map(async (chat) => {
            try {
              const q = query(
                collection(db, 'chats', chat.id, 'messages'),
                orderBy('createdAt', 'desc'),
                limit(100)
              );
              const snap = await getDocs(q);
              const loaded: Message[] = [];
              snap.forEach((docSnap) => {
                loaded.push({ id: docSnap.id, ...(docSnap.data() as Omit<Message, 'id'>) });
              });
              cachedChatMessagesRef.current.set(chat.id, {
                updatedAt: chat.updatedAt || '',
                items: loaded,
              });
            } catch (err) {
              const fbCode = (err as { code?: string })?.code;
              if (fbCode === 'permission-denied') {
                const accessible = await isChatAccessibleOnServer(chat.id, currentUser.uid);
                if (!accessible) {
                  if (!cancelled) {
                    setRawChats((prev) => prev.filter((c) => c.id !== chat.id));
                  }
                  return;
                }
              }
              handleFirestoreError(err, OperationType.LIST, `chats/${chat.id}/messages`);
            }
          })
        );
        if (!cancelled) {
          setMessageSearchMatches(computeMatchesFromCache());
        }
      } finally {
        if (!cancelled) {
          setIsSearchingMessages(false);
        }
      }
    }, 160);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, chats, currentUser]);

  // Start or open existing 1-on-1 Direct Chat
  const startDirectChat = async (targetUser: UserProfile): Promise<string> => {
    if (!currentUser) throw new Error('غير مسجل');
    const dmId = `dm_${[currentUser.uid, targetUser.uid].sort().join('_')}`;

    const existingLocal = chats.find((c) => c.id === dmId);
    if (existingLocal) {
      setActiveChatId(dmId);
      return dmId;
    }

    const dmRef = doc(db, 'chats', dmId);
    try {
      const snap = await getDoc(dmRef);
      if (!snap.exists()) {
        const now = new Date().toISOString();
        const newChat: Chat = {
          id: dmId,
          type: 'direct',
          title: targetUser.displayName || targetUser.username,
          photoURL: targetUser.photoURL || '',
          avatarColor: '#2481cc',
          description: targetUser.bio || '',
          createdBy: currentUser.uid,
          createdAt: now,
          updatedAt: now,
          memberIds: [currentUser.uid, targetUser.uid],
          membersCount: 2,
          unreadCounts: { [currentUser.uid]: 0, [targetUser.uid]: 0 },
          lastMessage: {
            text: 'تم بدء المحادثة الخاصة',
            senderId: currentUser.uid,
            senderName: userProfile?.displayName || 'مستخدم',
            createdAt: now,
            type: 'text',
            readBy: [currentUser.uid],
          },
        };
        await setDoc(dmRef, newChat);
      }
      setActiveChatId(dmId);
      return dmId;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${dmId}`);
      throw error;
    }
  };

  // Create Group with selected members & generate shareable invite link
  const createGroup = async (data: {
    title: string;
    description?: string;
    photoURL?: string;
    memberIds: string[];
  }): Promise<string> => {
    if (!currentUser) throw new Error('غير مسجل');

    const chatDocRef = doc(collection(db, 'chats'));
    const inviteCode = generateInviteCode();
    const uniqueMembers = Array.from(new Set([currentUser.uid, ...data.memberIds]));
    const now = new Date().toISOString();

    const unreadCounts: Record<string, number> = {};
    uniqueMembers.forEach((uid) => {
      unreadCounts[uid] = uid === currentUser.uid ? 0 : 1;
    });

    const newGroup: Chat = {
      id: chatDocRef.id,
      type: 'group',
      title: data.title.trim(),
      description: data.description?.trim() || 'مجموعة جديدة في JanaX',
      photoURL: data.photoURL?.trim() || '',
      avatarColor: '#41a76c',
      inviteCode,
      createdBy: currentUser.uid,
      createdAt: now,
      updatedAt: now,
      memberIds: uniqueMembers,
      adminIds: [currentUser.uid],
      bannedIds: [],
      membersCount: uniqueMembers.length,
      unreadCounts,
      lastMessage: {
        text: `👥 أنشأ ${userProfile?.displayName || 'مستخدم'} المجموعة`,
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || 'مستخدم',
        createdAt: now,
        type: 'text',
        readBy: [currentUser.uid],
      },
    };

    try {
      const batch = writeBatch(db);
      batch.set(chatDocRef, newGroup);

      const inviteDoc: GroupInvite = {
        inviteCode,
        chatId: chatDocRef.id,
        chatType: 'group',
        title: newGroup.title,
        description: newGroup.description,
        photoURL: newGroup.photoURL,
        createdBy: currentUser.uid,
        createdAt: now,
      };
      batch.set(doc(db, 'groupInvites', inviteCode), inviteDoc);

      const welcomeMsgRef = doc(collection(db, 'chats', chatDocRef.id, 'messages'));
      batch.set(welcomeMsgRef, {
        chatId: chatDocRef.id,
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || 'مستخدم',
        text: `👥 تم إنشاء مجموعة "${newGroup.title}" وإضافة ${uniqueMembers.length} أعضاء.`,
        type: 'text',
        readBy: [currentUser.uid],
        createdAt: now,
      });

      await batch.commit();
      setActiveChatId(chatDocRef.id);
      return chatDocRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
      throw error;
    }
  };

  // Add members directly to an existing group
  const addMembersToGroup = async (chatId: string, newMemberIds: string[]) => {
    if (!currentUser || newMemberIds.length === 0) return;
    try {
      const targetChat = chats.find((c) => c.id === chatId);
      const merged = Array.from(new Set([...(targetChat?.memberIds || []), ...newMemberIds]));
      const nextBanned = (targetChat?.bannedIds || []).filter(
        (id) => !newMemberIds.includes(id)
      );

      await updateDoc(doc(db, 'chats', chatId), {
        memberIds: arrayUnion(...newMemberIds),
        bannedIds: nextBanned,
        membersCount: merged.length,
        updatedAt: new Date().toISOString(),
      });

      const addedNames = newMemberIds
        .map((id) => usersMap[id]?.displayName || usersMap[id]?.username || 'عضو')
        .join('، ');

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || 'مستخدم',
        text: `➕ قام ${userProfile?.displayName || 'عضو'} بإضافة: ${addedNames}`,
        type: 'text',
        readBy: [currentUser.uid],
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}`);
    }
  };

  // ==================== GROUP & CHANNEL MODERATION ====================

  const updateGroupOrChannelInfo = async (
    chatId: string,
    data: { title: string; description?: string; photoURL?: string }
  ) => {
    if (!currentUser) return;
    const cleanTitle = data.title.trim().slice(0, 100);
    if (!cleanTitle) throw new Error('يرجى إدخال الاسم');
    const cleanDesc = (data.description || '').trim().slice(0, 500);
    const cleanPhoto = (data.photoURL || '').trim();
    const targetChat = chatsRef.current.find((c) => c.id === chatId);

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'chats', chatId), {
        title: cleanTitle,
        description: cleanDesc,
        photoURL: cleanPhoto,
        updatedAt: new Date().toISOString(),
      });
      if (targetChat?.inviteCode) {
        batch.update(doc(db, 'groupInvites', targetChat.inviteCode), {
          title: cleanTitle,
          description: cleanDesc,
          photoURL: cleanPhoto,
        });
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}`);
      throw error;
    }
  };

  const promoteChatAdmin = async (chatId: string, targetUid: string) => {
    if (!currentUser || !targetUid) return;
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        adminIds: arrayUnion(targetUid),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}`);
    }
  };

  const demoteChatAdmin = async (chatId: string, targetUid: string) => {
    if (!currentUser || !targetUid) return;
    const targetChat = chatsRef.current.find((c) => c.id === chatId);
    if (!targetChat || targetUid === targetChat.createdBy) return;
    const nextAdmins = (targetChat.adminIds || []).filter((id) => id !== targetUid);
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        adminIds: nextAdmins,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}`);
    }
  };

  const kickMemberFromChat = async (chatId: string, targetUid: string, ban = false) => {
    if (!currentUser || !targetUid) return;
    const targetChat = chatsRef.current.find((c) => c.id === chatId);
    if (!targetChat || targetUid === targetChat.createdBy) return;

    const nextMembers = (targetChat.memberIds || []).filter((id) => id !== targetUid);
    const nextAdmins = (targetChat.adminIds || []).filter((id) => id !== targetUid);
    const nextBanned = ban
      ? Array.from(new Set([...(targetChat.bannedIds || []), targetUid]))
      : targetChat.bannedIds || [];

    try {
      await updateDoc(doc(db, 'chats', chatId), {
        memberIds: nextMembers,
        adminIds: nextAdmins,
        bannedIds: nextBanned,
        membersCount: nextMembers.length,
        updatedAt: new Date().toISOString(),
      });

      if (targetChat.type === 'group') {
        const targetName = usersMap[targetUid]?.displayName || usersMap[targetUid]?.username || 'عضو';
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          chatId,
          senderId: currentUser.uid,
          senderName: userProfile?.displayName || 'مشرف',
          text: ban ? `🚫 تم حظر وإزالة ${targetName}` : `👋 تم إخراج ${targetName} من المجموعة`,
          type: 'text',
          readBy: [currentUser.uid],
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}`);
    }
  };

  const unbanMemberFromChat = async (chatId: string, targetUid: string) => {
    if (!currentUser || !targetUid) return;
    const targetChat = chatsRef.current.find((c) => c.id === chatId);
    if (!targetChat) return;
    const nextBanned = (targetChat.bannedIds || []).filter((id) => id !== targetUid);
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        bannedIds: nextBanned,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}`);
    }
  };

  const regenerateInviteLink = async (chatId: string): Promise<string> => {
    if (!currentUser) throw new Error('غير مسجل');
    const targetChat = chatsRef.current.find((c) => c.id === chatId);
    if (!targetChat) throw new Error('المحادثة غير موجودة');

    const newCode = generateInviteCode();
    const now = new Date().toISOString();
    const batch = writeBatch(db);

    if (targetChat.inviteCode) {
      batch.delete(doc(db, 'groupInvites', targetChat.inviteCode));
    }
    batch.update(doc(db, 'chats', chatId), {
      inviteCode: newCode,
      updatedAt: now,
    });
    const inviteDoc: GroupInvite = {
      inviteCode: newCode,
      chatId,
      chatType: targetChat.type === 'channel' ? 'channel' : 'group',
      title: targetChat.title,
      description: targetChat.description || '',
      photoURL: targetChat.photoURL || '',
      createdBy: currentUser.uid,
      createdAt: now,
    };
    batch.set(doc(db, 'groupInvites', newCode), inviteDoc);
    await batch.commit();

    return buildChatInviteLink({ ...targetChat, inviteCode: newCode });
  };

  const leaveChat = async (chatId: string) => {
    if (!currentUser) return;
    const targetChat = chatsRef.current.find((c) => c.id === chatId);
    if (!targetChat || targetChat.type === 'saved' || targetChat.type === 'direct') return;

    const nextMembers = (targetChat.memberIds || []).filter((id) => id !== currentUser.uid);
    const isMod =
      isAdmin ||
      targetChat.createdBy === currentUser.uid ||
      (targetChat.adminIds || []).includes(currentUser.uid);

    try {
      if (isMod) {
        const nextAdmins = (targetChat.adminIds || []).filter((id) => id !== currentUser.uid);
        await updateDoc(doc(db, 'chats', chatId), {
          memberIds: nextMembers,
          adminIds: nextAdmins,
          membersCount: nextMembers.length,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await updateDoc(doc(db, 'chats', chatId), {
          memberIds: nextMembers,
          membersCount: nextMembers.length,
          updatedAt: new Date().toISOString(),
        });
      }

      if (activeChatIdRef.current === chatId) {
        setActiveChatId(null);
      }
      setShowInfoDrawer(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}`);
    }
  };

  // Resolve Group or Channel metadata from invite link, invite code, or direct link
  const lookupChatByInviteTarget = async (codeOrLink: string): Promise<Chat | null> => {
    if (!currentUser) return null;
    const target = parseInviteTarget(codeOrLink);
    if (!target) return null;

    if (target.inviteCode) {
      const localByCode = chatsRef.current.find(
        (c) => c.inviteCode?.toUpperCase() === target.inviteCode
      );
      if (localByCode) return localByCode;

      const inviteSnap = await getDoc(doc(db, 'groupInvites', target.inviteCode));
      if (inviteSnap.exists()) {
        const invite = inviteSnap.data() as GroupInvite;
        const chatSnap = await getDoc(doc(db, 'chats', invite.chatId));
        if (chatSnap.exists()) {
          return { ...(chatSnap.data() as Chat), id: chatSnap.id };
        }
      }
    }

    if (target.chatId) {
      const localById = chatsRef.current.find((c) => c.id === target.chatId);
      if (localById) return localById;

      const chatSnap = await getDoc(doc(db, 'chats', target.chatId));
      if (chatSnap.exists()) {
        return { ...(chatSnap.data() as Chat), id: chatSnap.id };
      }
    }

    return null;
  };

  const resolveInvitePreview = useCallback(
    async (codeOrLink: string): Promise<Chat | null> => {
      if (!currentUser) return null;
      const key = codeOrLink.trim();
      if (!key) return null;

      const target = parseInviteTarget(key);
      if (!target) return null;

      if (target.inviteCode) {
        const localByCode = chatsRef.current.find(
          (c) => c.inviteCode?.toUpperCase() === target.inviteCode
        );
        if (localByCode) return localByCode;
      }
      if (target.chatId) {
        const localById = chatsRef.current.find((c) => c.id === target.chatId);
        if (localById) return localById;
      }

      const cacheKey = target.inviteCode || target.chatId || key;
      const cached = invitePreviewCacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.ts < 60_000) {
        return cached.chat;
      }

      try {
        const resolved = await lookupChatByInviteTarget(key);
        invitePreviewCacheRef.current.set(cacheKey, { chat: resolved, ts: Date.now() });
        return resolved;
      } catch {
        return null;
      }
    },
    [currentUser]
  );

  const openInviteLink = async (codeOrLink: string): Promise<Chat> => {
    if (!currentUser) throw new Error('يجب تسجيل الدخول أولاً');
    const target = parseInviteTarget(codeOrLink);
    if (!target) {
      throw new Error('رابط المجموعة أو القناة غير صالح');
    }

    const chatData = await lookupChatByInviteTarget(codeOrLink);
    if (!chatData) {
      throw new Error('لم يتم العثور على المجموعة أو القناة المطلوبة');
    }

    const cacheKey = target.inviteCode || target.chatId || chatData.id;
    invitePreviewCacheRef.current.set(cacheKey, { chat: chatData, ts: Date.now() });

    if (Array.isArray(chatData.memberIds) && chatData.memberIds.includes(currentUser.uid)) {
      setPreviewChat(null);
      setActiveChatId(chatData.id);
    } else {
      setPreviewChat(chatData);
      setActiveChatId(chatData.id);
    }

    return chatData;
  };

  const joinChat = async (chatId: string): Promise<Chat> => {
    if (!currentUser) throw new Error('يجب تسجيل الدخول أولاً');

    const chatRef = doc(db, 'chats', chatId);
    try {
      const chatSnap = await getDoc(chatRef);
      if (!chatSnap.exists()) {
        throw new Error('المجموعة أو القناة لم تعد موجودة');
      }

      const chatData = { ...(chatSnap.data() as Chat), id: chatSnap.id };
      if (Array.isArray(chatData.bannedIds) && chatData.bannedIds.includes(currentUser.uid)) {
        throw new Error('تم حظرك من الانضمام إلى هذه المحادثة');
      }

      const alreadyMember =
        Array.isArray(chatData.memberIds) && chatData.memberIds.includes(currentUser.uid);

      let finalChat = chatData;
      if (!alreadyMember) {
        const nextMembers = Array.from(new Set([...(chatData.memberIds || []), currentUser.uid]));
        const now = new Date().toISOString();
        await updateDoc(chatRef, {
          memberIds: arrayUnion(currentUser.uid),
          membersCount: nextMembers.length,
          updatedAt: now,
        });

        if (chatData.type === 'group') {
          await addDoc(collection(db, 'chats', chatId, 'messages'), {
            chatId,
            senderId: currentUser.uid,
            senderName: userProfile?.displayName || 'مستخدم',
            text: `🔗 انضم ${userProfile?.displayName || userProfile?.username} عبر رابط الدعوة`,
            type: 'text',
            readBy: [currentUser.uid],
            createdAt: now,
          });
        }

        finalChat = {
          ...chatData,
          memberIds: nextMembers,
          membersCount: nextMembers.length,
          updatedAt: now,
        };
      }

      if (finalChat.inviteCode) {
        invitePreviewCacheRef.current.set(finalChat.inviteCode.toUpperCase(), {
          chat: finalChat,
          ts: Date.now(),
        });
      }
      invitePreviewCacheRef.current.set(chatId, { chat: finalChat, ts: Date.now() });

      setPreviewChat(finalChat);
      setActiveChatId(chatId);
      tgAudio.playPopSound();

      setPendingInviteStatus({
        message:
          finalChat.type === 'channel'
            ? `تم اشتراكك في قناة "${finalChat.title}" بنجاح`
            : `تم انضمامك إلى مجموعة "${finalChat.title}" بنجاح`,
        type: 'success',
      });

      return finalChat;
    } catch (error) {
      if (
        error instanceof Error &&
        !error.message.includes('Missing or insufficient permissions')
      ) {
        throw error;
      }
      handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}`);
      throw error;
    }
  };

  const joinGroupByInvite = async (codeOrLink: string): Promise<Chat> => {
    if (!currentUser) throw new Error('يجب تسجيل الدخول أولاً');
    const target = parseInviteTarget(codeOrLink);
    if (!target) throw new Error('الرجاء إدخال رابط أو رمز دعوة صحيح');

    const chatData = await lookupChatByInviteTarget(codeOrLink);
    if (!chatData) {
      throw new Error('رابط الدعوة غير موجود أو غير صحيح');
    }

    return joinChat(chatData.id);
  };

  const ensureChatInviteLink = async (chatId: string): Promise<string> => {
    if (!currentUser) throw new Error('يجب تسجيل الدخول أولاً');
    const localChat =
      chatsRef.current.find((c) => c.id === chatId) ||
      (previewChatRef.current?.id === chatId ? previewChatRef.current : null);

    let targetChat = localChat;
    if (!targetChat) {
      const snap = await getDoc(doc(db, 'chats', chatId));
      if (!snap.exists()) throw new Error('المحادثة غير موجودة');
      targetChat = { ...(snap.data() as Chat), id: snap.id };
    }

    if (targetChat.inviteCode) {
      return buildChatInviteLink(targetChat);
    }

    const canManage =
      targetChat.createdBy === currentUser.uid ||
      isAdmin ||
      (targetChat.adminIds || []).includes(currentUser.uid);

    if ((targetChat.type === 'group' || targetChat.type === 'channel') && canManage) {
      const newCode = generateInviteCode();
      const now = new Date().toISOString();
      const batch = writeBatch(db);
      batch.update(doc(db, 'chats', chatId), { inviteCode: newCode });
      const inviteDoc: GroupInvite = {
        inviteCode: newCode,
        chatId,
        chatType: targetChat.type,
        title: targetChat.title,
        description: targetChat.description || '',
        photoURL: targetChat.photoURL || '',
        createdBy: currentUser.uid,
        createdAt: now,
      };
      batch.set(doc(db, 'groupInvites', newCode), inviteDoc);
      await batch.commit();
      return buildChatInviteLink({ ...targetChat, inviteCode: newCode });
    }

    return buildChatInviteLink(targetChat);
  };

  // Update real-time typing or recording status in Firestore
  const updateTypingStatus = async (
    isTyping: boolean,
    targetChatId?: string,
    activity: 'typing' | 'recording' = 'typing'
  ) => {
    const chatId = targetChatId || activeChatId;
    if (!currentUser || !chatId) return;
    const targetChat = chatsRef.current.find((c) => c.id === chatId);
    if (chatId.startsWith('saved_') || targetChat?.type === 'saved') return;

    const typingRef = doc(db, 'chats', chatId, 'typing', currentUser.uid);
    try {
      const displayName = (userProfile?.displayName || userProfile?.username || 'مستخدم').slice(0, 100);
      await setDoc(typingRef, {
        uid: currentUser.uid,
        displayName,
        isTyping,
        activity,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}/typing/${currentUser.uid}`);
    }
  };

  // Send message (with automatic link preview extraction & channel admin enforcement)
  const sendMessage = async (
    text: string,
    type: MessageType = 'text',
    extra: Partial<Message> = {},
    targetChatIdOverride?: string
  ) => {
    const targetChatId = targetChatIdOverride || activeChatId;
    const targetChat = targetChatId
      ? chatsRef.current.find((c) => c.id === targetChatId) ||
        (activeChat?.id === targetChatId ? activeChat : null)
      : activeChat;

    if (!currentUser || !targetChatId || !targetChat) return;
    if (!text.trim() && type === 'text') return;
    if (isChatBlockedByMe(targetChat)) {
      throw new Error('قم بإلغاء حظر المستخدم أولاً لتتمكن من إرسال الرسائل');
    }
    if (targetChat.type === 'channel') {
      const isMod =
        isAdmin ||
        targetChat.createdBy === currentUser.uid ||
        (targetChat.adminIds || []).includes(currentUser.uid);
      if (!isMod) {
        throw new Error('النشر في هذه القناة مقتصر على المشرفين فقط');
      }
    }

    try {
      const chatDocRef = doc(db, 'chats', targetChatId);
      const messagesRef = collection(db, 'chats', targetChatId, 'messages');
      const now = new Date().toISOString();
      const trimmedText = text.trim();

      const autoLinkPreview =
        type === 'text' && !extra.isSpoiler && !extra.linkPreview
          ? extractRichLinkPreview(trimmedText)
          : null;

      const newMsgData: Omit<Message, 'id'> = {
        chatId: targetChatId,
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || userProfile?.username || 'مستخدم',
        senderPhoto: userProfile?.photoURL || '',
        senderColor: userProfile?.avatarColor || '#2481cc',
        text: trimmedText,
        type,
        readBy: [currentUser.uid],
        createdAt: now,
        ...(autoLinkPreview ? { linkPreview: autoLinkPreview } : {}),
        ...(replyingTo && !targetChatIdOverride
          ? {
              replyToId: replyingTo.id,
              replyToText: getMessageReplyPreview(replyingTo).slice(0, 120),
              replyToSender:
                usersMap[replyingTo.senderId]?.displayName || replyingTo.senderName,
            }
          : {}),
        ...extra,
      };

      const createdMsgRef = await addDoc(messagesRef, newMsgData);
      tgAudio.playSendSound();
      if (!targetChatIdOverride) {
        setReplyingTo(null);
      }
      updateTypingStatus(false, targetChatId).catch(() => {});

      if (autoLinkPreview) {
        enrichMessageLinkPreview(trimmedText)
          .then((richPreview) => {
            if (!richPreview) return;
            return updateDoc(createdMsgRef, { linkPreview: richPreview });
          })
          .catch(() => {});
      }

      const unreadUpdates: Record<string, unknown> = {};
      (targetChat.memberIds || []).forEach((uid) => {
        if (uid !== currentUser.uid) {
          unreadUpdates[`unreadCounts.${uid}`] = increment(1);
        } else {
          unreadUpdates[`unreadCounts.${uid}`] = 0;
        }
      });

      await updateDoc(chatDocRef, {
        updatedAt: now,
        lastMessage: {
          text:
            type === 'image'
              ? '📷 صورة'
              : type === 'video'
              ? '🎬 فيديو'
              : type === 'voice'
              ? '🎤 رسالة صوتية'
              : type === 'poll'
              ? '📊 استطلاع رأي'
              : type === 'dice'
              ? '🎲 رمية نرد'
              : type === 'file'
              ? `📎 ${extra.mediaName || 'ملف'}`
              : type === 'sticker'
              ? extra.mediaName
                ? `🎨 ملصق: ${extra.mediaName}`
                : '🎨 ملصق'
              : trimmedText,
          senderId: currentUser.uid,
          senderName: userProfile?.displayName || 'مستخدم',
          createdAt: now,
          type,
          readBy: [currentUser.uid],
        },
        ...unreadUpdates,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `chats/${targetChatId}/messages`);
    }
  };

  // Send Video message using Firebase Storage with progress tracking
  const sendVideoMessage = async (
    file: File,
    caption = '',
    onProgress?: (percent: number) => void
  ) => {
    if (!currentUser || !activeChatId || !activeChat) return;
    if (file.size > 25 * 1024 * 1024) {
      throw new Error('حجم الفيديو يتجاوز الحد الأقصى المسموح به (25 ميجابايت)');
    }
    const res = await uploadMediaWithFallback(
      file,
      `chats/${activeChatId}/videos`,
      file.name || 'video.mp4',
      { onProgress }
    );
    await sendMessage(caption.trim() || '🎬 فيديو', 'video', {
      mediaUrl: res.url,
      mediaName: file.name,
      mediaSize: formatBytes(file.size),
    });
  };

  // Delete single or multiple messages ("for me" or "for everyone")
  const deleteMessages = async (messageIds: string[], mode: 'me' | 'everyone') => {
    if (!currentUser || !activeChatId || messageIds.length === 0) return;

    const targetIdSet = new Set(messageIds);
    const targetMsgs = messages.filter((m) => targetIdSet.has(m.id));
    if (targetMsgs.length === 0) return;

    try {
      const batch = writeBatch(db);
      let updatedCount = 0;

      for (const msg of targetMsgs) {
        const msgRef = doc(db, 'chats', activeChatId, 'messages', msg.id);
        if (mode === 'me') {
          batch.update(msgRef, {
            deletedFor: arrayUnion(currentUser.uid),
          });
          updatedCount++;
        } else {
          const canDeleteForAll = msg.senderId === currentUser.uid || isActiveChatModerator;
          if (!canDeleteForAll) continue;
          batch.update(msgRef, {
            isDeleted: true,
            text: 'تم حذف هذه الرسالة',
            mediaUrl: '',
            mediaName: '',
            mediaSize: '',
            isPinned: false,
            linkPreview: deleteField(),
          });
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        await batch.commit();

        if (mode === 'everyone') {
          const latestMsg = messages[messages.length - 1];
          if (latestMsg && targetIdSet.has(latestMsg.id)) {
            await updateDoc(doc(db, 'chats', activeChatId), {
              'lastMessage.text': '🚫 تم حذف رسالة',
            }).catch(() => {});
          }
        }
      }

      clearSelection();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${activeChatId}/messages`);
    }
  };

  // Ensure Saved Messages cloud space exists & return its chatId + memberIds
  const ensureSavedChatForForward = async (): Promise<{ chatId: string; memberIds: string[] }> => {
    if (!currentUser) throw new Error('غير مسجل');
    const savedChatId = `saved_${currentUser.uid}`;
    const existing = chatsRef.current.find((c) => c.id === savedChatId);
    if (existing) {
      return { chatId: savedChatId, memberIds: existing.memberIds || [currentUser.uid] };
    }
    const savedRef = doc(db, 'chats', savedChatId);
    const snap = await getDoc(savedRef);
    if (snap.exists()) {
      const data = snap.data() as Chat;
      return { chatId: savedChatId, memberIds: data.memberIds || [currentUser.uid] };
    }
    const now = new Date().toISOString();
    const myName = userProfile?.displayName || userProfile?.username || 'أنا';
    await setDoc(savedRef, {
      id: savedChatId,
      type: 'saved',
      title: 'الرسائل المحفوظة',
      avatarColor: '#2481cc',
      description: 'مساحتك السحابية الخاصة لحفظ الملاحظات والصور والروابط والملفات.',
      createdBy: currentUser.uid,
      createdAt: now,
      updatedAt: now,
      memberIds: [currentUser.uid],
      membersCount: 1,
      isPinned: true,
      unreadCounts: { [currentUser.uid]: 0 },
      lastMessage: {
        text: 'أهلاً بك في سحابة JanaX للرسائل المحفوظة!',
        senderId: currentUser.uid,
        senderName: myName,
        createdAt: now,
        type: 'text',
        readBy: [currentUser.uid],
      },
    });
    return { chatId: savedChatId, memberIds: [currentUser.uid] };
  };

  // Forward one or multiple messages
  const forwardMessages = async (
    msgs: Message[],
    targets: { chatId?: string; user?: UserProfile; isSaved?: boolean }[],
    optionalComment?: string
  ): Promise<{ targetChatIds: string[]; count: number }> => {
    if (!currentUser || msgs.length === 0 || targets.length === 0) {
      return { targetChatIds: [], count: 0 };
    }

    const orderedMsgs = [...msgs]
      .filter((m) => !m.isDeleted)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (orderedMsgs.length === 0) {
      return { targetChatIds: [], count: 0 };
    }

    const myName = userProfile?.displayName || userProfile?.username || 'مستخدم';
    const myPhoto = userProfile?.photoURL || '';
    const myColor = userProfile?.avatarColor || '#2481cc';
    const cleanComment = optionalComment?.trim() || '';

    const resolvedTargetsMap = new Map<
      string,
      { chatId: string; memberIds: string[]; label: string; isSaved: boolean }
    >();

    try {
      for (const target of targets) {
        if (target.isSaved) {
          const saved = await ensureSavedChatForForward();
          resolvedTargetsMap.set(saved.chatId, {
            chatId: saved.chatId,
            memberIds: saved.memberIds,
            label: 'الرسائل المحفوظة',
            isSaved: true,
          });
        } else if (target.user) {
          if (target.user.uid === currentUser.uid) {
            const saved = await ensureSavedChatForForward();
            resolvedTargetsMap.set(saved.chatId, {
              chatId: saved.chatId,
              memberIds: saved.memberIds,
              label: 'الرسائل المحفوظة',
              isSaved: true,
            });
            continue;
          }
          const dmId = `dm_${[currentUser.uid, target.user.uid].sort().join('_')}`;
          const existingLocal = chatsRef.current.find((c) => c.id === dmId);
          if (existingLocal) {
            resolvedTargetsMap.set(dmId, {
              chatId: dmId,
              memberIds: existingLocal.memberIds || [currentUser.uid, target.user.uid],
              label: target.user.displayName || target.user.username,
              isSaved: false,
            });
          } else {
            const dmRef = doc(db, 'chats', dmId);
            const snap = await getDoc(dmRef);
            if (snap.exists()) {
              const data = snap.data() as Chat;
              resolvedTargetsMap.set(dmId, {
                chatId: dmId,
                memberIds: data.memberIds || [currentUser.uid, target.user.uid],
                label: target.user.displayName || target.user.username,
                isSaved: false,
              });
            } else {
              const now = new Date().toISOString();
              const memberIds = [currentUser.uid, target.user.uid];
              const newChat: Chat = {
                id: dmId,
                type: 'direct',
                title: target.user.displayName || target.user.username,
                photoURL: target.user.photoURL || '',
                avatarColor: '#2481cc',
                description: target.user.bio || '',
                createdBy: currentUser.uid,
                createdAt: now,
                updatedAt: now,
                memberIds,
                membersCount: 2,
                unreadCounts: { [currentUser.uid]: 0, [target.user.uid]: 0 },
              };
              await setDoc(dmRef, newChat);
              resolvedTargetsMap.set(dmId, {
                chatId: dmId,
                memberIds,
                label: target.user.displayName || target.user.username,
                isSaved: false,
              });
            }
          }
        } else if (target.chatId) {
          const existingLocal = chatsRef.current.find((c) => c.id === target.chatId);
          if (existingLocal) {
            const info = getChatDisplayInfo(existingLocal);
            resolvedTargetsMap.set(existingLocal.id, {
              chatId: existingLocal.id,
              memberIds: existingLocal.memberIds || [currentUser.uid],
              label: info.title,
              isSaved: existingLocal.type === 'saved',
            });
          } else {
            const chatSnap = await getDoc(doc(db, 'chats', target.chatId));
            if (chatSnap.exists()) {
              const chatData = { ...(chatSnap.data() as Chat), id: chatSnap.id };
              const info = getChatDisplayInfo(chatData);
              resolvedTargetsMap.set(chatData.id, {
                chatId: chatData.id,
                memberIds: chatData.memberIds || [currentUser.uid],
                label: info.title,
                isSaved: chatData.type === 'saved',
              });
            }
          }
        }
      }

      const resolvedTargets = Array.from(resolvedTargetsMap.values());
      if (resolvedTargets.length === 0) {
        return { targetChatIds: [], count: 0 };
      }

      const baseMs = Date.now();
      for (const dest of resolvedTargets) {
        const payloads: Omit<Message, 'id'>[] = [];
        let timeOffset = 0;

        if (cleanComment) {
          payloads.push({
            chatId: dest.chatId,
            senderId: currentUser.uid,
            senderName: myName,
            senderPhoto: myPhoto,
            senderColor: myColor,
            text: cleanComment,
            type: 'text',
            readBy: [currentUser.uid],
            createdAt: new Date(baseMs + timeOffset).toISOString(),
          });
          timeOffset += 1;
        }

        for (const src of orderedMsgs) {
          const originalSenderName =
            src.forwardedFrom?.senderName ||
            usersMap[src.senderId]?.displayName ||
            src.senderName ||
            'مستخدم';
          const sourceChatTitle =
            src.forwardedFrom?.chatTitle ||
            (activeChat && activeChat.type !== 'direct' && activeChat.type !== 'saved'
              ? activeChat.title
              : undefined);

          const forwardedPayload: Omit<Message, 'id'> = {
            chatId: dest.chatId,
            senderId: currentUser.uid,
            senderName: myName,
            senderPhoto: myPhoto,
            senderColor: myColor,
            text: src.text || '',
            type: src.type || 'text',
            readBy: [currentUser.uid],
            createdAt: new Date(baseMs + timeOffset).toISOString(),
            forwardedFrom: {
              senderId: src.forwardedFrom?.senderId || src.senderId,
              senderName: originalSenderName,
              ...(sourceChatTitle ? { chatTitle: sourceChatTitle } : {}),
            },
            ...(src.mediaUrl ? { mediaUrl: src.mediaUrl } : {}),
            ...(src.mediaName ? { mediaName: src.mediaName } : {}),
            ...(src.mediaSize ? { mediaSize: src.mediaSize } : {}),
            ...(src.linkPreview ? { linkPreview: src.linkPreview } : {}),
            ...(typeof src.voiceDuration === 'number'
              ? { voiceDuration: src.voiceDuration }
              : {}),
            ...(typeof src.diceValue === 'number' ? { diceValue: src.diceValue } : {}),
            ...(src.isSpoiler ? { isSpoiler: true } : {}),
            ...(src.type === 'poll' && src.pollData
              ? {
                  pollData: {
                    question: src.pollData.question,
                    isAnonymous: Boolean(src.pollData.isAnonymous),
                    multipleAnswers: Boolean(src.pollData.multipleAnswers),
                    totalVotes: 0,
                    options: (src.pollData.options || []).map((opt) => ({
                      id: opt.id,
                      text: opt.text,
                      votes: [],
                    })),
                  },
                }
              : {}),
          };

          payloads.push(forwardedPayload);
          timeOffset += 1;
        }

        const CHUNK_SIZE = 400;
        for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
          const chunk = payloads.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);
          const messagesCol = collection(db, 'chats', dest.chatId, 'messages');
          for (const item of chunk) {
            const msgDocRef = doc(messagesCol);
            batch.set(msgDocRef, item);
          }
          await batch.commit();
        }

        const lastForwarded = payloads[payloads.length - 1];
        const previewText =
          lastForwarded.type === 'image'
            ? '📷 صورة محوّلة'
            : lastForwarded.type === 'video'
            ? '🎬 فيديو محوّل'
            : lastForwarded.type === 'voice'
            ? '🎤 رسالة صوتية محوّلة'
            : lastForwarded.type === 'poll'
            ? '📊 استطلاع رأي محوّل'
            : lastForwarded.type === 'dice'
            ? '🎲 رمية نرد محوّلة'
            : lastForwarded.type === 'file'
            ? `📎 ${lastForwarded.mediaName || 'ملف محوّل'}`
            : lastForwarded.type === 'sticker'
            ? lastForwarded.mediaName
              ? `🎨 ملصق: ${lastForwarded.mediaName}`
              : '🎨 ملصق محوّل'
            : lastForwarded.text;

        const unreadUpdates: Record<string, unknown> = {};
        dest.memberIds.forEach((uid) => {
          if (uid !== currentUser.uid) {
            unreadUpdates[`unreadCounts.${uid}`] = increment(payloads.length);
          } else {
            unreadUpdates[`unreadCounts.${uid}`] = 0;
          }
        });

        await updateDoc(doc(db, 'chats', dest.chatId), {
          updatedAt: lastForwarded.createdAt,
          lastMessage: {
            text: previewText,
            senderId: currentUser.uid,
            senderName: myName,
            createdAt: lastForwarded.createdAt,
            type: lastForwarded.type,
            readBy: [currentUser.uid],
          },
          ...unreadUpdates,
        });
      }

      tgAudio.playSendSound();
      clearSelection();
      setForwardingMessages(null);

      const count = orderedMsgs.length;
      const countLabel = count === 1 ? 'رسالة واحدة' : `${count} رسائل`;
      if (resolvedTargets.length === 1) {
        const only = resolvedTargets[0];
        showForwardToast({
          message: `تم تحويل ${countLabel} إلى ${only.label}`,
          type: 'success',
          targetChatId: only.chatId,
        });
      } else {
        showForwardToast({
          message: `تم تحويل ${countLabel} إلى ${resolvedTargets.length} وجهات`,
          type: 'success',
        });
      }

      return {
        targetChatIds: resolvedTargets.map((t) => t.chatId),
        count,
      };
    } catch (error) {
      showForwardToast({
        message: 'تعذر إتمام تحويل الرسائل، يرجى المحاولة مرة أخرى',
        type: 'error',
      });
      handleFirestoreError(error, OperationType.WRITE, 'chats/forward');
      throw error;
    }
  };

  const sendStickerMessage = async (sticker: {
    id: string;
    emoji: string;
    name: string;
    label: string;
    url: string;
    isCustom?: boolean;
  }) => {
    if (!currentUser || !activeChatId || !activeChat) return;

    const cleanEmoji = (sticker.emoji || '🎨').slice(0, 16);
    const cleanLabel = (sticker.label || sticker.name || 'ملصق').slice(0, 80);
    const cleanName = (sticker.name || cleanLabel).slice(0, 80);
    const cleanUrl = (sticker.url || '').slice(0, 350000);

    await sendMessage(cleanEmoji, 'sticker', {
      mediaUrl: cleanUrl,
      mediaName: cleanLabel,
    });

    const sanitizedId =
      (sticker.id || `stk_${Date.now()}`)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 128) || `stk_${Date.now()}`;

    const stickerDocPath = `users/${currentUser.uid}/stickers/${sanitizedId}`;
    const stickerRef = doc(db, 'users', currentUser.uid, 'stickers', sanitizedId);
    const existing = userStickers.find((s) => s.id === sanitizedId);
    const now = new Date().toISOString();

    try {
      const payload: UserStickerDoc = {
        id: sanitizedId,
        uid: currentUser.uid,
        emoji: cleanEmoji,
        name: cleanName,
        label: cleanLabel,
        url: cleanUrl,
        isCustom: Boolean(existing?.isCustom ?? sticker.isCustom),
        useCount: Math.min(1000000, (existing?.useCount || 0) + 1),
        lastUsedAt: now,
        createdAt: existing?.createdAt || now,
      };
      await setDoc(stickerRef, payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, stickerDocPath);
    }
  };

  const saveCustomSticker = async (
    file: File,
    label?: string,
    emoji = '✨'
  ): Promise<UserStickerDoc> => {
    if (!currentUser) throw new Error('يجب تسجيل الدخول أولاً');

    const compressed = await compressImageFile(file, 320, 0.82);
    if (!compressed || compressed.length > 340000) {
      throw new Error('حجم الصورة كبير جداً بعد الضغط، يرجى اختيار صورة أصغر');
    }

    const baseName = file.name.replace(/\.[^/.]+$/, '').trim() || 'ملصق مخصص';
    const cleanLabel = (label || baseName).slice(0, 80);
    const cleanName = baseName.slice(0, 80);
    const cleanEmoji = (emoji || '✨').slice(0, 16);
    const stickerId = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const docData: UserStickerDoc = {
      id: stickerId,
      uid: currentUser.uid,
      emoji: cleanEmoji,
      name: cleanName,
      label: cleanLabel,
      url: compressed,
      isCustom: true,
      useCount: 0,
      lastUsedAt: now,
      createdAt: now,
    };

    const stickerPath = `users/${currentUser.uid}/stickers/${stickerId}`;
    try {
      await setDoc(doc(db, 'users', currentUser.uid, 'stickers', stickerId), docData);
      return docData;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, stickerPath);
      throw error;
    }
  };

  const deleteCustomSticker = async (stickerId: string) => {
    if (!currentUser || !stickerId) return;
    const stickerPath = `users/${currentUser.uid}/stickers/${stickerId}`;
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'stickers', stickerId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, stickerPath);
    }
  };

  const editMessageText = async (messageId: string, newText: string) => {
    if (!activeChatId || !newText.trim()) return;
    try {
      const clean = newText.trim();
      const autoLinkPreview = extractRichLinkPreview(clean);
      const msgRef = doc(db, 'chats', activeChatId, 'messages', messageId);
      await updateDoc(msgRef, {
        text: clean,
        editedAt: new Date().toISOString(),
        linkPreview: autoLinkPreview ? autoLinkPreview : deleteField(),
      });
      setEditingMessage(null);

      if (autoLinkPreview) {
        enrichMessageLinkPreview(clean)
          .then((richPreview) => {
            if (!richPreview) return;
            return updateDoc(msgRef, { linkPreview: richPreview });
          })
          .catch(() => {});
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${activeChatId}/messages/${messageId}`);
    }
  };

  const sendDiceRoll = async (emoji = '🎲') => {
    if (!currentUser || !activeChatId) return;
    const diceVal = Math.floor(Math.random() * 6) + 1;
    tgAudio.playDiceSound();
    await sendMessage(`رمى ${emoji} وحصل على ${diceVal}!`, 'dice', {
      diceValue: diceVal,
    });
    if (diceVal === 6) {
      fireConfetti({ particleCount: 40, spread: 60 });
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser || !activeChatId) return;
    if (!isActiveChatMember) {
      setPendingInviteStatus({
        message: 'انضم أولاً لتتمكن من التفاعل مع الرسائل',
        type: 'error',
      });
      return;
    }
    try {
      const msgRef = doc(db, 'chats', activeChatId, 'messages', messageId);
      const targetMsg = messages.find((m) => m.id === messageId);
      if (!targetMsg || targetMsg.isDeleted) return;

      const currentReactions: Record<string, string[]> = { ...(targetMsg.reactions || {}) };
      const userList = currentReactions[emoji] || [];

      if (userList.includes(currentUser.uid)) {
        currentReactions[emoji] = userList.filter((id) => id !== currentUser.uid);
        if (currentReactions[emoji].length === 0) {
          delete currentReactions[emoji];
        }
      } else {
        currentReactions[emoji] = [...userList, currentUser.uid];
        tgAudio.playPopSound();
        if (emoji === '❤️' || emoji === '🔥' || emoji === '🎉') {
          fireConfetti({
            particleCount: 25,
            spread: 40,
            origin: { y: 0.7 },
          });
        }
      }

      await updateDoc(msgRef, { reactions: currentReactions });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${activeChatId}/messages/${messageId}`);
    }
  };

  const pinMessage = async (messageId: string, isPinned: boolean) => {
    if (!activeChatId || !isActiveChatMember) return;
    try {
      const msgRef = doc(db, 'chats', activeChatId, 'messages', messageId);
      const chatRef = doc(db, 'chats', activeChatId);

      if (isPinned) {
        for (const m of messages) {
          if (m.isPinned && m.id !== messageId) {
            await updateDoc(doc(db, 'chats', activeChatId, 'messages', m.id), { isPinned: false });
          }
        }
      }

      await updateDoc(msgRef, { isPinned });
      await updateDoc(chatRef, { pinnedMessageId: isPinned ? messageId : '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${activeChatId}/messages/${messageId}`);
    }
  };

  const voteInPoll = async (messageId: string, optionId: string) => {
    if (!currentUser || !activeChatId) return;
    if (!isActiveChatMember) {
      setPendingInviteStatus({
        message: 'انضم أولاً لتتمكن من التصويت في الاستطلاع',
        type: 'error',
      });
      return;
    }
    try {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg || !msg.pollData) return;

      const currentPoll: PollData = JSON.parse(JSON.stringify(msg.pollData));
      const totalVotersSet = new Set<string>();

      currentPoll.options = currentPoll.options.map((opt) => {
        let optVotes = opt.votes || [];
        if (opt.id === optionId) {
          if (optVotes.includes(currentUser.uid)) {
            optVotes = optVotes.filter((u) => u !== currentUser.uid);
          } else {
            optVotes.push(currentUser.uid);
          }
        } else if (!currentPoll.multipleAnswers) {
          optVotes = optVotes.filter((u) => u !== currentUser.uid);
        }
        optVotes.forEach((v) => totalVotersSet.add(v));
        return { ...opt, votes: optVotes };
      });

      currentPoll.totalVotes = totalVotersSet.size;

      const msgRef = doc(db, 'chats', activeChatId, 'messages', messageId);
      await updateDoc(msgRef, { pollData: currentPoll });
      tgAudio.playPopSound();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${activeChatId}/messages/${messageId}`);
    }
  };

  const createChat = async (chatData: Omit<Chat, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    if (!currentUser) throw new Error('Not logged in');
    try {
      const chatDocRef = doc(collection(db, 'chats'));
      const now = new Date().toISOString();
      const members = Array.from(
        new Set([...chatData.memberIds.filter(Boolean), currentUser.uid])
      );
      const inviteCode =
        chatData.inviteCode ||
        (chatData.type === 'channel' || chatData.type === 'group'
          ? generateInviteCode()
          : undefined);

      const newChat: Chat = {
        id: chatDocRef.id,
        ...chatData,
        ...(inviteCode ? { inviteCode } : {}),
        createdBy: currentUser.uid,
        createdAt: now,
        updatedAt: now,
        memberIds: members,
        adminIds: [currentUser.uid],
        bannedIds: [],
        unreadCounts: { [currentUser.uid]: 0 },
      };

      const batch = writeBatch(db);
      batch.set(chatDocRef, newChat);

      if (inviteCode && (newChat.type === 'channel' || newChat.type === 'group')) {
        const inviteDoc: GroupInvite = {
          inviteCode,
          chatId: chatDocRef.id,
          chatType: newChat.type,
          title: newChat.title,
          description: newChat.description || '',
          photoURL: newChat.photoURL || '',
          createdBy: currentUser.uid,
          createdAt: now,
        };
        batch.set(doc(db, 'groupInvites', inviteCode), inviteDoc);
      }

      const welcomeMsgRef = doc(collection(db, 'chats', chatDocRef.id, 'messages'));
      batch.set(welcomeMsgRef, {
        chatId: chatDocRef.id,
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || 'مستخدم',
        text:
          newChat.type === 'channel'
            ? `📢 تم إنشاء القناة "${newChat.title}".`
            : `تم إنشاء المحادثة "${newChat.title}".`,
        type: 'text',
        readBy: [currentUser.uid],
        createdAt: now,
      });

      await batch.commit();
      setActiveChatId(chatDocRef.id);
      return chatDocRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
      throw error;
    }
  };

  const contextValue = useMemo<ChatContextType>(
    () => ({
      chats,
      activeChat,
      activeChatId,
      setActiveChatId,
      messages,
      loadingChats,
      loadingMessages,
      hasMoreMessages,
      isLoadingOlderMessages,
      loadOlderMessages,
      firstUnreadMessageId,
      filter,
      setFilter,
      searchQuery,
      setSearchQuery,
      messageSearchMatches,
      isSearchingMessages,
      replyingTo,
      setReplyingTo,
      editingMessage,
      setEditingMessage,
      showInfoDrawer,
      setShowInfoDrawer,
      activeMediaUrl,
      setActiveMediaUrl,
      stories,
      addStory,
      markStoryViewed,
      activeStoryIndex,
      setActiveStoryIndex,
      callState,
      incomingCall,
      startCall,
      acceptIncomingCall,
      declineIncomingCall,
      endCall,
      toggleMute,
      toggleCamera,
      typingStatus,
      chatTypingMap,
      updateTypingStatus,
      getChatDisplayInfo,
      isChatBlockedByMe,
      isActiveChatBlocked,
      isActiveChatModerator,
      canPostInActiveChat,
      startDirectChat,
      createGroup,
      addMembersToGroup,
      updateGroupOrChannelInfo,
      promoteChatAdmin,
      demoteChatAdmin,
      kickMemberFromChat,
      unbanMemberFromChat,
      regenerateInviteLink,
      leaveChat,
      joinGroupByInvite,
      sendMessage,
      sendVideoMessage,
      deleteMessages,
      editMessageText,
      toggleReaction,
      pinMessage,
      createChat,
      voteInPoll,
      sendDiceRoll,
      userStickers,
      sendStickerMessage,
      saveCustomSticker,
      deleteCustomSticker,
      pinnedMessage,
      pendingInviteStatus,
      clearPendingInviteStatus,
      isActiveChatMember,
      openInviteLink,
      joinChat,
      resolveInvitePreview,
      ensureChatInviteLink,
      isSelectionMode,
      selectedMessageIds,
      selectedMessages,
      enterSelectionMode,
      toggleMessageSelection,
      selectAllMessages,
      clearSelection,
      forwardingMessages,
      openForwardModal,
      closeForwardModal,
      forwardMessages,
      forwardToast,
      clearForwardToast,
    }),
    [
      chats,
      activeChat,
      activeChatId,
      messages,
      loadingChats,
      loadingMessages,
      hasMoreMessages,
      isLoadingOlderMessages,
      loadOlderMessages,
      firstUnreadMessageId,
      filter,
      searchQuery,
      messageSearchMatches,
      isSearchingMessages,
      replyingTo,
      setReplyingTo,
      editingMessage,
      setEditingMessage,
      showInfoDrawer,
      activeMediaUrl,
      stories,
      activeStoryIndex,
      callState,
      incomingCall,
      startCall,
      acceptIncomingCall,
      declineIncomingCall,
      endCall,
      toggleMute,
      toggleCamera,
      typingStatus,
      chatTypingMap,
      getChatDisplayInfo,
      isChatBlockedByMe,
      isActiveChatBlocked,
      isActiveChatModerator,
      canPostInActiveChat,
      userStickers,
      pinnedMessage,
      pendingInviteStatus,
      clearPendingInviteStatus,
      isActiveChatMember,
      resolveInvitePreview,
      isSelectionMode,
      selectedMessageIds,
      selectedMessages,
      enterSelectionMode,
      toggleMessageSelection,
      selectAllMessages,
      clearSelection,
      forwardingMessages,
      openForwardModal,
      closeForwardModal,
      forwardToast,
      clearForwardToast,
    ]
  );

  return <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
};
