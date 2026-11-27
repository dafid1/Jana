import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowRight,
  Search,
  X,
  Users,
  Megaphone,
  Link2,
  UserPlus,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import {
  formatLastSeenArabic,
  getAvatarGradient,
  getInitials,
  isUserOnlineByLastSeen,
} from '../../utils/telegramHelpers';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdminUsers?: () => void;
  onOpenNewGroup?: () => void;
  onOpenNewChannel?: () => void;
  onOpenJoinGroup?: () => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  onClose,
  onOpenAdminUsers,
  onOpenNewGroup,
  onOpenNewChannel,
  onOpenJoinGroup,
}) => {
  const { theme, currentUser, allUsers, isAdmin } = useAuth();
  const { startDirectChat } = useChat();

  const [queryText, setQueryText] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [startingUid, setStartingUid] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQueryText('');
      setIsSearchOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isSearchOpen) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [isSearchOpen]);

  if (!isOpen) return null;

  const isLight = theme === 'light';
  const otherUsers = allUsers.filter((u) => u.uid !== currentUser?.uid);
  const filteredUsers = otherUsers.filter((u) => {
    if (!queryText.trim()) return true;
    const q = queryText.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.bio || '').toLowerCase().includes(q)
    );
  });

  const handleSelectUser = async (userId: string) => {
    const target = otherUsers.find((u) => u.uid === userId);
    if (!target) return;
    setStartingUid(userId);
    try {
      await startDirectChat(target);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setStartingUid(null);
    }
  };

  return (
    <div
      className={`absolute inset-0 z-30 flex flex-col select-none animate-in fade-in slide-in-from-left-4 duration-200 ${
        isLight ? 'bg-white text-slate-900' : 'bg-[#111923] text-white'
      }`}
    >
      {/* Telegram Top App Bar */}
      <header
        className={`h-14 px-2 flex items-center justify-between gap-2 shrink-0 border-b ${
          isLight
            ? 'bg-white border-slate-200/80'
            : 'bg-[#17212b] border-white/[0.06]'
        }`}
      >
        {isSearchOpen ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(false);
                setQueryText('');
              }}
              aria-label="إغلاق البحث"
              className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isLight
                  ? 'text-slate-600 hover:bg-slate-100'
                  : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <input
              ref={searchInputRef}
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="بحث في جهات الاتصال..."
              className={`flex-1 bg-transparent text-sm outline-none placeholder:text-[#7f91a4] ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}
            />
            {queryText && (
              <button
                type="button"
                onClick={() => setQueryText('')}
                aria-label="مسح البحث"
                className="min-h-[40px] min-w-[40px] rounded-full flex items-center justify-center text-[#7f91a4] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 min-w-0">
              <button
                type="button"
                onClick={onClose}
                aria-label="رجوع"
                className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  isLight
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <h2 className="text-base font-bold truncate">رسالة جديدة</h2>
            </div>

            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="بحث عن مستخدم"
              className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                isLight
                  ? 'text-slate-600 hover:bg-slate-100'
                  : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Search className="w-5 h-5" />
            </button>
          </>
        )}
      </header>

      {/* Scrollable Telegram Compose Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Telegram Quick Actions (New Group / New Channel / Join Link) */}
        {!queryText.trim() && (
          <div className="py-1">
            {onOpenNewGroup && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenNewGroup();
                }}
                className={`w-full min-h-[52px] px-4 flex items-center gap-4 text-right transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-slate-100/80 active:bg-slate-200/70' : 'hover:bg-white/[0.05] active:bg-white/[0.08]'
                }`}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-[#2481cc] shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium">مجموعة جديدة</span>
              </button>
            )}

            {onOpenNewChannel && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenNewChannel();
                }}
                className={`w-full min-h-[52px] px-4 flex items-center gap-4 text-right transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-slate-100/80 active:bg-slate-200/70' : 'hover:bg-white/[0.05] active:bg-white/[0.08]'
                }`}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-[#2481cc] shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium">قناة جديدة</span>
              </button>
            )}

            {onOpenJoinGroup && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenJoinGroup();
                }}
                className={`w-full min-h-[52px] px-4 flex items-center gap-4 text-right transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-slate-100/80 active:bg-slate-200/70' : 'hover:bg-white/[0.05] active:bg-white/[0.08]'
                }`}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-[#2481cc] shrink-0">
                  <Link2 className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium">انضمام برابط دعوة</span>
              </button>
            )}
          </div>
        )}

        {/* Section Header */}
        <div
          className={`px-4 py-2 text-xs font-semibold border-y ${
            isLight
              ? 'bg-slate-100/80 border-slate-200/70 text-slate-500'
              : 'bg-[#0b1118]/70 border-white/[0.04] text-[#7f91a4]'
          }`}
        >
          {queryText.trim() ? 'نتائج البحث' : 'جهات الاتصال المسجلة'}
        </div>

        {/* Registered Users List */}
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12 px-6">
            <p className="text-sm font-semibold mb-1.5">
              {otherUsers.length === 0
                ? 'لا توجد حسابات أخرى مسجلة بعد'
                : 'لم يتم العثور على مستخدم بهذا الاسم'}
            </p>
            <p className="text-xs text-[#7f91a4] leading-relaxed max-w-xs mx-auto">
              {isAdmin
                ? 'يمكنك إنشاء حسابات جديدة للمستخدمين من لوحة الأدمن ليتمكنوا من المراسلة.'
                : 'يقوم الأدمن بإنشاء الحسابات الجديدة لتظهر هنا تلقائياً.'}
            </p>
            {isAdmin && onOpenAdminUsers && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdminUsers();
                }}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2481cc] hover:bg-[#1e6fb1] text-white text-xs font-bold cursor-pointer transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>إنشاء حسابات جديدة</span>
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-transparent">
            {filteredUsers.map((user) => {
              const online = !user.privacyHideLastSeen && isUserOnlineByLastSeen(user);
              const lastSeenLabel = user.privacyHideLastSeen
                ? 'آخر ظهور مخفي'
                : online
                ? 'متصل الآن'
                : formatLastSeenArabic(user.lastSeen)
                ? `آخر ظهور ${formatLastSeenArabic(user.lastSeen)}`
                : user.phone && user.username.startsWith('p_')
                ? user.phone
                : `@${user.username}`;

              return (
                <button
                  type="button"
                  key={user.uid}
                  disabled={startingUid === user.uid}
                  onClick={() => handleSelectUser(user.uid)}
                  className={`w-full min-h-[62px] px-4 py-2 flex items-center gap-3.5 transition-colors text-right cursor-pointer disabled:opacity-50 ${
                    isLight
                      ? 'hover:bg-slate-100/80 active:bg-slate-200/70'
                      : 'hover:bg-white/[0.04] active:bg-white/[0.07]'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm text-white overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                        user.uid
                      )}`}
                    >
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{getInitials(user.displayName)}</span>
                      )}
                    </div>
                    {online && (
                      <div
                        className={`absolute bottom-0 left-0 w-3 h-3 bg-emerald-500 rounded-full border-2 ${
                          isLight ? 'border-white' : 'border-[#111923]'
                        }`}
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold truncate">{user.displayName}</span>
                      {user.role === 'admin' && (
                        <Shield className="w-3.5 h-3.5 text-[#2481cc] shrink-0" />
                      )}
                    </div>
                    <div
                      className={`text-xs truncate mt-0.5 ${
                        online ? 'text-[#2481cc] font-medium' : 'text-[#7f91a4]'
                      }`}
                    >
                      {startingUid === user.uid ? 'جاري فتح المحادثة...' : lastSeenLabel}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
