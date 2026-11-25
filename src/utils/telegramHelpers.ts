export const TG_AVATAR_GRADIENTS = [
  'from-[#e17076] to-[#ff885e]',
  'from-[#549cdd] to-[#43b5e4]',
  'from-[#a674e0] to-[#8c5fd1]',
  'from-[#6dc066] to-[#41a76c]',
  'from-[#e5a643] to-[#e08832]',
  'from-[#65aadd] to-[#488ee0]',
  'from-[#ee7aae] to-[#dc5389]',
];

export function getAvatarGradient(id: string = ''): string {
  if (!id) return TG_AVATAR_GRADIENTS[1];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % TG_AVATAR_GRADIENTS.length;
  return TG_AVATAR_GRADIENTS[index];
}

export function getInitials(name: string = ''): string {
  if (!name) return 'JX';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function formatTelegramTime(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'م' : 'ص';
  const formattedHours = hours % 12 || 12;
  const timeString = `${formattedHours}:${minutes} ${ampm}`;

  if (isToday) return timeString;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return `أمس ${timeString}`;

  return `${date.getDate()}/${date.getMonth() + 1} ${timeString}`;
}

export const ONLINE_THRESHOLD_MS = 60_000;

export function isUserOnlineByLastSeen(
  user?: { lastSeen?: string; isOnline?: boolean; privacyHideLastSeen?: boolean },
  nowMs: number = Date.now()
): boolean {
  if (!user || user.privacyHideLastSeen || !user.lastSeen) return false;
  if (user.isOnline === false) return false;
  const lastSeenMs = new Date(user.lastSeen).getTime();
  if (Number.isNaN(lastSeenMs)) return false;
  return nowMs - lastSeenMs <= ONLINE_THRESHOLD_MS;
}

export function formatLastSeenArabic(lastSeen?: string, nowMs: number = Date.now()): string {
  if (!lastSeen) return '';
  const date = new Date(lastSeen);
  const ts = date.getTime();
  if (Number.isNaN(ts)) return '';

  const diffMs = Math.max(0, nowMs - ts);
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'منذ لحظات';
  if (diffMins < 60) return `منذ ${diffMins} د`;

  const now = new Date(nowMs);
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'م' : 'ص';
  const formattedHours = hours % 12 || 12;
  const timeString = `${formattedHours}:${minutes} ${ampm}`;

  if (isToday) return `اليوم ${timeString}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return `أمس ${timeString}`;

  return `${date.getDate()}/${date.getMonth() + 1} ${timeString}`;
}

export function getMessageReplyPreview(msg?: {
  type?: string;
  text?: string;
  mediaName?: string;
  isDeleted?: boolean;
  pollData?: { question?: string };
}): string {
  if (!msg) return '';
  if (msg.isDeleted) return 'تم حذف هذه الرسالة';
  const trimmed = (msg.text || '').trim();
  if (trimmed) return trimmed;
  switch (msg.type) {
    case 'image':
      return '📷 صورة';
    case 'video':
      return '🎬 فيديو';
    case 'voice':
      return '🎤 رسالة صوتية';
    case 'file':
      return `📎 ${msg.mediaName || 'ملف'}`;
    case 'sticker':
      return msg.mediaName ? `🎨 ملصق: ${msg.mediaName}` : '🎨 ملصق';
    case 'poll':
      return `📊 ${msg.pollData?.question || 'استطلاع رأي'}`;
    case 'dice':
      return '🎲 رمية نرد';
    case 'call':
      return '📞 مكالمة';
    default:
      return 'رسالة';
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function estimateDataUrlBytes(dataUrl?: string): number {
  if (!dataUrl || !dataUrl.startsWith('data:')) return 0;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return 0;
  const base64 = dataUrl.slice(commaIdx + 1);
  let padding = 0;
  if (base64.endsWith('==')) padding = 2;
  else if (base64.endsWith('=')) padding = 1;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function estimateMediaSizeLabel(mediaUrl?: string, mediaSize?: string): string {
  if (mediaSize && mediaSize.trim()) return mediaSize.trim();
  const bytes = estimateDataUrlBytes(mediaUrl);
  if (bytes > 0) return formatBytes(bytes);
  return 'صورة';
}

const DOWNLOADED_MEDIA_PREFIX = 'janax_downloaded_media_';

export function isMediaLocallyDownloaded(uid: string | undefined, messageId: string): boolean {
  try {
    const raw = localStorage.getItem(`${DOWNLOADED_MEDIA_PREFIX}${uid || 'anon'}`);
    if (!raw) return false;
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) && arr.includes(messageId);
  } catch {
    return false;
  }
}

export function markMediaLocallyDownloaded(uid: string | undefined, messageId: string): void {
  try {
    const key = `${DOWNLOADED_MEDIA_PREFIX}${uid || 'anon'}`;
    const raw = localStorage.getItem(key);
    const existing = raw ? (JSON.parse(raw) as string[]) : [];
    const list = Array.isArray(existing) ? existing.filter((id) => id !== messageId) : [];
    list.push(messageId);
    const trimmed = list.length > 300 ? list.slice(list.length - 300) : list;
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota errors
  }
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'JNX-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export interface ParsedInviteTarget {
  inviteCode?: string;
  chatId?: string;
}

export interface TextLinkSegment {
  text: string;
  url?: string;
  inviteTarget?: ParsedInviteTarget | null;
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const INVITE_CODE_REGEX = /^JNX-[A-Z0-9]{4,32}$/i;
const URL_DETECTION_REGEX = /((?:https?:\/\/|www\.)[^\s<>"'`]+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s<>"'`]*)?(?:\?[^\s<>"'`]*)?(?:#[^\s<>"'`]*)?)/gi;

export function sanitizeExternalUrl(rawUrl: string): string | null {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return null;

  // Block dangerous schemes explicitly
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return null;
  }

  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function parseInviteTarget(input: string): ParsedInviteTarget | null {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;

  if (INVITE_CODE_REGEX.test(trimmed)) {
    return { inviteCode: trimmed.toUpperCase() };
  }

  const candidateUrl =
    trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : trimmed.startsWith('?')
      ? `https://janax.app/${trimmed}`
      : trimmed.includes('join=') || trimmed.includes('channel=') || trimmed.includes('group=') || trimmed.includes('/join/')
      ? `https://janax.app/${trimmed.replace(/^\/+/, '')}`
      : '';

  if (candidateUrl) {
    try {
      const parsed = new URL(candidateUrl);
      const joinParam = parsed.searchParams.get('join')?.trim();
      if (joinParam) {
        if (INVITE_CODE_REGEX.test(joinParam)) {
          return { inviteCode: joinParam.toUpperCase() };
        }
        if (VALID_ID_REGEX.test(joinParam)) {
          return { inviteCode: joinParam.toUpperCase(), chatId: joinParam };
        }
      }

      const directChatId =
        parsed.searchParams.get('channel')?.trim() ||
        parsed.searchParams.get('group')?.trim() ||
        parsed.searchParams.get('chat')?.trim();
      if (directChatId && VALID_ID_REGEX.test(directChatId)) {
        return { chatId: directChatId };
      }

      const pathMatch = parsed.pathname.match(/\/join\/([A-Za-z0-9_-]+)/i);
      if (pathMatch?.[1]) {
        const code = pathMatch[1];
        if (INVITE_CODE_REGEX.test(code)) {
          return { inviteCode: code.toUpperCase() };
        }
        if (VALID_ID_REGEX.test(code)) {
          return { chatId: code };
        }
      }
    } catch {
      // Fallback regex check below
    }
  }

  const regexJoin = trimmed.match(/[?&]join=([A-Za-z0-9_-]+)/i);
  if (regexJoin?.[1]) {
    return { inviteCode: regexJoin[1].toUpperCase() };
  }

  const regexChannelOrGroup = trimmed.match(/[?&](?:channel|group|chat)=([A-Za-z0-9_-]+)/i);
  if (regexChannelOrGroup?.[1] && VALID_ID_REGEX.test(regexChannelOrGroup[1])) {
    return { chatId: regexChannelOrGroup[1] };
  }

  return null;
}

export function extractInviteCode(input: string): string {
  const target = parseInviteTarget(input);
  if (target?.inviteCode) return target.inviteCode;
  const trimmed = input.trim();
  if (!trimmed) return '';
  return trimmed.toUpperCase();
}

export function buildChatInviteLink(chat: {
  id: string;
  type?: string;
  inviteCode?: string;
}): string {
  const baseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://janax.app/';
  if (chat.inviteCode) {
    return `${baseUrl}?join=${encodeURIComponent(chat.inviteCode)}`;
  }
  const paramKey = chat.type === 'channel' ? 'channel' : 'group';
  return `${baseUrl}?${paramKey}=${encodeURIComponent(chat.id)}`;
}

function trimTrailingUrlPunctuation(raw: string): { clean: string; trailing: string } {
  let clean = raw;
  let trailing = '';
  const trailingChars = new Set(['.', ',', '،', '؛', ':', '!', '؟', '?', '"', "'", '>', ']', '}']);

  while (clean.length > 0) {
    const lastChar = clean[clean.length - 1];
    if (trailingChars.has(lastChar)) {
      trailing = lastChar + trailing;
      clean = clean.slice(0, -1);
      continue;
    }
    if (lastChar === ')') {
      const openCount = (clean.match(/\(/g) || []).length;
      const closeCount = (clean.match(/\)/g) || []).length;
      if (closeCount > openCount) {
        trailing = lastChar + trailing;
        clean = clean.slice(0, -1);
        continue;
      }
    }
    break;
  }

  return { clean, trailing };
}

export function splitTextWithLinks(text: string): TextLinkSegment[] {
  if (!text) return [];

  const segments: TextLinkSegment[] = [];
  let lastIndex = 0;
  URL_DETECTION_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = URL_DETECTION_REGEX.exec(text)) !== null) {
    const matchIndex = match.index;
    const rawMatch = match[0];

    // Skip email addresses (preceded immediately by '@')
    if (matchIndex > 0 && text[matchIndex - 1] === '@') {
      continue;
    }

    const { clean, trailing } = trimTrailingUrlPunctuation(rawMatch);
    const safeUrl = sanitizeExternalUrl(clean);
    if (!safeUrl) {
      continue;
    }

    if (matchIndex > lastIndex) {
      segments.push({ text: text.slice(lastIndex, matchIndex) });
    }

    const inviteTarget = parseInviteTarget(safeUrl);
    segments.push({
      text: clean,
      url: safeUrl,
      inviteTarget,
    });

    if (trailing) {
      segments.push({ text: trailing });
    }

    lastIndex = matchIndex + rawMatch.length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ text }];
}

export function extractFirstInviteUrl(text: string): string | null {
  if (!text) return null;
  const segments = splitTextWithLinks(text);
  for (const seg of segments) {
    if (seg.url && seg.inviteTarget) {
      return seg.url;
    }
  }
  const trimmed = text.trim();
  if (INVITE_CODE_REGEX.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return null;
}

export async function compressImageFile(
  file: File,
  maxSize = 320,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Sound Synthesizer via Web Audio API
class TelegramAudio {
  private ctx: AudioContext | null = null;
  private ringtoneInterval: NodeJS.Timeout | null = null;

  private getContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playSendSound() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Ignore
    }
  }

  playReceiveSound() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(783.99, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Ignore
    }
  }

  playPopSound() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // Ignore
    }
  }

  playDiceSound() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(300 + Math.random() * 200, this.ctx.currentTime);
          gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start();
          osc.stop(this.ctx.currentTime + 0.04);
        }, i * 60);
      }
    } catch {
      // Ignore
    }
  }

  startCallingTone() {
    this.stopCallingTone();
    const playBeep = () => {
      try {
        const ctx = this.getContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(425, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime + 0.7);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.75);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.75);
      } catch {
        // Ignore
      }
    };
    playBeep();
    this.ringtoneInterval = setInterval(playBeep, 2500);
  }

  stopCallingTone() {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
  }
}

export const tgAudio = new TelegramAudio();

import { ALL_BUILTIN_STICKERS } from './stickers';

export const TG_STICKERS = ALL_BUILTIN_STICKERS;

export const QUICK_REACTIONS = ['❤️', '👍', '🔥', '🎉', '👏', '😂', '😍', '🤔', '💩', '⚡️'];

export const CALL_ENCRYPTION_EMOJIS = ['🔐', '🍋', '🚀', '🐱', '💎', '🍉', '⭐️', '🎯'];
