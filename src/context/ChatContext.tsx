import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { useAuth } from './AuthContext';
import {
  Chat,
  Message,
  FolderFilter,
  PollData,
  MessageType,
  Story,
  CallState,
} from '../types/telegram';
import { tgAudio } from '../utils/telegramHelpers';
import confetti from 'canvas-confetti';

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
  replyingTo: Message | null;
  setReplyingTo: (m: Message | null) => void;
  editingMessage: Message | null;
  setEditingMessage: (m: Message | null) => void;
  showInfoDrawer: boolean;
  setShowInfoDrawer: (show: boolean) => void;
  activeMediaUrl: string | null;
  setActiveMediaUrl: (url: string | null) => void;
  stories: Story[];
  addStory: (mediaUrl: string, caption?: string) => void;
  activeStoryIndex: number | null;
  setActiveStoryIndex: (idx: number | null) => void;
  callState: CallState;
  startCall: (chat: Chat, isVideo?: boolean) => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  typingStatus: string | null;
  sendMessage: (text: string, type?: MessageType, extra?: Partial<Message>) => Promise<void>;
  editMessageText: (messageId: string, newText: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  pinMessage: (messageId: string, isPinned: boolean) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  createChat: (chatData: Omit<Chat, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => Promise<string>;
  voteInPoll: (messageId: string, optionId: string) => Promise<void>;
  sendDiceRoll: (emoji?: string) => Promise<void>;
  pinnedMessage: Message | null;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, userProfile } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [filter, setFilter] = useState<FolderFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const [activeMediaUrl, setActiveMediaUrl] = useState<string | null>(null);
  const [typingStatus, setTypingStatus] = useState<string | null>(null);

  // Stories
  const [stories, setStories] = useState<Story[]>([
    {
      id: 'story_official',
      userId: 'telegram_official',
      userName: 'Telegram News',
      userAvatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
      mediaUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
      caption: '🚀 تحديث تيليجرام الجديد: مكالمات فيديو مشفرة، استطلاعات تفاعلية وقصص Telegram Stories!',
      createdAt: new Date().toISOString(),
      viewsCount: 14820,
    },
    {
      id: 'story_tech',
      userId: 'dev_sara',
      userName: 'سارة المهندس',
      userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      mediaUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80',
      caption: 'جلسة برمجة مسائية مع كوب قهوة وشاشة الكود ☕️💻',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      viewsCount: 342,
    },
    {
      id: 'story_omar',
      userId: 'omar_dev',
      userName: 'عمر التميمي',
      userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      mediaUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
      caption: 'إجازة نهاية الأسبوع في الطبيعة الساحرة 🌲🏔',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      viewsCount: 219,
    },
  ]);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);

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

  // Active chat object
  const activeChat = chats.find((c) => c.id === activeChatId) || null;
  const pinnedMessage = messages.find((m) => m.isPinned) || null;

  // Add Story
  const addStory = (mediaUrl: string, caption = '') => {
    const newStory: Story = {
      id: `story_${Date.now()}`,
      userId: currentUser?.uid || 'me',
      userName: userProfile?.displayName || 'قصتي',
      userAvatar: userProfile?.photoURL,
      mediaUrl,
      caption,
      createdAt: new Date().toISOString(),
      viewsCount: 1,
    };
    setStories((prev) => [newStory, ...prev]);
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

    // Simulate answering after 3.5 seconds
    setTimeout(() => {
      tgAudio.stopCallingTone();
      tgAudio.playPopSound();
      setCallState((prev) => ({ ...prev, status: 'connected' }));

      // Duration counter
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      callTimerRef.current = setInterval(() => {
        setCallState((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    }, 3500);
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
    }, 800);
  };

  const toggleMute = () => {
    setCallState((prev) => ({ ...prev, isMuted: !prev.isMuted }));
  };

  const toggleCamera = () => {
    setCallState((prev) => ({ ...prev, isCameraOff: !prev.isCameraOff }));
  };

  // Pre-seed default chats for new user
  const seedDefaultChats = async (userId: string, userName: string) => {
    try {
      // 1. Saved messages
      const savedChatId = `saved_${userId}`;
      await setDoc(doc(db, 'chats', savedChatId), {
        id: savedChatId,
        type: 'saved',
        title: 'الرسائل المحفوظة',
        avatarColor: '#2481cc',
        description: 'مساحتك السحابية الخاصة لحفظ الملاحظات والصور والروابط والملفات للوصول إليها من أي جهاز.',
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        memberIds: [userId],
        membersCount: 1,
        isPinned: true,
        lastMessage: {
          text: 'أهلاً بك في سحابة الرسائل المحفوظة! يمكنك تخزين أي نص أو ملف هنا.',
          senderId: userId,
          senderName: userName,
          createdAt: new Date().toISOString(),
          type: 'text',
        },
      });

      await addDoc(collection(db, 'chats', savedChatId, 'messages'), {
        chatId: savedChatId,
        senderId: userId,
        senderName: userName,
        text: 'أهلاً بك في سحابة الرسائل المحفوظة! يمكنك إرسال نصوص وصور وملاحظات صوتية هنا لتخزينها.',
        type: 'text',
        createdAt: new Date().toISOString(),
      });

      // 2. Official Telegram News Channel
      const newsChannelId = `news_${userId}`;
      await setDoc(doc(db, 'chats', newsChannelId), {
        id: newsChannelId,
        type: 'channel',
        title: 'قناة تيليجرام الرسمية 📢',
        photoURL: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
        avatarColor: '#2AABEE',
        description: 'القناة الرسمية لأخبار تيليجرام والتحديثات والميزات الجديدة.',
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        memberIds: [userId],
        membersCount: 1420500,
        isPinned: false,
        lastMessage: {
          text: '🚀 تم إطلاق الإصدار الجديد من تيليجرام ويب بتصميم متكامل وقاعدة بيانات سحابية سريعة!',
          senderId: userId,
          senderName: 'تيليجرام',
          createdAt: new Date().toISOString(),
          type: 'text',
        },
      });

      await addDoc(collection(db, 'chats', newsChannelId, 'messages'), {
        chatId: newsChannelId,
        senderId: userId,
        senderName: 'تيليجرام',
        text: '🚀 تم إطلاق تطبيق تيليجرام ويب فائق السرعة! يتضمن الميزات التالية:\n• محادثات فورية فردية وجماعية وقنوات عامة\n• إرسال ملاحظات صوتية وصور وملفات وملصقات\n• إنشاء استطلاعات رأي تفاعلية مباشرة (Polls)\n• مكالمات فيديو وصوتية مشفرة\n• قصص تيليجرام (Telegram Stories)\n• التفاعل بالرموز التعبيرية وتثبيت الرسائل وتعديلها.',
        type: 'text',
        isPinned: true,
        reactions: { '🔥': [userId], '❤️': [userId] },
        createdAt: new Date().toISOString(),
      });

      // 3. Developers Community Group
      const devGroupId = `devs_${userId}`;
      await setDoc(doc(db, 'chats', devGroupId), {
        id: devGroupId,
        type: 'group',
        title: 'مجتمع مطوري البرمجيات 💻',
        photoURL: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=400&q=80',
        avatarColor: '#41a76c',
        description: 'مجموعة نقاش مفتوحة للمطورين والمصممين حول أحدث التقنيات وأفضل الممارسات.',
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        memberIds: [userId],
        membersCount: 582,
        isPinned: false,
        lastMessage: {
          text: 'سارة: ما رأيكم في أداء وتصميم تيليجرام الجديد؟',
          senderId: userId,
          senderName: 'سارة المهندس',
          createdAt: new Date().toISOString(),
          type: 'text',
        },
      });

      await addDoc(collection(db, 'chats', devGroupId, 'messages'), {
        chatId: devGroupId,
        senderId: userId,
        senderName: 'مشرف المجموعة',
        text: 'مرحباً بجميع الأعضاء الجدد في مجتمع المطورين! نرجو الالتزام بقواعد الاحترام ومشاركة الخبرات.',
        type: 'text',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      });

      await addDoc(collection(db, 'chats', devGroupId, 'messages'), {
        chatId: devGroupId,
        senderId: userId,
        senderName: 'سارة المهندس',
        text: 'ما رأيكم في أداء وتصميم تيليجرام الجديد؟ تجربة الاستخدام سريعة وسلسة جداً!',
        type: 'text',
        reactions: { '👍': [userId], '❤️': [userId] },
        createdAt: new Date().toISOString(),
      });

      // 4. Interactive Assistant Bot
      const botChatId = `bot_${userId}`;
      await setDoc(doc(db, 'chats', botChatId), {
        id: botChatId,
        type: 'direct',
        title: 'المساعد الآلي (Telegram Bot) 🤖',
        avatarColor: '#8c5fd1',
        description: 'بوت تيليجرام التفاعلي الذكي، اكتب /help لعرض الأوامر المتاحة أو تحدث معي مباشرة!',
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        memberIds: [userId],
        membersCount: 2,
        isPinned: true,
        lastMessage: {
          text: 'مرحباً بك! أنا بوت تيليجرام الذكي. اكتب /help أو اضغط على الأزرار أدناه.',
          senderId: userId,
          senderName: 'Telegram Bot',
          createdAt: new Date().toISOString(),
          type: 'text',
        },
      });

      await addDoc(collection(db, 'chats', botChatId, 'messages'), {
        chatId: botChatId,
        senderId: userId,
        senderName: 'Telegram Bot',
        text: 'مرحباً بك يا صديقي! أنا مساعدك الذكي في تيليجرام 🤖\n\nاختر أمراً أو اكتبه في الدردشة:',
        type: 'text',
        inlineButtons: [
          [
            { text: '⏰ الوقت الآن', data: '/time' },
            { text: '🎲 رمي نرد', data: '/dice' },
          ],
          [
            { text: '😂 نكتة برمجية', data: '/joke' },
            { text: '💡 معلومة تقنية', data: '/fact' },
          ],
        ],
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error seeding default chats:', err);
    }
  };

  // Real-time listen to chats
  useEffect(() => {
    if (!currentUser) {
      setChats([]);
      setActiveChatId(null);
      setLoadingChats(false);
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
          loadedChats.push({
            ...data,
            id: docSnap.id,
          });
        });

        // Sort by updatedAt descending
        loadedChats.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
        });

        if (loadedChats.length === 0) {
          await seedDefaultChats(currentUser.uid, userProfile?.displayName || 'أنا');
        } else {
          setChats(loadedChats);
          if (!activeChatId && loadedChats.length > 0) {
            setActiveChatId(loadedChats[0].id);
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

  // Real-time listen to messages of active chat
  useEffect(() => {
    if (!currentUser || !activeChatId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    const messagesRef = collection(db, 'chats', activeChatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedMsgs: Message[] = [];
        snapshot.forEach((docSnap) => {
          loadedMsgs.push({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Message, 'id'>),
          });
        });
        setMessages(loadedMsgs);
        setLoadingMessages(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `chats/${activeChatId}/messages`);
        setLoadingMessages(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, activeChatId]);

  // Send message
  const sendMessage = async (text: string, type: MessageType = 'text', extra: Partial<Message> = {}) => {
    if (!currentUser || !activeChatId) return;
    if (!text.trim() && type === 'text') return;

    try {
      const chatDocRef = doc(db, 'chats', activeChatId);
      const messagesRef = collection(db, 'chats', activeChatId, 'messages');

      const newMsgData: Omit<Message, 'id'> = {
        chatId: activeChatId,
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || 'مستخدم',
        senderPhoto: userProfile?.photoURL || '',
        senderColor: userProfile?.avatarColor || '#2481cc',
        text: text.trim(),
        type,
        createdAt: new Date().toISOString(),
        ...(replyingTo
          ? {
              replyToId: replyingTo.id,
              replyToText: replyingTo.text.slice(0, 80),
              replyToSender: replyingTo.senderName,
            }
          : {}),
        ...extra,
      };

      await addDoc(messagesRef, newMsgData);
      tgAudio.playSendSound();
      setReplyingTo(null);

      // Update chat's lastMessage
      await updateDoc(chatDocRef, {
        updatedAt: new Date().toISOString(),
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
              : text.trim(),
          senderId: currentUser.uid,
          senderName: userProfile?.displayName || 'مستخدم',
          createdAt: new Date().toISOString(),
          type,
        },
      });

      // Interactive Telegram Bot Response Simulation
      if (activeChat?.title.includes('Bot') || activeChat?.createdBy === 'system_bot') {
        setTypingStatus('يكتب الآن...');
        setTimeout(async () => {
          let botReply = 'لقد استلمت رسالتك بنجاح! شكراً لتواصلك مع تيليجرام بوت.';
          let inlineButtons: any = undefined;
          const cleanText = text.trim().toLowerCase();

          if (cleanText === '/start') {
            botReply = 'أهلاً بك مجدداً! كيف يمكنني مساعدتك اليوم؟ اختر أمراً أدناه:';
            inlineButtons = [
              [{ text: '⏰ الوقت', data: '/time' }, { text: '🎲 رمي نرد', data: '/dice' }],
              [{ text: '😂 نكتة', data: '/joke' }, { text: '💡 معلومة', data: '/fact' }],
            ];
          } else if (cleanText === '/help') {
            botReply = 'الأوامر المتاحة:\n• /time - معرفة الوقت الحالي\n• /dice - رمي نرد عشوائي\n• /joke - نكتة سريعة\n• /fact - معلومة تقنية\n• /ping - فحص الاستجابة';
          } else if (cleanText === '/time') {
            botReply = `⏰ الوقت الحالي بتوقيتك هو: ${new Date().toLocaleTimeString('ar-SA')}`;
          } else if (cleanText === '/ping') {
            botReply = '🏓 Pong! وقت الاستجابة 14ms عبر شبكة تيليجرام السحابية.';
          } else if (cleanText === '/dice') {
            const val = Math.floor(Math.random() * 6) + 1;
            botReply = `🎲 نتيجتك في رمي النرد هي: ${val} !`;
          } else if (cleanText === '/joke') {
            const jokes = [
              'لماذا يفضل المبرمجون شرب القهوة في الظلام؟ لأن النور يجذب الـ Bugs! 😂',
              'سألوا المبرمج: كيف حال أولادك؟ قال: كلهم شغالين تمام بدون Errors! 💻',
              'المبرمج لا ينام، هو فقط يدخل في وضع Background Task! 😴',
            ];
            botReply = jokes[Math.floor(Math.random() * jokes.length)];
          } else if (cleanText === '/fact') {
            botReply = '💡 هل تعلم؟ تيليجرام يتيح إرسال ملفات بأحجام تصل إلى 2GB ومزامنتها لحظياً بدون فقدان جودة.';
          }

          setTypingStatus(null);
          await addDoc(messagesRef, {
            chatId: activeChatId,
            senderId: 'system_bot',
            senderName: 'Telegram Bot',
            text: botReply,
            type: 'text',
            inlineButtons,
            createdAt: new Date().toISOString(),
          });

          await updateDoc(chatDocRef, {
            updatedAt: new Date().toISOString(),
            lastMessage: {
              text: botReply,
              senderId: 'system_bot',
              senderName: 'Telegram Bot',
              createdAt: new Date().toISOString(),
              type: 'text',
            },
          });

          tgAudio.playReceiveSound();
        }, 1200);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `chats/${activeChatId}/messages`);
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
      confetti({ particleCount: 40, spread: 60 });
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
          confetti({
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

  // Delete message
  const deleteMessage = async (messageId: string) => {
    if (!activeChatId) return;
    try {
      const msgRef = doc(db, 'chats', activeChatId, 'messages', messageId);
      await deleteDoc(msgRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `chats/${activeChatId}/messages/${messageId}`);
    }
  };

  // Vote in poll
  const voteInPoll = async (messageId: string, optionId: string) => {
    if (!currentUser || !activeChatId) return;
    try {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg || !msg.pollData) return;

      const currentPoll: PollData = JSON.parse(JSON.stringify(msg.pollData));
      let totalVotersSet = new Set<string>();

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

  // Create chat (Direct, Group, Channel)
  const createChat = async (chatData: Omit<Chat, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => {
    if (!currentUser) throw new Error('Not logged in');
    try {
      const chatDocRef = doc(collection(db, 'chats'));
      const newChat: Chat = {
        id: chatDocRef.id,
        ...chatData,
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        memberIds: Array.from(new Set([...chatData.memberIds, currentUser.uid])),
      };

      await setDoc(chatDocRef, newChat);

      await addDoc(collection(db, 'chats', chatDocRef.id, 'messages'), {
        chatId: chatDocRef.id,
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || 'مستخدم',
        text:
          newChat.type === 'channel'
            ? `📢 تم إنشاء القناة "${newChat.title}".`
            : newChat.type === 'group'
            ? `👥 أنشأ ${userProfile?.displayName || 'مستخدم'} المجموعة.`
            : `بدأت المحادثة مع ${newChat.title}.`,
        type: 'text',
        createdAt: new Date().toISOString(),
      });

      setActiveChatId(chatDocRef.id);
      return chatDocRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
      throw error;
    }
  };

  return (
    <ChatContext.Provider
      value={{
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
        activeStoryIndex,
        setActiveStoryIndex,
        callState,
        startCall,
        endCall,
        toggleMute,
        toggleCamera,
        typingStatus,
        sendMessage,
        editMessageText,
        toggleReaction,
        pinMessage,
        deleteMessage,
        createChat,
        voteInPoll,
        sendDiceRoll,
        pinnedMessage,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
};
