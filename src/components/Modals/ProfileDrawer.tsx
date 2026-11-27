import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowRight,
  Bell,
  BellOff,
  FileText,
  Link2,
  Users,
  Copy,
  Check,
  UserPlus,
  Shield,
  Pin,
  Ban,
  Edit3,
  RefreshCw,
  UserMinus,
  LogOut,
  Camera,
  Crown,
  Film,
  Phone,
  Video,
  AtSign,
  Info,
  MoreVertical,
  Mic,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import {
  buildChatInviteLink,
  compressImageFile,
  formatLastSeenArabic,
  getAvatarGradient,
  getInitials,
  isUserOnlineByLastSeen,
} from '../../utils/telegramHelpers';
import { useBackHandler } from '../../utils/androidBackNavigation';

export const ProfileDrawer: React.FC = () => {
  const {
    theme,
    usersMap,
    allUsers,
    currentUser,
    userProfile,
    toggleMuteChat,
    togglePinChat,
    toggleBlockUser,
  } = useAuth();
  const {
    activeChat,
    chats,
    setActiveChatId,
    showInfoDrawer,
    setShowInfoDrawer,
    messages,
    getChatDisplayInfo,
    addMembersToGroup,
    isActiveChatMember,
    isActiveChatModerator,
    isActiveChatBlocked,
    joinChat,
    startCall,
    ensureChatInviteLink,
    updateGroupOrChannelInfo,
    promoteChatAdmin,
    demoteChatAdmin,
    kickMemberFromChat,
    unbanMemberFromChat,
    regenerateInviteLink,
    leaveChat,
    setActiveMediaUrl,
  } = useChat();

  const [activeMediaTab, setActiveMediaTab] = useState<'media' | 'files' | 'links' | 'voice' | 'groups'>('media');
  const [copiedType, setCopiedType] = useState<'link' | 'code' | 'username' | 'phone' | null>(null);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [joiningFromDrawer, setJoiningFromDrawer] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [regeneratingLink, setRegeneratingLink] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  // Edit group/channel state
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPhotoURL, setEditPhotoURL] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [moderationBusyUid, setModerationBusyUid] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const editAvatarRef = useRef<HTMLInputElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeChat) {
      setEditTitle(activeChat.title || '');
      setEditDescription(activeChat.description || '');
      setEditPhotoURL(activeChat.photoURL || '');
      setShowEditInfo(false);
      setShowAddMembers(false);
      setShowOverflowMenu(false);
      setIsHeaderCollapsed(false);
      setActionFeedback(null);
    }
  }, [activeChat?.id]);

  useEffect(() => {
    if (!showOverflowMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setShowOverflowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showOverflowMenu]);

  useBackHandler(
    showInfoDrawer && Boolean(activeChat) && (showAddMembers || showEditInfo),
    () => {
      setShowAddMembers(false);
      setShowEditInfo(false);
    },
    38
  );

  if (!showInfoDrawer || !activeChat) return null;

  const isLight = theme === 'light';
  const displayInfo = getChatDisplayInfo(activeChat);
  const isMuted = Boolean(userProfile?.mutedChatIds?.includes(activeChat.id));
  const isPinned = Boolean(userProfile?.pinnedChatIds?.includes(activeChat.id));
  const directOtherUid =
    activeChat.type === 'direct'
      ? activeChat.memberIds.find((id) => id !== currentUser?.uid)
      : undefined;
  const isBlocked = Boolean(
    directOtherUid && userProfile?.blockedUserIds?.includes(directOtherUid)
  );

  const otherUser =
    displayInfo.otherUser || (directOtherUid ? usersMap[directOtherUid] : undefined);
  const accountProfile = activeChat.type === 'saved' ? userProfile : otherUser;
  const resolvedPhone = (() => {
    const rawPhone = accountProfile?.phone?.trim();
    if (rawPhone) return rawPhone;
    if (accountProfile?.username?.startsWith('p_')) {
      const digits = accountProfile.username.slice(2).replace(/\D/g, '');
      if (digits.length >= 7) return `+${digits}`;
    }
    return '';
  })();
  const hidesPresence = Boolean(otherUser?.privacyHideLastSeen);
  const isDirectOnline =
    activeChat.type === 'direct' && !isActiveChatBlocked && !hidesPresence
      ? isUserOnlineByLastSeen(otherUser)
      : false;
  const directLastSeen =
    activeChat.type === 'direct' && !isActiveChatBlocked && !hidesPresence
      ? formatLastSeenArabic(otherUser?.lastSeen)
      : '';

  const mediaMessages = messages.filter(
    (m) => !m.isDeleted && (m.type === 'image' || m.type === 'video') && m.mediaUrl
  );
  const fileMessages = messages.filter(
    (m) => !m.isDeleted && m.type === 'file' && m.mediaUrl
  );
  const voiceMessages = messages.filter(
    (m) => !m.isDeleted && m.type === 'voice'
  );
  const linkMessages = messages
    .filter((m) => !m.isDeleted)
    .flatMap((m) => {
      const urls: string[] = [];
      if (m.linkPreview?.url) urls.push(m.linkPreview.url);
      if (m.text) {
        const matched = m.text.match(/https?:\/\/[^\s<>"']+/gi);
        if (matched) matched.forEach((u) => { if (!urls.includes(u)) urls.push(u); });
      }
      return urls.map((url, idx) => ({
        id: `${m.id}_${idx}`,
        url,
        title: m.linkPreview?.title || url,
        senderName: m.senderName,
        createdAt: m.createdAt,
      }));
    });
  const sharedGroups =
    activeChat.type === 'direct' && directOtherUid
      ? chats.filter(
          (c) =>
            c.type === 'group' &&
            c.memberIds.includes(directOtherUid) &&
            (!currentUser?.uid || c.memberIds.includes(currentUser.uid))
        )
      : [];

  const inviteCode = activeChat.inviteCode || '';
  const inviteLink =
    activeChat.type === 'group' || activeChat.type === 'channel'
      ? buildChatInviteLink(activeChat)
      : '';

  const showNotice = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 2500);
  };

  const handleCopyInvite = async (type: 'link' | 'code') => {
    let val = type === 'link' ? inviteLink : inviteCode;
    if (
      type === 'link' &&
      !inviteCode &&
      (activeChat.type === 'group' || activeChat.type === 'channel')
    ) {
      setGeneratingLink(true);
      try {
        val = await ensureChatInviteLink(activeChat.id);
      } finally {
        setGeneratingLink(false);
      }
    }
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleCopyUsername = (username: string) => {
    navigator.clipboard.writeText(`@${username}`);
    setCopiedType('username');
    showNotice(`تم نسخ @${username}`);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleCopyPhone = (phoneVal: string) => {
    if (!phoneVal) return;
    navigator.clipboard.writeText(phoneVal);
    setCopiedType('phone');
    showNotice('تم نسخ رقم الهاتف');
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleRegenerateInvite = async () => {
    if (regeneratingLink) return;
    setRegeneratingLink(true);
    try {
      await regenerateInviteLink(activeChat.id);
      showNotice('تم تجديد رابط الدعوة وإلغاء الرابط السابق');
    } catch {
      showNotice('تعذر تجديد رابط الدعوة');
    } finally {
      setRegeneratingLink(false);
    }
  };

  const handleEditAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const compressed = await compressImageFile(file, 320, 0.8);
      setEditPhotoURL(compressed);
    } catch {
      showNotice('تعذر معالجة الصورة');
    }
  };

  const handleSaveEditInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      await updateGroupOrChannelInfo(activeChat.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        photoURL: editPhotoURL.trim(),
      });
      setShowEditInfo(false);
      showNotice('تم تحديث البيانات بنجاح');
    } catch {
      showNotice('تعذر تحديث البيانات');
    } finally {
      setSavingEdit(false);
    }
  };

  const nonMembers = allUsers.filter(
    (u) =>
      !(activeChat.memberIds || []).includes(u.uid) &&
      !(activeChat.bannedIds || []).includes(u.uid)
  );

  const handleAddMembers = async () => {
    if (selectedNewMembers.length === 0) return;
    setAddingMembers(true);
    try {
      await addMembersToGroup(activeChat.id, selectedNewMembers);
      setSelectedNewMembers([]);
      setShowAddMembers(false);
    } finally {
      setAddingMembers(false);
    }
  };

  const adminSet = new Set(activeChat.adminIds || []);
  const bannedIds = activeChat.bannedIds || [];

  const screenTitle =
    activeChat.type === 'channel'
      ? 'معلومات القناة'
      : activeChat.type === 'group'
      ? 'معلومات المجموعة'
      : activeChat.type === 'saved'
      ? 'الرسائل المحفوظة'
      : 'معلومات الحساب';

  const statusLine =
    activeChat.type === 'direct'
      ? isActiveChatBlocked
        ? 'مستخدم محظور'
        : hidesPresence
        ? 'آخر ظهور مخفي'
        : isDirectOnline
        ? 'متصل الآن'
        : directLastSeen
        ? `آخر ظهور ${directLastSeen}`
        : 'غير متصل'
      : displayInfo.subtitle;

  const canCall =
    activeChat.type === 'direct' &&
    isActiveChatMember &&
    !isActiveChatBlocked &&
    Boolean(directOtherUid);

  return (
    <div
      className={`flex-1 flex flex-col h-full w-full min-w-0 select-none tg-slide-in ${
        isLight ? 'bg-[#f0f2f5] text-slate-900' : 'bg-[#0e1621] text-white'
      }`}
    >
      {/* Telegram Top Profile App Bar (Collapses smoothly on scroll) */}
      <header
        className={`h-14 px-2 sm:px-4 flex items-center justify-between gap-2 border-b shrink-0 z-20 transition-colors ${
          isLight
            ? 'bg-white border-slate-200/80'
            : 'bg-[#17212b] border-[#0e1621]'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => setShowInfoDrawer(false)}
            aria-label="العودة للمحادثة"
            className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isLight
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <ArrowRight className="w-5 h-5" />
          </button>

          {isHeaderCollapsed ? (
            <div className="flex items-center gap-2.5 min-w-0 animate-in fade-in duration-150">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                  displayInfo.otherUser?.uid || activeChat.id
                )}`}
              >
                {displayInfo.photoURL ? (
                  <img src={displayInfo.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{getInitials(displayInfo.title)}</span>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold truncate leading-tight">{displayInfo.title}</h2>
                <p className="text-[11px] text-[#3390ec] truncate leading-tight">{statusLine}</p>
              </div>
            </div>
          ) : (
            <h2 className="text-base font-bold truncate">{screenTitle}</h2>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 relative" ref={overflowRef}>
          {(activeChat.type === 'group' || activeChat.type === 'channel') &&
            isActiveChatModerator && (
              <button
                type="button"
                onClick={() => {
                  setEditTitle(activeChat.title || '');
                  setEditDescription(activeChat.description || '');
                  setEditPhotoURL(activeChat.photoURL || '');
                  setShowEditInfo((prev) => !prev);
                }}
                aria-label="تعديل المعلومات"
                className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  showEditInfo
                    ? 'bg-[#3390ec]/15 text-[#3390ec]'
                    : isLight
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <Edit3 className="w-5 h-5" />
              </button>
            )}

          <button
            type="button"
            onClick={() => setShowOverflowMenu((prev) => !prev)}
            aria-label="المزيد من الخيارات"
            className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isLight
                ? 'text-slate-600 hover:bg-slate-100'
                : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showOverflowMenu && (
            <div
              className={`absolute top-12 left-0 w-52 rounded-2xl shadow-2xl border py-1.5 z-50 text-right animate-in fade-in zoom-in-95 duration-150 ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-900'
                  : 'bg-[#17212b] border-white/[0.08] text-white'
              }`}
            >
              {resolvedPhone && (
                <button
                  type="button"
                  onClick={() => {
                    handleCopyPhone(resolvedPhone);
                    setShowOverflowMenu(false);
                  }}
                  className={`w-full px-4 py-2.5 text-xs font-semibold flex items-center gap-2.5 cursor-pointer ${
                    isLight ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <Phone className="w-4 h-4 text-[#3390ec]" />
                  <span>نسخ رقم الهاتف</span>
                </button>
              )}
              {accountProfile?.username && (
                <button
                  type="button"
                  onClick={() => {
                    handleCopyUsername(accountProfile.username);
                    setShowOverflowMenu(false);
                  }}
                  className={`w-full px-4 py-2.5 text-xs font-semibold flex items-center gap-2.5 cursor-pointer ${
                    isLight ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <AtSign className="w-4 h-4 text-[#3390ec]" />
                  <span>نسخ اسم المستخدم</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  togglePinChat(activeChat.id);
                  setShowOverflowMenu(false);
                }}
                className={`w-full px-4 py-2.5 text-xs font-semibold flex items-center gap-2.5 cursor-pointer ${
                  isLight ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                }`}
              >
                <Pin className="w-4 h-4 text-[#3390ec] rotate-45" />
                <span>{isPinned ? 'إلغاء تثبيت المحادثة' : 'تثبيت المحادثة'}</span>
              </button>
              {activeChat.type === 'direct' && directOtherUid && (
                <button
                  type="button"
                  onClick={async () => {
                    setShowOverflowMenu(false);
                    setIsBlocking(true);
                    try {
                      await toggleBlockUser(directOtherUid);
                    } finally {
                      setIsBlocking(false);
                    }
                  }}
                  className={`w-full px-4 py-2.5 text-xs font-semibold flex items-center gap-2.5 cursor-pointer ${
                    isBlocked ? 'text-emerald-500' : 'text-rose-500'
                  } ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'}`}
                >
                  <Ban className="w-4 h-4" />
                  <span>{isBlocked ? 'إلغاء الحظر' : 'حظر المستخدم'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Full-Screen Scrollable Telegram Profile Body */}
      <div
        className="flex-1 overflow-y-auto"
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop;
          if (top > 135 && !isHeaderCollapsed) setIsHeaderCollapsed(true);
          else if (top <= 105 && isHeaderCollapsed) setIsHeaderCollapsed(false);
        }}
      >
        <div className="max-w-2xl mx-auto w-full pb-10">
          {actionFeedback && (
            <div className="mx-4 mt-3 p-2.5 rounded-xl bg-[#3390ec]/15 border border-[#3390ec]/30 text-[#3390ec] text-xs font-bold text-center">
              {actionFeedback}
            </div>
          )}

          {/* Telegram Profile Hero Section */}
          <section
            className={`px-6 pt-7 pb-6 flex flex-col items-center text-center border-b transition-all ${
              isLight ? 'bg-white border-slate-200/80' : 'bg-[#17212b] border-[#0e1621]'
            }`}
          >
            <button
              type="button"
              disabled={!displayInfo.photoURL}
              onClick={() => {
                if (displayInfo.photoURL) {
                  setActiveMediaUrl(displayInfo.photoURL);
                }
              }}
              className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center font-bold text-3xl text-white shadow-lg mb-3.5 overflow-hidden bg-gradient-to-tr ${
                displayInfo.photoURL ? 'cursor-pointer hover:opacity-95 transition-opacity' : 'cursor-default'
              } ${getAvatarGradient(displayInfo.otherUser?.uid || activeChat.id)}`}
            >
              {displayInfo.photoURL ? (
                <img
                  src={displayInfo.photoURL}
                  alt={displayInfo.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{getInitials(displayInfo.title)}</span>
              )}
            </button>

            <h3 className="font-bold text-lg leading-tight mb-1 flex items-center gap-1.5">
              <span>{displayInfo.title}</span>
              {activeChat.type === 'channel' && (
                <span className="text-[#2481cc] text-sm font-bold">✓</span>
              )}
            </h3>
            <p
              className={`text-xs font-medium ${
                isActiveChatBlocked
                  ? 'text-rose-400'
                  : isDirectOnline || displayInfo.isOnline
                  ? 'text-[#2481cc]'
                  : 'text-[#7f91a4]'
              }`}
            >
              {statusLine}
            </p>

            {/* Telegram Quick Action Bar (Call / Video / Mute / Pin) */}
            <div className="mt-5 w-full max-w-md grid grid-cols-2 sm:grid-flow-col sm:auto-cols-fr gap-2">
              {canCall && (
                <button
                  type="button"
                  onClick={() => startCall(activeChat, false)}
                  className={`py-2.5 px-3 rounded-2xl flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors cursor-pointer ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200/80 text-slate-800'
                      : 'bg-white/[0.06] hover:bg-white/[0.1] text-white'
                  }`}
                >
                  <Phone className="w-4 h-4 text-[#2481cc]" />
                  <span>مكالمة</span>
                </button>
              )}

              {canCall && (
                <button
                  type="button"
                  onClick={() => startCall(activeChat, true)}
                  className={`py-2.5 px-3 rounded-2xl flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors cursor-pointer ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200/80 text-slate-800'
                      : 'bg-white/[0.06] hover:bg-white/[0.1] text-white'
                  }`}
                >
                  <Video className="w-4 h-4 text-[#2481cc]" />
                  <span>فيديو</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => toggleMuteChat(activeChat.id)}
                className={`py-2.5 px-3 rounded-2xl flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200/80 text-slate-800'
                    : 'bg-white/[0.06] hover:bg-white/[0.1] text-white'
                }`}
              >
                {!isMuted ? (
                  <Bell className="w-4 h-4 text-[#2481cc]" />
                ) : (
                  <BellOff className="w-4 h-4 text-[#7f91a4]" />
                )}
                <span>{isMuted ? 'تفعيل الصوت' : 'كتم'}</span>
              </button>

              <button
                type="button"
                onClick={() => togglePinChat(activeChat.id)}
                className={`py-2.5 px-3 rounded-2xl flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200/80 text-slate-800'
                    : 'bg-white/[0.06] hover:bg-white/[0.1] text-white'
                }`}
              >
                <Pin className={`w-4 h-4 rotate-45 ${isPinned ? 'text-[#2481cc]' : 'text-[#7f91a4]'}`} />
                <span>{isPinned ? 'إلغاء التثبيت' : 'تثبيت'}</span>
              </button>
            </div>
          </section>

          {/* Moderator Edit Info Form */}
          {showEditInfo &&
            (activeChat.type === 'group' || activeChat.type === 'channel') &&
            isActiveChatModerator && (
              <form
                onSubmit={handleSaveEditInfo}
                className={`mt-3 px-5 py-4 border-y space-y-3.5 ${
                  isLight
                    ? 'bg-white border-slate-200/80'
                    : 'bg-[#111923] border-white/[0.06]'
                }`}
              >
                <input
                  ref={editAvatarRef}
                  type="file"
                  accept="image/*"
                  onChange={handleEditAvatarChange}
                  className="hidden"
                />
                <div className="flex items-center gap-3.5">
                  <button
                    type="button"
                    onClick={() => editAvatarRef.current?.click()}
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-white shrink-0 overflow-hidden cursor-pointer bg-gradient-to-tr ${getAvatarGradient(
                      activeChat.id
                    )}`}
                    title="تغيير الصورة"
                  >
                    {editPhotoURL ? (
                      <img src={editPhotoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => editAvatarRef.current?.click()}
                    className="text-xs font-bold text-[#2481cc] hover:underline cursor-pointer"
                  >
                    تغيير صورة {activeChat.type === 'channel' ? 'القناة' : 'المجموعة'}
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold opacity-80 mb-1">الاسم</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border outline-hidden ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#2481cc]'
                        : 'bg-[#1a2533] border-white/[0.08] text-white focus:border-[#2481cc]'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold opacity-80 mb-1">الوصف</label>
                  <textarea
                    rows={2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border outline-hidden resize-none ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#2481cc]'
                        : 'bg-[#1a2533] border-white/[0.08] text-white focus:border-[#2481cc]'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={savingEdit || !editTitle.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-[#2481cc] hover:bg-[#1e6fb1] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {savingEdit ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditInfo(false)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer ${
                      isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/[0.06] text-[#8ea0b5]'
                    }`}
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            )}

          {/* Join Button when previewing group or channel via invite link */}
          {!isActiveChatMember &&
            (activeChat.type === 'group' || activeChat.type === 'channel') && (
              <div className="px-4 pt-3">
                <button
                  type="button"
                  disabled={joiningFromDrawer}
                  onClick={async () => {
                    setJoiningFromDrawer(true);
                    try {
                      await joinChat(activeChat.id);
                    } finally {
                      setJoiningFromDrawer(false);
                    }
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-[#2481cc] hover:bg-[#1e6fb1] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-60"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {joiningFromDrawer
                      ? 'جاري الانضمام...'
                      : activeChat.type === 'channel'
                      ? 'انضمام إلى القناة'
                      : 'انضمام إلى المجموعة'}
                  </span>
                </button>
              </div>
            )}

          {/* Telegram Info Section (Phone, Bio, Username, Invite Link) */}
          <section
            className={`mt-3 border-y divide-y ${
              isLight
                ? 'bg-white border-slate-200/80 divide-slate-100'
                : 'bg-[#111923] border-white/[0.06] divide-white/[0.05]'
            }`}
          >
            {(activeChat.type === 'direct' || activeChat.type === 'saved') && (
              resolvedPhone ? (
                <button
                  type="button"
                  onClick={() => handleCopyPhone(resolvedPhone)}
                  className={`w-full px-5 py-3.5 flex items-center justify-between gap-4 text-right transition-colors cursor-pointer ${
                    isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <Phone className="w-5 h-5 text-[#2481cc] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-mono font-semibold" dir="ltr">
                        {resolvedPhone}
                      </p>
                      <div className="text-xs text-[#7f91a4] mt-0.5">رقم الهاتف</div>
                    </div>
                  </div>
                  {copiedType === 'phone' ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Copy className="w-4 h-4 text-[#7f91a4] shrink-0" />
                  )}
                </button>
              ) : (
                <div className="px-5 py-3.5 flex items-center gap-4">
                  <Phone className="w-5 h-5 text-[#7f91a4] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-[#7f91a4]">غير مضاف</p>
                    <div className="text-xs text-[#7f91a4]/80 mt-0.5">رقم الهاتف</div>
                  </div>
                </div>
              )
            )}

            {accountProfile && (
              <button
                type="button"
                onClick={() => handleCopyUsername(accountProfile.username)}
                className={`w-full px-5 py-3.5 flex items-center justify-between gap-4 text-right transition-colors cursor-pointer ${
                  isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <AtSign className="w-5 h-5 text-[#7f91a4] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-mono text-[#2481cc] font-semibold" dir="ltr">
                      @{accountProfile.username}
                    </p>
                    <div className="text-xs text-[#7f91a4] mt-0.5">اسم المستخدم</div>
                  </div>
                </div>
                {copiedType === 'username' ? (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Copy className="w-4 h-4 text-[#7f91a4] shrink-0" />
                )}
              </button>
            )}

            {(accountProfile?.bio || activeChat.description) && (
              <div className="px-5 py-3.5 flex items-start gap-4">
                <Info className="w-5 h-5 text-[#7f91a4] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed">
                    {accountProfile?.bio || activeChat.description}
                  </p>
                  <div className="text-xs text-[#7f91a4] mt-0.5">
                    {activeChat.type === 'direct' || activeChat.type === 'saved'
                      ? 'النبذة التعريفية'
                      : 'الوصف'}
                  </div>
                </div>
              </div>
            )}

            {/* Group & Channel Shareable Invite Link */}
            {(activeChat.type === 'group' || activeChat.type === 'channel') && (
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold flex items-center gap-2.5">
                    <Link2 className="w-4 h-4 text-[#2481cc]" />
                    <span>
                      {activeChat.type === 'channel' ? 'رابط القناة العام' : 'رابط دعوة المجموعة'}
                    </span>
                  </span>
                  {inviteCode && (
                    <span className="font-mono text-xs text-[#7f91a4]" dir="ltr">
                      {inviteCode}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={generatingLink}
                    onClick={() => handleCopyInvite('link')}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#2481cc] hover:bg-[#1e6fb1] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {copiedType === 'link' ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>تم نسخ الرابط</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>{generatingLink ? 'جاري التجهيز...' : 'نسخ رابط الدعوة'}</span>
                      </>
                    )}
                  </button>
                  {inviteCode && (
                    <button
                      type="button"
                      onClick={() => handleCopyInvite('code')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                        isLight
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                          : 'bg-white/[0.08] hover:bg-white/[0.12] text-white'
                      }`}
                    >
                      {copiedType === 'code' ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      <span>الرمز</span>
                    </button>
                  )}
                </div>

                {isActiveChatModerator && (
                  <button
                    type="button"
                    disabled={regeneratingLink}
                    onClick={handleRegenerateInvite}
                    className="w-full py-2 px-3 rounded-xl bg-amber-500/12 hover:bg-amber-500/20 text-amber-500 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${regeneratingLink ? 'animate-spin' : ''}`} />
                    <span>{regeneratingLink ? 'جاري التجديد...' : 'إلغاء وتجديد رابط الدعوة'}</span>
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Notification & Pin Settings Section */}
          <section
            className={`mt-3 border-y divide-y ${
              isLight
                ? 'bg-white border-slate-200/80 divide-slate-100'
                : 'bg-[#111923] border-white/[0.06] divide-white/[0.05]'
            }`}
          >
            <div className="px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                {!isMuted ? (
                  <Bell className="w-5 h-5 text-[#2481cc]" />
                ) : (
                  <BellOff className="w-5 h-5 text-[#7f91a4]" />
                )}
                <span className="text-sm font-medium">الإشعارات</span>
              </div>
              <button
                type="button"
                onClick={() => toggleMuteChat(activeChat.id)}
                className={`w-10 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                  !isMuted ? 'bg-[#2481cc]' : 'bg-slate-500'
                }`}
                aria-label="تبديل الإشعارات"
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                    !isMuted ? '-translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <Pin className={`w-5 h-5 rotate-45 ${isPinned ? 'text-[#2481cc]' : 'text-[#7f91a4]'}`} />
                <span className="text-sm font-medium">تثبيت المحادثة في الأعلى</span>
              </div>
              <button
                type="button"
                onClick={() => togglePinChat(activeChat.id)}
                className={`w-10 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                  isPinned ? 'bg-[#2481cc]' : 'bg-slate-500'
                }`}
                aria-label="تبديل تثبيت المحادثة"
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                    isPinned ? '-translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Group Members List & Moderation */}
          {(activeChat.type === 'group' ||
            (activeChat.type === 'channel' && isActiveChatModerator)) && (
            <section
              className={`mt-3 border-y px-5 py-4 space-y-3 ${
                isLight
                  ? 'bg-white border-slate-200/80'
                  : 'bg-[#111923] border-white/[0.06]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#2481cc]" />
                  <span>
                    {activeChat.type === 'channel' ? 'المشتركون' : 'الأعضاء'} (
                    {activeChat.memberIds?.length || 1})
                  </span>
                </div>
                {isActiveChatMember &&
                  (activeChat.type === 'group' || isActiveChatModerator) &&
                  nonMembers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAddMembers((prev) => !prev)}
                      className="flex items-center gap-1.5 text-xs font-bold text-[#2481cc] hover:underline cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{showAddMembers ? 'إلغاء' : 'إضافة عضو'}</span>
                    </button>
                  )}
              </div>

              {showAddMembers && (
                <div
                  className={`p-3 rounded-2xl border space-y-2.5 ${
                    isLight
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-[#1a2533] border-white/[0.08]'
                  }`}
                >
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {nonMembers.map((u) => {
                      const checked = selectedNewMembers.includes(u.uid);
                      return (
                        <button
                          type="button"
                          key={u.uid}
                          onClick={() =>
                            setSelectedNewMembers((prev) =>
                              checked ? prev.filter((id) => id !== u.uid) : [...prev, u.uid]
                            )
                          }
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer ${
                            checked
                              ? 'bg-[#2481cc]/20'
                              : isLight
                              ? 'hover:bg-slate-200/60'
                              : 'hover:bg-white/5'
                          }`}
                        >
                          <span className="truncate font-medium">{u.displayName}</span>
                          <span className="text-[11px] text-[#7f91a4] font-mono" dir="ltr">
                            @{u.username}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={selectedNewMembers.length === 0 || addingMembers}
                    onClick={handleAddMembers}
                    className="w-full py-2 rounded-xl bg-[#2481cc] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {addingMembers
                      ? 'جاري الإضافة...'
                      : `إضافة (${selectedNewMembers.length})`}
                  </button>
                </div>
              )}

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {(activeChat.memberIds || []).map((mId) => {
                  const member = usersMap[mId];
                  const name =
                    member?.displayName ||
                    (mId === currentUser?.uid ? 'أنت' : 'عضو في JanaX');
                  const isCreator = mId === activeChat.createdBy;
                  const isChatAdmin = adminSet.has(mId);
                  const canModerateThisMember =
                    isActiveChatModerator && !isCreator && mId !== currentUser?.uid;

                  return (
                    <div key={mId} className="py-1.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                                mId
                              )}`}
                            >
                              {member?.photoURL ? (
                                <img
                                  src={member.photoURL}
                                  alt={name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>{getInitials(name)}</span>
                              )}
                            </div>
                            {member?.isOnline && !member?.privacyHideLastSeen && (
                              <div
                                className={`absolute bottom-0 left-0 w-2.5 h-2.5 bg-emerald-500 border-2 rounded-full ${
                                  isLight ? 'border-white' : 'border-[#111923]'
                                }`}
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{name}</div>
                            {member?.username && (
                              <div className="text-xs text-[#7f91a4] font-mono" dir="ltr">
                                @{member.username}
                              </div>
                            )}
                          </div>
                        </div>

                        {isCreator ? (
                          <span className="text-xs text-[#2481cc] font-bold flex items-center gap-1 shrink-0">
                            <Shield className="w-3.5 h-3.5" />
                            <span>منشئ</span>
                          </span>
                        ) : isChatAdmin ? (
                          <span className="text-xs text-amber-500 font-bold flex items-center gap-1 shrink-0">
                            <Crown className="w-3.5 h-3.5" />
                            <span>مشرف</span>
                          </span>
                        ) : null}
                      </div>

                      {canModerateThisMember && (
                        <div className="flex items-center gap-1.5 pr-13 flex-wrap">
                          <button
                            type="button"
                            disabled={moderationBusyUid === mId}
                            onClick={async () => {
                              setModerationBusyUid(mId);
                              try {
                                if (isChatAdmin) {
                                  await demoteChatAdmin(activeChat.id, mId);
                                } else {
                                  await promoteChatAdmin(activeChat.id, mId);
                                }
                              } finally {
                                setModerationBusyUid(null);
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#2481cc]/15 hover:bg-[#2481cc]/25 text-[#2481cc] text-[11px] font-bold cursor-pointer disabled:opacity-50"
                          >
                            {isChatAdmin ? 'إزالة الإشراف' : 'ترقية لمشرف'}
                          </button>
                          <button
                            type="button"
                            disabled={moderationBusyUid === mId}
                            onClick={async () => {
                              setModerationBusyUid(mId);
                              try {
                                await kickMemberFromChat(activeChat.id, mId, false);
                              } finally {
                                setModerationBusyUid(null);
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <UserMinus className="w-3 h-3" />
                            <span>إخراج</span>
                          </button>
                          <button
                            type="button"
                            disabled={moderationBusyUid === mId}
                            onClick={async () => {
                              setModerationBusyUid(mId);
                              try {
                                await kickMemberFromChat(activeChat.id, mId, true);
                              } finally {
                                setModerationBusyUid(null);
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Ban className="w-3 h-3" />
                            <span>حظر</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {isActiveChatModerator && bannedIds.length > 0 && (
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <div className="text-xs font-bold text-rose-400">
                    المحظورون ({bannedIds.length})
                  </div>
                  {bannedIds.map((bId) => {
                    const bannedUser = usersMap[bId];
                    return (
                      <div
                        key={bId}
                        className="flex items-center justify-between gap-2 text-xs py-1.5 px-3 rounded-xl bg-rose-500/10"
                      >
                        <span className="truncate font-medium">
                          {bannedUser?.displayName || `@${bannedUser?.username || 'مستخدم'}`}
                        </span>
                        <button
                          type="button"
                          disabled={moderationBusyUid === bId}
                          onClick={async () => {
                            setModerationBusyUid(bId);
                            try {
                              await unbanMemberFromChat(activeChat.id, bId);
                            } finally {
                              setModerationBusyUid(null);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-[11px] font-bold cursor-pointer shrink-0"
                        >
                          إلغاء الحظر
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Shared Media, Files, Links, Voice & Shared Groups (5 Telegram Tabs) */}
          <section
            className={`mt-3 border-y ${
              isLight
                ? 'bg-white border-slate-200/80'
                : 'bg-[#17212b] border-[#0e1621]'
            }`}
          >
            <div
              className={`flex overflow-x-auto border-b text-xs font-bold ${
                isLight ? 'border-slate-200/80' : 'border-white/[0.06]'
              }`}
            >
              {[
                { id: 'media' as const, label: 'الوسائط', count: mediaMessages.length },
                { id: 'files' as const, label: 'الملفات', count: fileMessages.length },
                { id: 'links' as const, label: 'الروابط', count: linkMessages.length },
                { id: 'voice' as const, label: 'الصوتيات', count: voiceMessages.length },
                ...(activeChat.type === 'direct'
                  ? [{ id: 'groups' as const, label: 'المجموعات', count: sharedGroups.length }]
                  : []),
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveMediaTab(tab.id)}
                  className={`flex-1 min-w-[78px] py-3 px-2 text-center whitespace-nowrap transition-colors cursor-pointer ${
                    activeMediaTab === tab.id
                      ? 'text-[#3390ec] border-b-2 border-[#3390ec]'
                      : 'text-[#7f91a4] hover:text-[#3390ec]'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            <div className="p-4">
              {activeMediaTab === 'media' ? (
                mediaMessages.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#7f91a4]">
                    لا توجد وسائط مشاركة بعد
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {mediaMessages.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          if (m.type === 'image' && m.mediaUrl) {
                            setActiveMediaUrl(m.mediaUrl);
                          }
                        }}
                        className="relative aspect-square rounded-lg overflow-hidden bg-black/30 cursor-pointer"
                      >
                        {m.type === 'video' ? (
                          <>
                            <video
                              src={m.mediaUrl}
                              muted
                              playsInline
                              preload="metadata"
                              controls
                              className="w-full h-full object-cover"
                            />
                            <div className="pointer-events-none absolute top-1 right-1 p-0.5 rounded bg-black/60 text-white">
                              <Film className="w-3 h-3" />
                            </div>
                          </>
                        ) : (
                          <img
                            src={m.mediaUrl}
                            alt="Media"
                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : activeMediaTab === 'files' ? (
                fileMessages.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#7f91a4]">
                    لا توجد ملفات مشاركة بعد
                  </div>
                ) : (
                  <div className="space-y-2">
                    {fileMessages.map((m) => (
                      <a
                        key={m.id}
                        href={m.mediaUrl}
                        download={m.mediaName || 'file'}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-3 p-2.5 rounded-xl text-xs transition-colors ${
                          isLight
                            ? 'bg-slate-50 hover:bg-slate-100'
                            : 'bg-white/[0.04] hover:bg-white/[0.08]'
                        }`}
                      >
                        <FileText className="w-4 h-4 text-[#3390ec] shrink-0" />
                        <div className="flex-1 truncate font-medium">{m.mediaName || 'ملف'}</div>
                        <span className="text-[11px] text-[#7f91a4]">{m.mediaSize || 'ملف'}</span>
                      </a>
                    ))}
                  </div>
                )
              ) : activeMediaTab === 'links' ? (
                linkMessages.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#7f91a4]">
                    لا توجد روابط مشاركة في هذه المحادثة
                  </div>
                ) : (
                  <div className="space-y-2">
                    {linkMessages.map((lnk) => (
                      <a
                        key={lnk.id}
                        href={lnk.url}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-3 p-2.5 rounded-xl text-xs transition-colors ${
                          isLight
                            ? 'bg-slate-50 hover:bg-slate-100'
                            : 'bg-white/[0.04] hover:bg-white/[0.08]'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#3390ec]/15 text-[#3390ec] flex items-center justify-center shrink-0">
                          <Link2 className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold truncate">{lnk.title}</div>
                          <div className="text-[11px] text-[#3390ec] truncate font-mono" dir="ltr">
                            {lnk.url}
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-[#7f91a4] shrink-0" />
                      </a>
                    ))}
                  </div>
                )
              ) : activeMediaTab === 'voice' ? (
                voiceMessages.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#7f91a4]">
                    لا توجد رسائل صوتية بعد
                  </div>
                ) : (
                  <div className="space-y-2">
                    {voiceMessages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between gap-3 p-2.5 rounded-xl text-xs ${
                          isLight ? 'bg-slate-50' : 'bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-[#3390ec] text-white flex items-center justify-center shrink-0">
                            <Mic className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{m.senderName}</div>
                            <div className="text-[11px] text-[#7f91a4]">
                              رسالة صوتية • {m.voiceDuration || 3} ث
                            </div>
                          </div>
                        </div>
                        {m.mediaUrl && (
                          <audio controls src={m.mediaUrl} className="h-8 max-w-[160px]" />
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : sharedGroups.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#7f91a4]">
                  لا توجد مجموعات مشتركة بعد
                </div>
              ) : (
                <div className="space-y-1.5">
                  {sharedGroups.map((grp) => {
                    const gInfo = getChatDisplayInfo(grp);
                    return (
                      <button
                        key={grp.id}
                        type="button"
                        onClick={() => {
                          setActiveChatId(grp.id);
                          setShowInfoDrawer(false);
                        }}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-right transition-colors cursor-pointer ${
                          isLight ? 'hover:bg-slate-100' : 'hover:bg-white/[0.05]'
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                            grp.id
                          )}`}
                        >
                          {gInfo.photoURL ? (
                            <img src={gInfo.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Users className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold truncate">{gInfo.title}</div>
                          <div className="text-[11px] text-[#7f91a4] mt-0.5">
                            {grp.memberIds.length} عضو
                          </div>
                        </div>
                        <MessageCircle className="w-4 h-4 text-[#3390ec] shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Block / Leave Destructive Actions Section */}
          {((activeChat.type === 'direct' && directOtherUid) ||
            (isActiveChatMember &&
              (activeChat.type === 'group' || activeChat.type === 'channel') &&
              activeChat.createdBy !== currentUser?.uid)) && (
            <section
              className={`mt-3 border-y ${
                isLight
                  ? 'bg-white border-slate-200/80'
                  : 'bg-[#111923] border-white/[0.06]'
              }`}
            >
              {activeChat.type === 'direct' && directOtherUid && (
                <button
                  type="button"
                  disabled={isBlocking}
                  onClick={async () => {
                    setIsBlocking(true);
                    try {
                      await toggleBlockUser(directOtherUid);
                    } finally {
                      setIsBlocking(false);
                    }
                  }}
                  className={`w-full px-5 py-3.5 text-sm font-semibold flex items-center gap-3.5 transition-colors cursor-pointer disabled:opacity-50 ${
                    isBlocked
                      ? 'text-emerald-500 hover:bg-emerald-500/10'
                      : 'text-rose-500 hover:bg-rose-500/10'
                  }`}
                >
                  <Ban className="w-5 h-5" />
                  <span>{isBlocked ? 'إلغاء حظر المستخدم' : 'حظر المستخدم'}</span>
                </button>
              )}

              {isActiveChatMember &&
                (activeChat.type === 'group' || activeChat.type === 'channel') &&
                activeChat.createdBy !== currentUser?.uid && (
                  <button
                    type="button"
                    disabled={isLeaving}
                    onClick={async () => {
                      setIsLeaving(true);
                      try {
                        await leaveChat(activeChat.id);
                        setShowInfoDrawer(false);
                      } finally {
                        setIsLeaving(false);
                      }
                    }}
                    className="w-full px-5 py-3.5 text-sm font-semibold text-rose-500 hover:bg-rose-500/10 flex items-center gap-3.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>
                      {isLeaving
                        ? 'جاري التنفيذ...'
                        : activeChat.type === 'channel'
                        ? 'إلغاء الاشتراك في القناة'
                        : 'مغادرة المجموعة'}
                    </span>
                  </button>
                )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
