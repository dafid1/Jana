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
  if (!name) return 'TG';
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

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Telegram Sound Synthesizer via Web Audio API (Native, works offline without loading audio assets)
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
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio autoplay restrictions or unsupported
    }
  }

  playReceiveSound() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(783.99, ctx.currentTime); // G5
      osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1); // C6
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Ignore audio failure
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
        osc.frequency.setValueAtTime(425, ctx.currentTime); // Standard ringback
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

// High Quality Telegram Stickers (SVG / Graphic Illustrations)
export const TG_STICKERS = [
  { id: 'duck-hi', emoji: '👋', name: 'Duck Hello', url: 'https://images.unsplash.com/photo-1555685812-4b943f1cb0eb?auto=format&fit=crop&w=300&q=80', label: 'مرحباً!' },
  { id: 'duck-love', emoji: '❤️', name: 'Love Duck', url: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=300&q=80', label: 'أحب هذا' },
  { id: 'cool-cat', emoji: '😎', name: 'Cool Cat', url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=300&q=80', label: 'رائع!' },
  { id: 'fire-rocket', emoji: '🚀', name: 'To The Moon', url: 'https://images.unsplash.com/photo-1517976487507-5b3a4a60032b?auto=format&fit=crop&w=300&q=80', label: 'انطلاق' },
  { id: 'happy-dog', emoji: '🎉', name: 'Celebration', url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=300&q=80', label: 'مبروك!' },
  { id: 'coffee-dev', emoji: '☕️', name: 'Coffee Time', url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=300&q=80', label: 'استراحة قهوة' },
];

export const QUICK_REACTIONS = ['❤️', '👍', '🔥', '🎉', '👏', '😂', '😍', '🤔', '💩', '⚡️'];

export const CALL_ENCRYPTION_EMOJIS = ['🔐', '🍋', '🚀', '🐱', '💎', '🍉', '⭐️', '🎯'];
