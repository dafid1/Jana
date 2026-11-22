import { StickerItem, StickerPack } from '../types/telegram';

function buildStickerSvg(
  id: string,
  bgFrom: string,
  bgTo: string,
  innerSvg: string
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="180" height="180">
  <defs>
    <linearGradient id="g-${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgFrom}"/>
      <stop offset="100%" stop-color="${bgTo}"/>
    </linearGradient>
    <filter id="ds-${id}" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.22"/>
    </filter>
  </defs>
  <g filter="url(#ds-${id})">
    <circle cx="90" cy="90" r="74" fill="#ffffff"/>
    <circle cx="90" cy="90" r="66" fill="url(#g-${id})"/>
    <ellipse cx="70" cy="50" rx="34" ry="14" transform="rotate(-20 70 50)" fill="rgba(255,255,255,0.22)"/>
  </g>
  ${innerSvg}
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const STICKER_PACKS: StickerPack[] = [
  {
    id: 'greetings',
    title: 'مشاعر وتحيات',
    icon: '👋',
    stickers: [
      {
        id: 'greet-hello',
        packId: 'greetings',
        emoji: '👋',
        name: 'Hello',
        label: 'مرحباً!',
        keywords: ['اهلا', 'مرحبا', 'سلام', 'hello', 'hi'],
        url: buildStickerSvg(
          'greet-hello',
          '#38bdf8',
          '#2563eb',
          `<g transform="translate(90,94)">
            <circle cx="0" cy="0" r="36" fill="#fde047" stroke="#f59e0b" stroke-width="3"/>
            <circle cx="-12" cy="-7" r="4.5" fill="#1e293b"/>
            <circle cx="12" cy="-7" r="4.5" fill="#1e293b"/>
            <circle cx="-13.5" cy="-8.5" r="1.5" fill="#ffffff"/>
            <circle cx="10.5" cy="-8.5" r="1.5" fill="#ffffff"/>
            <path d="M-14 8 Q0 22 14 8" fill="none" stroke="#1e293b" stroke-width="4" stroke-linecap="round"/>
            <circle cx="-21" cy="3" r="5" fill="#fb7185" opacity="0.55"/>
            <circle cx="21" cy="3" r="5" fill="#fb7185" opacity="0.55"/>
            <g transform="translate(38,-22) rotate(15)">
              <rect x="-8" y="-14" width="16" height="22" rx="8" fill="#fde047" stroke="#f59e0b" stroke-width="2.5"/>
              <path d="M-4 -14 V-22 M0 -15 V-24 M4 -14 V-21" stroke="#f59e0b" stroke-width="3.5" stroke-linecap="round"/>
            </g>
          </g>`
        ),
      },
      {
        id: 'greet-love',
        packId: 'greetings',
        emoji: '❤️',
        name: 'Love',
        label: 'أحب هذا',
        keywords: ['حب', 'قلب', 'love', 'heart'],
        url: buildStickerSvg(
          'greet-love',
          '#fda4af',
          '#e11d48',
          `<g transform="translate(90,96)">
            <path d="M0 34 C-38 8 -46 -22 -24 -34 C-10 -41 0 -28 0 -22 C0 -28 10 -41 24 -34 C46 -22 38 8 0 34 Z" fill="#ffffff" opacity="0.96"/>
            <path d="M0 28 C-32 6 -38 -19 -20 -29 C-8 -35 0 -23 0 -17 C0 -23 8 -35 20 -29 C38 -19 32 6 0 28 Z" fill="#f43f5e"/>
            <ellipse cx="-14" cy="-16" rx="7" ry="4" transform="rotate(-30 -14 -16)" fill="rgba(255,255,255,0.45)"/>
            <path d="M32 -34 L35 -26 L43 -23 L35 -20 L32 -12 L29 -20 L21 -23 L29 -26 Z" fill="#fef08a"/>
          </g>`
        ),
      },
      {
        id: 'greet-cool',
        packId: 'greetings',
        emoji: '😎',
        name: 'Cool',
        label: 'رائع جداً',
        keywords: ['رائع', 'فخم', 'نظارة', 'cool'],
        url: buildStickerSvg(
          'greet-cool',
          '#6366f1',
          '#312e81',
          `<g transform="translate(90,92)">
            <circle cx="0" cy="0" r="38" fill="#facc15" stroke="#eab308" stroke-width="3"/>
            <rect x="-32" y="-14" width="28" height="16" rx="5" fill="#0f172a"/>
            <rect x="4" y="-14" width="28" height="16" rx="5" fill="#0f172a"/>
            <rect x="-4" y="-10" width="8" height="4" fill="#0f172a"/>
            <path d="M-27 -10 L-16 -2" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M9 -10 L20 -2" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M-12 12 Q2 21 17 9" fill="none" stroke="#1e293b" stroke-width="4" stroke-linecap="round"/>
          </g>`
        ),
      },
      {
        id: 'greet-laugh',
        packId: 'greetings',
        emoji: '😂',
        name: 'Laugh',
        label: 'هههه',
        keywords: ['ضحك', 'ههه', 'مضحك', 'laugh', 'lol'],
        url: buildStickerSvg(
          'greet-laugh',
          '#fb923c',
          '#ea580c',
          `<g transform="translate(90,92)">
            <circle cx="0" cy="0" r="38" fill="#fde047" stroke="#f59e0b" stroke-width="3"/>
            <path d="M-22 -12 L-10 -6 L-22 0" fill="none" stroke="#1e293b" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M22 -12 L10 -6 L22 0" fill="none" stroke="#1e293b" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M-20 7 Q0 30 20 7 Z" fill="#991b1b" stroke="#1e293b" stroke-width="2.5"/>
            <path d="M-14 8 H14 V13 H-14 Z" fill="#ffffff"/>
            <path d="M-34 2 C-44 10 -40 22 -30 16 C-26 13 -28 5 -34 2 Z" fill="#38bdf8"/>
            <path d="M34 2 C44 10 40 22 30 16 C26 13 28 5 34 2 Z" fill="#38bdf8"/>
          </g>`
        ),
      },
      {
        id: 'greet-thanks',
        packId: 'greetings',
        emoji: '🙏',
        name: 'Thanks',
        label: 'شكراً لك',
        keywords: ['شكرا', 'تسلم', 'ممتن', 'thanks'],
        url: buildStickerSvg(
          'greet-thanks',
          '#34d399',
          '#059669',
          `<g transform="translate(90,92)">
            <path d="M-4 -34 C-12 -34 -18 -26 -18 -14 L-18 14 C-18 22 -10 28 -2 28 L-2 -34 Z" fill="#fde68a" stroke="#d97706" stroke-width="2.5"/>
            <path d="M4 -34 C12 -34 18 -26 18 -14 L18 14 C18 22 10 28 2 28 L2 -34 Z" fill="#fcd34d" stroke="#d97706" stroke-width="2.5"/>
            <rect x="-22" y="20" width="44" height="14" rx="7" fill="#ffffff" opacity="0.9"/>
            <path d="M-30 -28 L-24 -22 M30 -28 L24 -22 M0 -46 V-39" stroke="#fef08a" stroke-width="3.5" stroke-linecap="round"/>
          </g>`
        ),
      },
      {
        id: 'greet-party',
        packId: 'greetings',
        emoji: '🎉',
        name: 'Party',
        label: 'مبروك!',
        keywords: ['مبروك', 'حفلة', 'تهاني', 'party', 'congrats'],
        url: buildStickerSvg(
          'greet-party',
          '#f472b6',
          '#9333ea',
          `<g transform="translate(90,94)">
            <path d="M-28 30 L-10 -24 L26 12 Z" fill="#facc15" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>
            <path d="M-20 8 L-2 22 M-14 -8 L10 10" stroke="#ea580c" stroke-width="3" stroke-linecap="round"/>
            <circle cx="18" cy="-24" r="5" fill="#38bdf8"/>
            <circle cx="34" cy="-6" r="4.5" fill="#4ade80"/>
            <circle cx="-12" cy="-34" r="4" fill="#fef08a"/>
            <path d="M6 -34 Q18 -38 24 -28" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
            <path d="M22 -14 Q34 -16 38 -2" fill="none" stroke="#fde047" stroke-width="3" stroke-linecap="round"/>
          </g>`
        ),
      },
    ],
  },
  {
    id: 'work',
    title: 'عمل وإنجاز',
    icon: '🚀',
    stickers: [
      {
        id: 'work-rocket',
        packId: 'work',
        emoji: '🚀',
        name: 'Rocket',
        label: 'انطلاق!',
        keywords: ['انطلاق', 'صاروخ', 'سريع', 'rocket', 'launch'],
        url: buildStickerSvg(
          'work-rocket',
          '#0ea5e9',
          '#1e3a8a',
          `<g transform="translate(90,92) rotate(-35)">
            <path d="M0 -42 C18 -20 18 14 10 26 H-10 C-18 14 -18 -20 0 -42 Z" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
            <path d="M0 -42 C9 -28 12 -18 13 -12 H-13 C-12 -18 -9 -28 0 -42 Z" fill="#ef4444"/>
            <circle cx="0" cy="-2" r="8" fill="#38bdf8" stroke="#0f172a" stroke-width="2.5"/>
            <path d="M-12 10 L-24 26 L-10 24 Z" fill="#ef4444"/>
            <path d="M12 10 L24 26 L10 24 Z" fill="#ef4444"/>
            <path d="M-6 26 Q0 48 6 26 Z" fill="#facc15"/>
          </g>`
        ),
      },
      {
        id: 'work-coffee',
        packId: 'work',
        emoji: '☕️',
        name: 'Coffee',
        label: 'استراحة قهوة',
        keywords: ['قهوة', 'شاي', 'استراحة', 'coffee'],
        url: buildStickerSvg(
          'work-coffee',
          '#d97706',
          '#78350f',
          `<g transform="translate(90,98)">
            <path d="M-26 -14 H22 V14 C22 26 12 34 0 34 C-14 34 -26 26 -26 14 Z" fill="#ffffff"/>
            <path d="M22 -8 H30 C36 -8 38 6 30 12 H22" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
            <ellipse cx="-2" cy="-14" rx="24" ry="7" fill="#6b3410"/>
            <path d="M-12 -32 Q-6 -40 -12 -46 M0 -30 Q6 -38 0 -46 M12 -32 Q18 -40 12 -46" fill="none" stroke="#fef3c7" stroke-width="3" stroke-linecap="round"/>
          </g>`
        ),
      },
      {
        id: 'work-idea',
        packId: 'work',
        emoji: '💡',
        name: 'Idea',
        label: 'فكرة رائعة',
        keywords: ['فكرة', 'مصباح', 'ذكاء', 'idea'],
        url: buildStickerSvg(
          'work-idea',
          '#facc15',
          '#ca8a04',
          `<g transform="translate(90,94)">
            <path d="M0 -34 C-18 -34 -28 -20 -28 -4 C-28 8 -18 16 -14 24 H14 C18 16 28 8 28 -4 C28 -20 18 -34 0 -34 Z" fill="#fef9c3" stroke="#ffffff" stroke-width="3"/>
            <rect x="-11" y="25" width="22" height="10" rx="3" fill="#475569"/>
            <rect x="-8" y="36" width="16" height="5" rx="2.5" fill="#334155"/>
            <path d="M-7 0 L0 -12 L7 0" fill="none" stroke="#eab308" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M-40 -6 H-33 M33 -6 H40 M0 -48 V-41 M-30 -32 L-24 -27 M30 -32 L24 -27" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>
          </g>`
        ),
      },
      {
        id: 'work-done',
        packId: 'work',
        emoji: '✅',
        name: 'Done',
        label: 'تم الإنجاز',
        keywords: ['تم', 'ممتاز', 'صح', 'نجاح', 'done'],
        url: buildStickerSvg(
          'work-done',
          '#22c55e',
          '#15803d',
          `<g transform="translate(90,90)">
            <circle cx="0" cy="0" r="38" fill="rgba(255,255,255,0.18)" stroke="#ffffff" stroke-width="3"/>
            <path d="M-18 2 L-4 16 L22 -14" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
          </g>`
        ),
      },
      {
        id: 'work-focus',
        packId: 'work',
        emoji: '💻',
        name: 'Focus',
        label: 'وضع التركيز',
        keywords: ['عمل', 'تركيز', 'برمجة', 'لابتوب', 'work'],
        url: buildStickerSvg(
          'work-focus',
          '#334155',
          '#0f172a',
          `<g transform="translate(90,92)">
            <rect x="-32" y="-22" width="64" height="40" rx="6" fill="#38bdf8" stroke="#f8fafc" stroke-width="3"/>
            <path d="M-40 20 H40 L34 30 H-34 Z" fill="#e2e8f0"/>
            <path d="M-18 -8 L-24 -2 L-18 4 M18 -8 L24 -2 L18 4 M-4 6 L4 -10" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          </g>`
        ),
      },
      {
        id: 'work-target',
        packId: 'work',
        emoji: '🎯',
        name: 'Target',
        label: 'في الصميم',
        keywords: ['هدف', 'دقة', 'نجاح', 'target'],
        url: buildStickerSvg(
          'work-target',
          '#f43f5e',
          '#9f1239',
          `<g transform="translate(90,90)">
            <circle cx="0" cy="0" r="38" fill="#ffffff"/>
            <circle cx="0" cy="0" r="27" fill="#ef4444"/>
            <circle cx="0" cy="0" r="16" fill="#ffffff"/>
            <circle cx="0" cy="0" r="7" fill="#ef4444"/>
            <path d="M6 -6 L34 -34" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>
            <path d="M30 -30 L38 -32 L36 -24 Z" fill="#facc15"/>
          </g>`
        ),
      },
    ],
  },
  {
    id: 'reactions',
    title: 'ردود سريعة',
    icon: '🔥',
    stickers: [
      {
        id: 'react-fire',
        packId: 'reactions',
        emoji: '🔥',
        name: 'Fire',
        label: 'مذهل!',
        keywords: ['نار', 'حماس', 'مذهل', 'fire', 'hot'],
        url: buildStickerSvg(
          'react-fire',
          '#fb923c',
          '#b91c1c',
          `<g transform="translate(90,96)">
            <path d="M0 -44 C18 -26 32 -12 32 8 C32 26 18 38 0 38 C-18 38 -32 26 -32 8 C-32 -8 -20 -20 -14 -26 C-12 -14 -6 -10 -4 -18 C-2 -28 2 -36 0 -44 Z" fill="#fef08a"/>
            <path d="M0 -20 C12 -6 18 4 18 14 C18 26 10 34 0 34 C-10 34 -18 26 -18 14 C-18 4 -10 -4 0 -20 Z" fill="#f97316"/>
            <path d="M0 4 C6 10 9 16 9 22 C9 29 5 34 0 34 C-5 34 -9 29 -9 22 C-9 16 -5 10 0 4 Z" fill="#ffffff" opacity="0.85"/>
          </g>`
        ),
      },
      {
        id: 'react-100',
        packId: 'reactions',
        emoji: '💯',
        name: '100',
        label: 'موافق 100%',
        keywords: ['مئة', 'موافق', 'اكيد', '100'],
        url: buildStickerSvg(
          'react-100',
          '#ef4444',
          '#991b1b',
          `<g transform="translate(90,94) rotate(-8)">
            <path d="M-34 -16 V12 M-18 -16 H-4 V12 H-18 Z M6 -16 H20 V12 H6 Z" fill="none" stroke="#ffffff" stroke-width="6.5" stroke-linejoin="round" stroke-linecap="round"/>
            <path d="M-36 24 Q0 18 36 22" fill="none" stroke="#fef08a" stroke-width="5" stroke-linecap="round"/>
            <path d="M-30 33 Q0 28 32 31" fill="none" stroke="#fef08a" stroke-width="4" stroke-linecap="round"/>
          </g>`
        ),
      },
      {
        id: 'react-star',
        packId: 'reactions',
        emoji: '🌟',
        name: 'Star',
        label: 'نجم!',
        keywords: ['نجم', 'مبدع', 'متألق', 'star'],
        url: buildStickerSvg(
          'react-star',
          '#8b5cf6',
          '#4c1d95',
          `<g transform="translate(90,92)">
            <path d="M0 -40 L11 -13 L40 -11 L17 7 L25 36 L0 20 L-25 36 L-17 7 L-40 -11 L-11 -13 Z" fill="#fde047" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>
            <circle cx="-9" cy="-2" r="3.5" fill="#1e293b"/>
            <circle cx="9" cy="-2" r="3.5" fill="#1e293b"/>
            <path d="M-7 8 Q0 14 7 8" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>
          </g>`
        ),
      },
      {
        id: 'react-think',
        packId: 'reactions',
        emoji: '🤔',
        name: 'Think',
        label: 'أممم...',
        keywords: ['تفكير', 'سؤال', 'امم', 'think'],
        url: buildStickerSvg(
          'react-think',
          '#14b8a6',
          '#0f766e',
          `<g transform="translate(90,92)">
            <circle cx="0" cy="0" r="36" fill="#fde047" stroke="#f59e0b" stroke-width="3"/>
            <path d="M-18 -14 Q-10 -18 -4 -12" fill="none" stroke="#1e293b" stroke-width="3.5" stroke-linecap="round"/>
            <path d="M6 -10 H18" fill="none" stroke="#1e293b" stroke-width="3.5" stroke-linecap="round"/>
            <circle cx="-11" cy="-5" r="4" fill="#1e293b"/>
            <circle cx="12" cy="-3" r="4" fill="#1e293b"/>
            <path d="M-10 13 Q2 9 12 14" fill="none" stroke="#1e293b" stroke-width="3.5" stroke-linecap="round"/>
            <path d="M-16 26 Q-10 16 -2 18 L2 28" fill="none" stroke="#d97706" stroke-width="5" stroke-linecap="round"/>
          </g>`
        ),
      },
      {
        id: 'react-bolt',
        packId: 'reactions',
        emoji: '⚡️',
        name: 'Bolt',
        label: 'برق!',
        keywords: ['سريع', 'طاقة', 'برق', 'bolt', 'fast'],
        url: buildStickerSvg(
          'react-bolt',
          '#3b82f6',
          '#1d4ed8',
          `<g transform="translate(90,90)">
            <path d="M8 -42 L-24 4 H-2 L-10 42 L26 -6 H4 Z" fill="#fde047" stroke="#ffffff" stroke-width="3.5" stroke-linejoin="round"/>
          </g>`
        ),
      },
      {
        id: 'react-ok',
        packId: 'reactions',
        emoji: '👍',
        name: 'ThumbsUp',
        label: 'تمام!',
        keywords: ['تمام', 'اوكي', 'موافق', 'ok', 'like'],
        url: buildStickerSvg(
          'react-ok',
          '#06b6d4',
          '#0369a1',
          `<g transform="translate(90,94)">
            <rect x="-32" y="-2" width="14" height="32" rx="4" fill="#ffffff"/>
            <path d="M-16 -2 L-4 -32 C2 -36 10 -30 8 -20 L5 -6 H26 C32 -6 36 0 34 6 L28 24 C26 28 22 30 16 30 H-16 Z" fill="#fde047" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
          </g>`
        ),
      },
    ],
  },
  {
    id: 'mascots',
    title: 'شخصيات لطيفة',
    icon: '🐱',
    stickers: [
      {
        id: 'pet-duck',
        packId: 'mascots',
        emoji: '🦆',
        name: 'Duck',
        label: 'بطة مرحة',
        keywords: ['بطة', 'كيوت', 'تيليجرام', 'duck'],
        url: buildStickerSvg(
          'pet-duck',
          '#a78bfa',
          '#6d28d9',
          `<g transform="translate(90,96)">
            <circle cx="0" cy="-2" r="34" fill="#fde047" stroke="#eab308" stroke-width="2.5"/>
            <path d="M-6 -36 Q0 -48 8 -34" fill="none" stroke="#eab308" stroke-width="4" stroke-linecap="round"/>
            <circle cx="-13" cy="-10" r="4.5" fill="#1e293b"/>
            <circle cx="13" cy="-10" r="4.5" fill="#1e293b"/>
            <circle cx="-14.5" cy="-11.5" r="1.5" fill="#ffffff"/>
            <circle cx="11.5" cy="-11.5" r="1.5" fill="#ffffff"/>
            <ellipse cx="0" cy="4" rx="16" ry="9" fill="#f97316" stroke="#ea580c" stroke-width="2"/>
            <path d="M-12 4 Q0 10 12 4" fill="none" stroke="#9a3412" stroke-width="2"/>
          </g>`
        ),
      },
      {
        id: 'pet-cat',
        packId: 'mascots',
        emoji: '🐱',
        name: 'Cat',
        label: 'قطة سعيدة',
        keywords: ['قطة', 'بسه', 'قط', 'cat'],
        url: buildStickerSvg(
          'pet-cat',
          '#f9a8d4',
          '#db2777',
          `<g transform="translate(90,98)">
            <path d="M-30 -18 L-34 -42 L-10 -28 Z" fill="#fef3c7" stroke="#f59e0b" stroke-width="2.5"/>
            <path d="M30 -18 L34 -42 L10 -28 Z" fill="#fef3c7" stroke="#f59e0b" stroke-width="2.5"/>
            <ellipse cx="0" cy="-2" rx="36" ry="30" fill="#fef3c7" stroke="#f59e0b" stroke-width="2.5"/>
            <circle cx="-13" cy="-6" r="4.5" fill="#1e293b"/>
            <circle cx="13" cy="-6" r="4.5" fill="#1e293b"/>
            <path d="M-4 4 L4 4 L0 9 Z" fill="#fb7185"/>
            <path d="M-10 13 Q-5 17 0 11 Q5 17 10 13" fill="none" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M-38 -2 H-24 M-38 6 H-24 M24 -2 H38 M24 6 H38" stroke="#92400e" stroke-width="2" stroke-linecap="round"/>
          </g>`
        ),
      },
      {
        id: 'pet-bear',
        packId: 'mascots',
        emoji: '🐻',
        name: 'Bear',
        label: 'دب ودود',
        keywords: ['دب', 'عسل', 'bear'],
        url: buildStickerSvg(
          'pet-bear',
          '#86efac',
          '#16a34a',
          `<g transform="translate(90,96)">
            <circle cx="-24" cy="-24" r="13" fill="#92400e"/>
            <circle cx="24" cy="-24" r="13" fill="#92400e"/>
            <circle cx="-24" cy="-24" r="7" fill="#fcd34d"/>
            <circle cx="24" cy="-24" r="7" fill="#fcd34d"/>
            <circle cx="0" cy="0" r="34" fill="#b45309"/>
            <ellipse cx="0" cy="10" rx="16" ry="12" fill="#fde68a"/>
            <circle cx="-13" cy="-8" r="4" fill="#1e293b"/>
            <circle cx="13" cy="-8" r="4" fill="#1e293b"/>
            <ellipse cx="0" cy="5" rx="6" ry="4" fill="#1e293b"/>
            <path d="M-6 13 Q0 18 6 13" fill="none" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>
          </g>`
        ),
      },
      {
        id: 'pet-bunny',
        packId: 'mascots',
        emoji: '🐰',
        name: 'Bunny',
        label: 'أرنب لطيف',
        keywords: ['ارنب', 'لطيف', 'bunny', 'rabbit'],
        url: buildStickerSvg(
          'pet-bunny',
          '#7dd3fc',
          '#0284c7',
          `<g transform="translate(90,104)">
            <ellipse cx="-14" cy="-38" rx="9" ry="22" transform="rotate(-8 -14 -38)" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
            <ellipse cx="14" cy="-38" rx="9" ry="22" transform="rotate(8 14 -38)" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
            <ellipse cx="-14" cy="-38" rx="4.5" ry="14" transform="rotate(-8 -14 -38)" fill="#fbcfe8"/>
            <ellipse cx="14" cy="-38" rx="4.5" ry="14" transform="rotate(8 14 -38)" fill="#fbcfe8"/>
            <ellipse cx="0" cy="-6" rx="34" ry="27" fill="#ffffff"/>
            <circle cx="-12" cy="-10" r="4" fill="#1e293b"/>
            <circle cx="12" cy="-10" r="4" fill="#1e293b"/>
            <ellipse cx="0" cy="-2" rx="4" ry="3" fill="#f472b6"/>
            <path d="M-7 5 Q0 10 7 5" fill="none" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round"/>
          </g>`
        ),
      },
      {
        id: 'pet-fox',
        packId: 'mascots',
        emoji: '🦊',
        name: 'Fox',
        label: 'ثعلب ذكي',
        keywords: ['ثعلب', 'ذكي', 'fox'],
        url: buildStickerSvg(
          'pet-fox',
          '#6ee7b7',
          '#0d9488',
          `<g transform="translate(90,96)">
            <path d="M-32 -14 L-30 -40 L-10 -24 Z" fill="#ea580c"/>
            <path d="M32 -14 L30 -40 L10 -24 Z" fill="#ea580c"/>
            <path d="M-34 0 C-34 -22 34 -22 34 0 L0 32 Z" fill="#f97316"/>
            <path d="M-34 0 L-12 0 L0 32 Z" fill="#ffffff"/>
            <path d="M34 0 L12 0 L0 32 Z" fill="#ffffff"/>
            <circle cx="-12" cy="-6" r="4" fill="#0f172a"/>
            <circle cx="12" cy="-6" r="4" fill="#0f172a"/>
            <circle cx="0" cy="27" r="4.5" fill="#0f172a"/>
          </g>`
        ),
      },
      {
        id: 'pet-owl',
        packId: 'mascots',
        emoji: '🦉',
        name: 'Owl',
        label: 'بومة حكيمة',
        keywords: ['بومة', 'سهر', 'حكمة', 'owl'],
        url: buildStickerSvg(
          'pet-owl',
          '#475569',
          '#1e293b',
          `<g transform="translate(90,94)">
            <ellipse cx="0" cy="2" rx="34" ry="36" fill="#6366f1"/>
            <circle cx="-13" cy="-8" r="13" fill="#ffffff"/>
            <circle cx="13" cy="-8" r="13" fill="#ffffff"/>
            <circle cx="-12" cy="-8" r="6" fill="#0f172a"/>
            <circle cx="12" cy="-8" r="6" fill="#0f172a"/>
            <circle cx="-14" cy="-10" r="2" fill="#ffffff"/>
            <circle cx="10" cy="-10" r="2" fill="#ffffff"/>
            <path d="M-5 2 L5 2 L0 11 Z" fill="#facc15"/>
            <ellipse cx="0" cy="24" rx="18" ry="12" fill="#c7d2fe"/>
          </g>`
        ),
      },
    ],
  },
];

export const ALL_BUILTIN_STICKERS: StickerItem[] = STICKER_PACKS.flatMap(
  (pack) => pack.stickers
);
