export type ChatType = 'direct' | 'group' | 'channel' | 'saved';

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'file'
  | 'voice'
  | 'sticker'
  | 'poll'
  | 'dice'
  | 'call';

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
  blockedUserIds?: string[];
  mutedChatIds?: string[];
  pinnedChatIds?: string[];
  privacyHideLastSeen?: boolean;
  autoLockSeconds?: number; // 0 = immediate on background, 30, 60, 300, -1 = off
  screenSecurityEnabled?: boolean;
  discreetNotifications?: boolean;
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

export interface ForwardedFromInfo {
  senderId: string;
  senderName: string;
  chatTitle?: string;
}

export interface LinkPreviewData {
  url: string;
  domain: string;
  title: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

export interface CallLogInfo {
  isVideo: boolean;
  status: 'missed' | 'declined' | 'ended';
  duration: number;
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
  forwardedFrom?: ForwardedFromInfo;
  linkPreview?: LinkPreviewData;
  callInfo?: CallLogInfo;
  reactions?: Record<string, string[]>; // { "❤️": ["uid1"], "🔥": ["uid2"] }
  isPinned?: boolean;
  isSpoiler?: boolean;
  isDeleted?: boolean;
  deletedFor?: string[];
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
  adminIds?: string[];
  bannedIds?: string[];
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
  activity?: 'typing' | 'recording';
  updatedAt: string;
}

export interface GroupInvite {
  inviteCode: string;
  chatId: string;
  chatType?: 'group' | 'channel';
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

export interface CallSessionDescription {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface CallDocument {
  id: string;
  chatId: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  calleeIds: string[];
  isVideo: boolean;
  status: 'ringing' | 'connected' | 'ended' | 'declined' | 'missed';
  offer?: CallSessionDescription;
  answer?: CallSessionDescription;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
}

export interface CallState {
  isActive: boolean;
  callId?: string | null;
  direction?: 'outgoing' | 'incoming';
  isVideo: boolean;
  status: 'calling' | 'ringing' | 'connected' | 'ended' | 'declined';
  duration: number;
  isMuted: boolean;
  isCameraOff: boolean;
  chat: Chat | null;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
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

export interface PendingSharePayload {
  type: 'text' | 'image';
  text?: string;
  dataUrl?: string;
  mimeType?: string;
  fileName?: string;
}
