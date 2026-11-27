import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Camera,
  Link2,
  X,
  Users,
  Search,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import {
  compressImageFile,
  formatLastSeenArabic,
  getAvatarGradient,
  getInitials,
  isUserOnlineByLastSeen,
} from '../../utils/telegramHelpers';
import { useBackHandler } from '../../utils/androidBackNavigation';

interface NewGroupModalProps {
  isOpen: boolean;
  initialTab?: 'create' | 'join';
  onClose: () => void;
}

export const NewGroupModal: React.FC<NewGroupModalProps> = ({
  isOpen,
  initialTab = 'create',
  onClose,
}) => {
  const { theme, currentUser, allUsers } = useAuth();
  const { createGroup, openInviteLink } = useChat();

  const [tab, setTab] = useState<'create' | 'join'>(initialTab);
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [inviteInput, setInviteInput] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const inviteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setStep(1);
      setError('');
      setMemberSearch('');
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen && tab === 'create' && step === 2) {
      requestAnimationFrame(() => titleInputRef.current?.focus());
    } else if (isOpen && tab === 'join') {
      requestAnimationFrame(() => inviteInputRef.current?.focus());
    }
  }, [isOpen, tab, step]);

  // Android back on step 2 returns to step 1 instead of exiting directly
  useBackHandler(isOpen && tab === 'create' && step === 2, () => setStep(1), 75);

  if (!isOpen) return null;

  const isLight = theme === 'light';
  const otherUsers = allUsers.filter((u) => u.uid !== currentUser?.uid);
  const selectedUsers = otherUsers.filter((u) => selectedUserIds.includes(u.uid));
  const filteredUsers = otherUsers.filter((u) => {
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q)
    );
  });

  const toggleMember = (uid: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleGroupPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 260, 0.8);
      setPhotoURL(compressed);
    } catch (err) {
      console.error(err);
    } finally {
      e.target.value = '';
    }
  };

  const handleCreateGroup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim() || isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      await createGroup({
        title: title.trim(),
        description: description.trim() || 'مجموعة جديدة في JanaX',
        photoURL: photoURL.trim(),
        memberIds: selectedUserIds,
      });
      setTitle('');
      setDescription('');
      setPhotoURL('');
      setSelectedUserIds([]);
      setStep(1);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء المجموعة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinByInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteInput.trim() || isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      await openInviteLink(inviteInput);
      setInviteInput('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر فتح الرابط');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHeaderBack = () => {
    if (tab === 'create' && step === 2) {
      setStep(1);
      setError('');
      return;
    }
    onClose();
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
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={handleHeaderBack}
            aria-label="رجوع"
            className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isLight
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <ArrowRight className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h2 className="text-base font-bold leading-tight truncate">
              {tab === 'join'
                ? 'انضمام برابط دعوة'
                : step === 1
                ? 'مجموعة جديدة'
                : 'تفاصيل المجموعة'}
            </h2>
            {tab === 'create' && step === 1 && (
              <p className="text-[11px] text-[#7f91a4] leading-tight">
                {selectedUserIds.length > 0
                  ? `تم تحديد ${selectedUserIds.length} ${selectedUserIds.length === 1 ? 'عضو' : 'أعضاء'}`
                  : 'أضف أعضاء للمجموعة (حتى 200,000 عضو)'}
              </p>
            )}
          </div>
        </div>

        {/* Clean mode toggle button in header (Create vs Join Link) */}
        {step === 1 && (
          <button
            type="button"
            onClick={() => {
              setTab(tab === 'create' ? 'join' : 'create');
              setError('');
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isLight
                ? 'text-[#2481cc] hover:bg-[#2481cc]/10'
                : 'text-[#5ea9e6] hover:bg-white/[0.06]'
            }`}
          >
            {tab === 'create' ? 'لدي رابط' : 'إنشاء مجموعة'}
          </button>
        )}
      </header>

      {error && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs shrink-0">
          {error}
        </div>
      )}

      {/* TAB: CREATE GROUP */}
      {tab === 'create' ? (
        step === 1 ? (
          /* STEP 1: Select Members (Exact Telegram Add Members Screen) */
          <div className="relative flex-1 flex flex-col min-h-0">
            {/* Telegram Selected Chips + Inline Search Bar */}
            <div
              className={`px-4 py-2.5 border-b shrink-0 ${
                isLight ? 'border-slate-200/80' : 'border-white/[0.06]'
              }`}
            >
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2.5 max-h-24 overflow-y-auto">
                  {selectedUsers.map((u) => (
                    <button
                      type="button"
                      key={u.uid}
                      onClick={() => toggleMember(u.uid)}
                      className={`inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        isLight
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                          : 'bg-[#212d3b] hover:bg-[#2a3849] text-white'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                          u.uid
                        )}`}
                      >
                        {u.photoURL ? (
                          <img
                            src={u.photoURL}
                            alt={u.displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{getInitials(u.displayName)}</span>
                        )}
                      </div>
                      <span className="max-w-[110px] truncate">{u.displayName}</span>
                      <X className="w-3.5 h-3.5 text-[#7f91a4]" />
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2.5">
                <Search className="w-4 h-4 text-[#7f91a4] shrink-0" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="من تود إضافته؟"
                  className={`flex-1 bg-transparent text-sm outline-none placeholder:text-[#7f91a4] ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}
                />
                {memberSearch && (
                  <button
                    type="button"
                    onClick={() => setMemberSearch('')}
                    aria-label="مسح البحث"
                    className="p-1 text-[#7f91a4] hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Contacts Scroll List */}
            <div className="flex-1 overflow-y-auto pb-24">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <p className="text-sm font-medium text-[#7f91a4]">
                    {otherUsers.length === 0
                      ? 'لا يوجد مستخدمون آخرون لإضافتهم حالياً'
                      : 'لم يتم العثور على عضو مطابق'}
                  </p>
                  <p className="text-xs text-[#7f91a4]/80 mt-1">
                    يمكنك المتابعة لإنشاء المجموعة ودعوة الأعضاء عبر رابط الدعوة لاحقاً
                  </p>
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isSelected = selectedUserIds.includes(u.uid);
                  const online = !u.privacyHideLastSeen && isUserOnlineByLastSeen(u);
                  const subText = u.privacyHideLastSeen
                    ? 'آخر ظهور مخفي'
                    : online
                    ? 'متصل الآن'
                    : formatLastSeenArabic(u.lastSeen)
                    ? `آخر ظهور ${formatLastSeenArabic(u.lastSeen)}`
                    : `@${u.username}`;

                  return (
                    <button
                      type="button"
                      key={u.uid}
                      onClick={() => toggleMember(u.uid)}
                      className={`w-full min-h-[60px] px-4 py-2 flex items-center justify-between gap-3 transition-colors text-right cursor-pointer ${
                        isLight
                          ? 'hover:bg-slate-100/80 active:bg-slate-200/70'
                          : 'hover:bg-white/[0.04] active:bg-white/[0.07]'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="relative shrink-0">
                          <div
                            className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm text-white overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                              u.uid
                            )}`}
                          >
                            {u.photoURL ? (
                              <img
                                src={u.photoURL}
                                alt={u.displayName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span>{getInitials(u.displayName)}</span>
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

                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{u.displayName}</div>
                          <div
                            className={`text-xs truncate mt-0.5 ${
                              online ? 'text-[#2481cc] font-medium' : 'text-[#7f91a4]'
                            }`}
                          >
                            {subText}
                          </div>
                        </div>
                      </div>

                      {/* Telegram Circular Selection Check */}
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all shrink-0 ${
                          isSelected
                            ? 'bg-[#2481cc] border-[#2481cc] text-white scale-105'
                            : isLight
                            ? 'border-slate-300'
                            : 'border-[#5c6f84]'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Telegram Floating Next FAB */}
            <button
              type="button"
              onClick={() => setStep(2)}
              aria-label="التالي"
              className="absolute bottom-5 left-5 w-14 h-14 rounded-full bg-[#2481cc] hover:bg-[#1e6fb1] text-white shadow-xl shadow-[#2481cc]/35 flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>
        ) : (
          /* STEP 2: Group Name, Photo & Confirm (Exact Telegram Group Details Screen) */
          <form onSubmit={handleCreateGroup} className="relative flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto pb-24">
              {/* Photo + Name Input Header Section */}
              <div className="px-5 py-6 flex items-center gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleGroupPhotoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-full bg-[#2481cc] hover:bg-[#1e6fb1] text-white flex items-center justify-center shrink-0 overflow-hidden cursor-pointer shadow-md transition-colors"
                  title="تعيين صورة المجموعة"
                >
                  {photoURL ? (
                    <img src={photoURL} alt="Group" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-7 h-7" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <input
                    ref={titleInputRef}
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="أدخل اسم المجموعة"
                    className={`w-full py-2 text-base font-medium bg-transparent border-b-2 outline-none transition-colors ${
                      isLight
                        ? 'border-slate-200 focus:border-[#2481cc] text-slate-900 placeholder:text-slate-400'
                        : 'border-white/[0.12] focus:border-[#2481cc] text-white placeholder:text-[#7f91a4]'
                    }`}
                  />
                </div>
              </div>

              {/* Description Field */}
              <div className="px-5 pb-5">
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="الوصف (اختياري)"
                  className={`w-full py-2 text-sm bg-transparent border-b outline-none transition-colors ${
                    isLight
                      ? 'border-slate-200 focus:border-[#2481cc] text-slate-900 placeholder:text-slate-400'
                      : 'border-white/[0.08] focus:border-[#2481cc] text-white placeholder:text-[#7f91a4]'
                  }`}
                />
              </div>

              {/* Section Divider */}
              <div
                className={`px-4 py-2 text-xs font-semibold border-y flex items-center justify-between ${
                  isLight
                    ? 'bg-slate-100/80 border-slate-200/70 text-slate-500'
                    : 'bg-[#0b1118]/70 border-white/[0.04] text-[#7f91a4]'
                }`}
              >
                <span>الأعضاء ({selectedUsers.length + 1})</span>
                <span>سيتم إنشاء رابط دعوة تلقائياً</span>
              </div>

              {/* Selected Members Preview */}
              <div className="py-1">
                {selectedUsers.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-[#7f91a4]">
                    يمكنك إضافة الأعضاء لاحقاً من معلومات المجموعة أو عبر رابط الدعوة
                  </div>
                ) : (
                  selectedUsers.map((u) => (
                    <div
                      key={u.uid}
                      className="min-h-[56px] px-4 py-2 flex items-center gap-3.5"
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white overflow-hidden shrink-0 bg-gradient-to-tr ${getAvatarGradient(
                          u.uid
                        )}`}
                      >
                        {u.photoURL ? (
                          <img
                            src={u.photoURL}
                            alt={u.displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{getInitials(u.displayName)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{u.displayName}</div>
                        <div className="text-xs text-[#7f91a4] truncate" dir="ltr">
                          @{u.username}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Telegram Floating Confirm Checkmark FAB */}
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              aria-label="إنشاء المجموعة"
              className="absolute bottom-5 left-5 w-14 h-14 rounded-full bg-[#2481cc] hover:bg-[#1e6fb1] text-white shadow-xl shadow-[#2481cc]/35 flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-6 h-6 stroke-[2.5]" />
              )}
            </button>
          </form>
        )
      ) : (
        /* TAB: JOIN BY INVITE LINK (Full Telegram Screen) */
        <form onSubmit={handleJoinByInvite} className="relative flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-[#2481cc]/15 text-[#2481cc] flex items-center justify-center shrink-0">
                <Link2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold">فتح مجموعة أو قناة عبر الرابط</h3>
                <p className="text-xs text-[#7f91a4] mt-0.5 leading-relaxed">
                  الصق رابط الدعوة أو الرمز مثل{' '}
                  <span className="font-mono text-[#2481cc]" dir="ltr">
                    JNX-XXXX1234
                  </span>{' '}
                  لفتحها والانضمام مباشرة.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#2481cc] mb-2">
                رابط أو رمز الدعوة
              </label>
              <input
                ref={inviteInputRef}
                type="text"
                required
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                placeholder="https://.../?join=JNX-XXXX"
                dir="ltr"
                className={`w-full py-2.5 text-sm font-mono bg-transparent border-b-2 outline-none transition-colors ${
                  isLight
                    ? 'border-slate-200 focus:border-[#2481cc] text-slate-900 placeholder:text-slate-400'
                    : 'border-white/[0.12] focus:border-[#2481cc] text-white placeholder:text-[#7f91a4]'
                }`}
              />
            </div>

            <div
              className={`p-3.5 rounded-2xl text-xs leading-relaxed flex items-start gap-2.5 ${
                isLight ? 'bg-slate-100 text-slate-600' : 'bg-[#17212b] text-[#8ea0b5]'
              }`}
            >
              <Users className="w-4 h-4 text-[#2481cc] shrink-0 mt-0.5" />
              <span>
                ستظهر لك معاينة المجموعة أو القناة ويمكنك الانضمام إليها بنقرة واحدة تماماً كما في
                تلجرام.
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !inviteInput.trim()}
            aria-label="فتح الرابط"
            className="absolute bottom-5 left-5 w-14 h-14 rounded-full bg-[#2481cc] hover:bg-[#1e6fb1] text-white shadow-xl shadow-[#2481cc]/35 flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ArrowLeft className="w-6 h-6" />
            )}
          </button>
        </form>
      )}
    </div>
  );
};
