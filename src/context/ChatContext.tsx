import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  arrayUnion,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db, handleFirestoreError, isChatAccessibleOnServer, OperationType } from '../firebase/config';
import { useAuth } from './AuthContext';
import {
  Chat,
  Message,
  FolderFilter,
  PollData,
  MessageType,
  Story,
  CallState,
  UserProfile,
  GroupInvite,
  UserStickerDoc,
} from '../types/telegram';
import {
  tgAudio,
  generateInviteCode,
  extractInviteCode,
  isUserOnlineByLastSeen,
  formatLastSeenArabic,
  getMessageReplyPreview,
  compressImageFile,
} from '../utils/telegramHelpers';

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

interface ChatContextType {
  chats: Chat[];
  activeChat: Chat | null;
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  messages: Message[];
  loadingChats: boolean;
  loadingMessages: boolean;
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
  startCall: (chat: Chat, isVideo?: boolean) => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  typingStatus: string | null;
  updateTypingStatus: (isTyping: boolean, targetChatId?: string) => Promise<void>;
  getChatDisplayInfo: (chat: Chat) => ChatDisplayInfo;
  startDirectChat: (targetUser: UserProfile) => Promise<string>;
  createGroup: (data: {
    title: string;
    description?: string;
    photoURL?: string;
    memberIds: string[];
  }) => Promise<string>;
  addMembersToGroup: (chatId: string, newMemberIds: string[]) => Promise<void>;
  joinGroupByInvite: (codeOrLink: string) => Promise<Chat>;
  sendMessage: (text: string, type?: MessageType, extra?: Partial<Message>) => Promise<void>;
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
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, userProfile, usersMap } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
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
  const [typingStatus] = useState<string | null>(null);
  const [pendingInviteStatus, setPendingInviteStatus] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Cloud Stories & Stickers
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [userStickers, setUserStickers] = useState<UserStickerDoc[]>([]);

  // Call State
  const [callState, setCallState] = useState<CallState>({
    isActive: false,
    isVideo: false,
    status: 'calling',
    duration: 0,
    isMuted: false,
    isCameraOff: false,
    chat: null,
  });

  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const seededRef = useRef<string | null>(null);
  const chatsRef = useRef<Chat[]>([]);
  chatsRef.current = chats;
  const cachedChatMessagesRef = useRef<Map<string, { updatedAt: string; items: Message[] }>>(
    new Map()
  );

  const activeChat = useMemo(
    () => chats.find((c) => c.id === activeChatId) || null,
    [chats, activeChatId]
  );
  const pinnedMessage = useMemo(
    () => messages.find((m) => m.isPinned) || null,
    [messages]
  );

  const clearPendingInviteStatus = useCallback(() => setPendingInviteStatus(null), []);

  // Resolve display name/avatar dynamically (especially for 1-on-1 direct chats!)
  const getChatDisplayInfo = useCallback((chat: Chat): ChatDisplayInfo => {
    if (chat.type === 'direct' && currentUser) {
      const otherUid = chat.memberIds.find((id) => id !== currentUser.uid);
      const otherUser = otherUid ? usersMap[otherUid] : undefined;
      if (otherUser) {
        const online = isUserOnlineByLastSeen(otherUser);
        const lastSeenText = formatLastSeenArabic(otherUser.lastSeen);
        return {
          title: otherUser.displayName || otherUser.username,
          photoURL: otherUser.photoURL,
          isOnline: online,
          subtitle: online
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
  }, [currentUser, usersMap]);

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

  // Call handlers
  const startCall = (chat: Chat, isVideo = false) => {
    tgAudio.startCallingTone();
    setCallState({
      isActive: true,
      isVideo,
      status: 'calling',
      duration: 0,
      isMuted: false,
      isCameraOff: false,
      chat,
    });

    setTimeout(() => {
      tgAudio.stopCallingTone();
      tgAudio.playPopSound();
      setCallState((prev) => ({ ...prev, status: 'connected' }));

      if (callTimerRef.current) clearInterval(callTimerRef.current);
      callTimerRef.current = setInterval(() => {
        setCallState((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    }, 2500);
  };

  const endCall = () => {
    tgAudio.stopCallingTone();
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    setCallState((prev) => ({ ...prev, status: 'ended' }));
    setTimeout(() => {
      setCallState({
        isActive: false,
        isVideo: false,
        status: 'calling',
        duration: 0,
        isMuted: false,
        isCameraOff: false,
        chat: null,
      });
    }, 600);
  };

  const toggleMute = () => setCallState((prev) => ({ ...prev, isMuted: !prev.isMuted }));
  const toggleCamera = () => setCallState((prev) => ({ ...prev, isCameraOff: !prev.isCameraOff }));

  // Create personal Saved Messages cloud space on first login (no fake chats)
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

  // Real-time listen to chats
  useEffect(() => {
    if (!currentUser) {
      setChats([]);
      setActiveChatId(null);
      setMessages([]);
      setSearchQuery('');
      setReplyingToState(null);
      setEditingMessageState(null);
      cachedChatMessagesRef.current.clear();
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

        loadedChats.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
        });

        if (loadedChats.length === 0) {
          setChats([]);
          setActiveChatId(null);
          await ensureSavedMessagesChat(
            currentUser.uid,
            userProfile?.displayName || userProfile?.username || 'أنا'
          );
        } else {
          setChats(loadedChats);
          setActiveChatId((prev) =>
            prev && loadedChats.some((c) => c.id === prev) ? prev : null
          );
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

  // Handle ?join=INVITE_CODE URL parameter automatically after login
  useEffect(() => {
    if (!currentUser) return;
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode) {
      // Remove query param from URL cleanly
      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({}, document.title, cleanUrl);

      joinGroupByInvite(joinCode)
        .then((joinedChat) => {
          setPendingInviteStatus({
            message: `تم انضمامك إلى مجموعة "${joinedChat.title}" بنجاح!`,
            type: 'success',
          });
        })
        .catch((err: unknown) => {
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

  // Real-time listen to messages of active chat + REAL Read Receipts marking
  useEffect(() => {
    if (!currentUser || !activeChatId || !canListenActiveChatMessages) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    let cancelled = false;
    const chatId = activeChatId;
    setLoadingMessages(true);
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        if (cancelled) return;
        const loadedMsgs: Message[] = [];
        const unreadMessageIds: string[] = [];

        snapshot.forEach((docSnap) => {
          const msgData = docSnap.data() as Omit<Message, 'id'>;
          const msg: Message = {
            id: docSnap.id,
            ...msgData,
          };
          loadedMsgs.push(msg);

          if (
            msg.senderId !== currentUser.uid &&
            !(msg.readBy || []).includes(currentUser.uid)
          ) {
            unreadMessageIds.push(docSnap.id);
          }
        });

        setMessages(loadedMsgs);
        setLoadingMessages(false);

        const activeChatSummary = chatsRef.current.find((c) => c.id === chatId);
        cachedChatMessagesRef.current.set(chatId, {
          updatedAt: activeChatSummary?.updatedAt || '',
          items: [...loadedMsgs].reverse(),
        });

        // Real read receipt persistence to Firestore!
        if (unreadMessageIds.length > 0) {
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

        // Reset unread count & update lastMessage.readBy on Chat doc
        const currentChat = chatsRef.current.find((c) => c.id === chatId);
        const hasUnreadBadge = (currentChat?.unreadCounts?.[currentUser.uid] || 0) > 0;
        const lastReadByMissing =
          currentChat?.lastMessage &&
          currentChat.lastMessage.senderId !== currentUser.uid &&
          !(currentChat.lastMessage.readBy || []).includes(currentUser.uid);

        if (hasUnreadBadge || lastReadByMissing) {
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
              setChats((prev) => prev.filter((c) => c.id !== chatId));
              setActiveChatId((prev) => (prev === chatId ? null : prev));
              setMessages([]);
              setLoadingMessages(false);
            }
            return;
          }
        }
        handleFirestoreError(error, OperationType.GET, `chats/${chatId}/messages`);
        setLoadingMessages(false);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [currentUser, activeChatId, canListenActiveChatMessages]);

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

    // Instant match from cached/loaded messages
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
                    setChats((prev) => prev.filter((c) => c.id !== chat.id));
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

  // Start or open existing 1-on-1 Direct Chat with another real user
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

      // Save invite lookup doc
      const inviteDoc: GroupInvite = {
        inviteCode,
        chatId: chatDocRef.id,
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

      await updateDoc(doc(db, 'chats', chatId), {
        memberIds: arrayUnion(...newMemberIds),
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

  // Join Group via Invite Link or Invite Code
  const joinGroupByInvite = async (codeOrLink: string): Promise<Chat> => {
    if (!currentUser) throw new Error('يجب تسجيل الدخول أولاً');
    const code = extractInviteCode(codeOrLink);
    if (!code) throw new Error('الرجاء إدخال رابط أو رمز دعوة صحيح');

    try {
      const inviteSnap = await getDoc(doc(db, 'groupInvites', code));
      if (!inviteSnap.exists()) {
        throw new Error('رابط الدعوة غير موجود أو غير صحيح');
      }

      const invite = inviteSnap.data() as GroupInvite;
      const chatRef = doc(db, 'chats', invite.chatId);
      const chatSnap = await getDoc(chatRef);
      if (!chatSnap.exists()) {
        throw new Error('المجموعة لم تعد موجودة');
      }

      const chatData = chatSnap.data() as Chat;
      if (!chatData.memberIds.includes(currentUser.uid)) {
        const updatedCount = chatData.memberIds.length + 1;
        await updateDoc(chatRef, {
          memberIds: arrayUnion(currentUser.uid),
          membersCount: updatedCount,
          updatedAt: new Date().toISOString(),
        });

        await addDoc(collection(db, 'chats', invite.chatId, 'messages'), {
          chatId: invite.chatId,
          senderId: currentUser.uid,
          senderName: userProfile?.displayName || 'مستخدم',
          text: `🔗 انضم ${userProfile?.displayName || userProfile?.username} عبر رابط الدعوة`,
          type: 'text',
          readBy: [currentUser.uid],
          createdAt: new Date().toISOString(),
        });
      }

      setActiveChatId(invite.chatId);
      return { ...chatData, id: invite.chatId };
    } catch (error) {
      if (error instanceof Error && !error.message.includes('Missing or insufficient permissions')) {
        throw error;
      }
      handleFirestoreError(error, OperationType.UPDATE, `groupInvites/${code}`);
      throw error;
    }
  };

  // Update real-time typing status in Firestore
  const updateTypingStatus = async (isTyping: boolean, targetChatId?: string) => {
    const chatId = targetChatId || activeChatId;
    if (!currentUser || !chatId) return;
    const targetChat = chats.find((c) => c.id === chatId);
    if (chatId.startsWith('saved_') || targetChat?.type === 'saved') return;

    const typingRef = doc(db, 'chats', chatId, 'typing', currentUser.uid);
    try {
      const displayName = (userProfile?.displayName || userProfile?.username || 'مستخدم').slice(0, 100);
      await setDoc(typingRef, {
        uid: currentUser.uid,
        displayName,
        isTyping,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}/typing/${currentUser.uid}`);
    }
  };

  // Send message (Persisted to Firestore with real readBy & unreadCounts)
  const sendMessage = async (text: string, type: MessageType = 'text', extra: Partial<Message> = {}) => {
    if (!currentUser || !activeChatId || !activeChat) return;
    if (!text.trim() && type === 'text') return;

    try {
      const chatDocRef = doc(db, 'chats', activeChatId);
      const messagesRef = collection(db, 'chats', activeChatId, 'messages');
      const now = new Date().toISOString();

      const newMsgData: Omit<Message, 'id'> = {
        chatId: activeChatId,
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || userProfile?.username || 'مستخدم',
        senderPhoto: userProfile?.photoURL || '',
        senderColor: userProfile?.avatarColor || '#2481cc',
        text: text.trim(),
        type,
        readBy: [currentUser.uid], // Only sender has read it so far -> Single Check ✓
        createdAt: now,
        ...(replyingTo
          ? {
              replyToId: replyingTo.id,
              replyToText: getMessageReplyPreview(replyingTo).slice(0, 120),
              replyToSender:
                usersMap[replyingTo.senderId]?.displayName || replyingTo.senderName,
            }
          : {}),
        ...extra,
      };

      await addDoc(messagesRef, newMsgData);
      tgAudio.playSendSound();
      setReplyingTo(null);
      updateTypingStatus(false, activeChatId).catch(() => {});

      // Update chat's lastMessage & increment unreadCounts for other members
      const unreadUpdates: Record<string, unknown> = {};
      (activeChat.memberIds || []).forEach((uid) => {
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
              : text.trim(),
          senderId: currentUser.uid,
          senderName: userProfile?.displayName || 'مستخدم',
          createdAt: now,
          type,
          readBy: [currentUser.uid],
        },
        ...unreadUpdates,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `chats/${activeChatId}/messages`);
    }
  };

  // Send sticker to active chat & track recent usage in Firestore
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

  // Upload & save a custom user sticker in Firestore
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

  // Delete a custom sticker from Firestore
  const deleteCustomSticker = async (stickerId: string) => {
    if (!currentUser || !stickerId) return;
    const stickerPath = `users/${currentUser.uid}/stickers/${stickerId}`;
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'stickers', stickerId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, stickerPath);
    }
  };

  // Edit Message
  const editMessageText = async (messageId: string, newText: string) => {
    if (!activeChatId || !newText.trim()) return;
    try {
      const msgRef = doc(db, 'chats', activeChatId, 'messages', messageId);
      await updateDoc(msgRef, {
        text: newText.trim(),
        editedAt: new Date().toISOString(),
      });
      setEditingMessage(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${activeChatId}/messages/${messageId}`);
    }
  };

  // Interactive Dice Roll
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

  // Toggle reaction
  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser || !activeChatId) return;
    try {
      const msgRef = doc(db, 'chats', activeChatId, 'messages', messageId);
      const targetMsg = messages.find((m) => m.id === messageId);
      if (!targetMsg) return;

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

  // Pin / Unpin message
  const pinMessage = async (messageId: string, isPinned: boolean) => {
    if (!activeChatId) return;
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

  // Vote in poll
  const voteInPoll = async (messageId: string, optionId: string) => {
    if (!currentUser || !activeChatId) return;
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

  // Generic createChat (for Channels, etc.)
  const createChat = async (chatData: Omit<Chat, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    if (!currentUser) throw new Error('Not logged in');
    try {
      const chatDocRef = doc(collection(db, 'chats'));
      const now = new Date().toISOString();
      const members = Array.from(
        new Set([...chatData.memberIds.filter(Boolean), currentUser.uid])
      );
      const newChat: Chat = {
        id: chatDocRef.id,
        ...chatData,
        createdBy: currentUser.uid,
        createdAt: now,
        updatedAt: now,
        memberIds: members,
        unreadCounts: { [currentUser.uid]: 0 },
      };

      const batch = writeBatch(db);
      batch.set(chatDocRef, newChat);

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
      startCall,
      endCall,
      toggleMute,
      toggleCamera,
      typingStatus,
      updateTypingStatus,
      getChatDisplayInfo,
      startDirectChat,
      createGroup,
      addMembersToGroup,
      joinGroupByInvite,
      sendMessage,
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
    }),
    [
      chats,
      activeChat,
      activeChatId,
      messages,
      loadingChats,
      loadingMessages,
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
      typingStatus,
      getChatDisplayInfo,
      userStickers,
      pinnedMessage,
      pendingInviteStatus,
      clearPendingInviteStatus,
    ]
  );

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
};
