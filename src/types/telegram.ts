export type ChatType = 'direct' | 'group' | 'channel' | 'saved';

export type MessageType = 'text' | 'image' | 'file' | 'voice' | 'sticker' | 'poll' | 'dice';

export type UserRole = 'admin' | 'user';

export interface UserProfile {
  uid: string;
  username: string; // e.g., "jehan", "ahmed" (lowercase without @)
  displayName: string;
  role: UserRole;
  photoURL?: string;
  avatarColor?: string;
  bio?: string;
  phone?: string;
  isOnline?: boolean;
  lastSeen?: string;
  createdBy?: string;
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
  readBy?: string[]; // Real array of user UIDs who have read this message
}

export interface Chat {
  id: string;
  type: ChatType;
  title: string;
  photoURL?: string;
  avatarColor?: string;
  description?: string;
  inviteCode?: string; // Unique invite code for groups
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
    readBy?: string[];
  };
  unreadCounts?: Record<string, number>;
  unreadCount?: number;
  isMuted?: boolean;
  isPinned?: boolean;
  typingStatus?: string;
}

export interface TypingIndicator {
  uid: string;
  displayName: string;
  isTyping: boolean;
  updatedAt: string;
}

export interface GroupInvite {
  inviteCode: string;
  chatId: string;
  title: string;
  description?: string;
  photoURL?: string;
  createdBy: string;
  createdAt: string;
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
  viewedBy?: string[];
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

export interface StickerItem {
  id: string;
  packId: string;
  emoji: string;
  name: string;
  label: string;
  url: string;
  keywords?: string[];
  isCustom?: boolean;
}

export interface StickerPack {
  id: string;
  title: string;
  icon: string;
  stickers: StickerItem[];
}

export interface UserStickerDoc {
  id: string;
  uid: string;
  emoji: string;
  name: string;
  label: string;
  url: string;
  isCustom: boolean;
  useCount: number;
  lastUsedAt: string;
  createdAt: string;
}
