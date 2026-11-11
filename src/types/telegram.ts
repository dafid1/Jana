export type ChatType = 'direct' | 'group' | 'channel' | 'saved';

export type MessageType = 'text' | 'image' | 'file' | 'voice' | 'sticker' | 'poll' | 'dice';

export interface UserProfile {
  uid: string;
  displayName: string;
  username?: string;
  photoURL?: string;
  avatarColor?: string;
  bio?: string;
  phone?: string;
  isOnline?: boolean;
  lastSeen?: string;
  createdAt?: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // array of user UIDs who voted
}

export interface PollData {
  question: string;
  options: PollOption[];
  isAnonymous?: boolean;
  multipleAnswers?: boolean;
  totalVotes: number;
}

export interface MessageReaction {
  emoji: string;
  users: string[]; // user UIDs
}

export interface InlineButton {
  text: string;
  data: string;
  url?: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  senderColor?: string;
  text: string;
  type: MessageType;
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: string;
  voiceDuration?: number;
  pollData?: PollData;
  replyToId?: string;
  replyToText?: string;
  replyToSender?: string;
  reactions?: Record<string, string[]>; // { "❤️": ["uid1"], "🔥": ["uid2"] }
  isPinned?: boolean;
  isSpoiler?: boolean;
  editedAt?: string;
  inlineButtons?: InlineButton[][];
  diceValue?: number;
  createdAt: string;
  readBy?: string[];
}

export interface Chat {
  id: string;
  type: ChatType;
  title: string;
  photoURL?: string;
  avatarColor?: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberIds: string[];
  membersCount?: number;
  pinnedMessageId?: string;
  lastMessage?: {
    text: string;
    senderId: string;
    senderName: string;
    createdAt: string;
    type?: MessageType;
  };
  unreadCount?: number;
  isMuted?: boolean;
  isPinned?: boolean;
  typingStatus?: string; // e.g. "يكتب الآن...", "يسجل رسالة صوتية..."
}

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  avatarGradient?: string;
  mediaUrl: string;
  caption?: string;
  createdAt: string;
  viewsCount?: number;
}

export type ChatWallpaper = 'classic' | 'night' | 'emerald' | 'purple' | 'desert' | 'mesh';

export type FolderFilter = 'all' | 'direct' | 'group' | 'channel' | 'saved';

export interface CallState {
  isActive: boolean;
  isVideo: boolean;
  status: 'calling' | 'connected' | 'ended';
  duration: number;
  isMuted: boolean;
  isCameraOff: boolean;
  chat: Chat | null;
}
