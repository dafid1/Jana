import React, { useState, useRef, useEffect } from 'react';
import {
  X,
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import {
  buildChatInviteLink,
  compressImageFile,
  getAvatarGradient,
  getInitials,
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
    showInfoDrawer,
    setShowInfoDrawer,
    messages,
    getChatDisplayInfo,
    addMembersToGroup,
    isActiveChatMember,
    isActiveChatModerator,
    joinChat,
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

  const [activeMediaTab, setActiveMediaTab] = useState<'media' | 'files'>('media');
  const [copiedType, setCopiedType] = useState<'link' | 'code' | null>(null);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [joiningFromDrawer, setJoiningFromDrawer] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [regeneratingLink, setRegeneratingLink] = useState(false);

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

  useEffect(() => {
    if (activeChat) {
      setEditTitle(activeChat.title || '');
      setEditDescription(activeChat.description || '');
      setEditPhotoURL(activeChat.photoURL || '');
      setShowEditInfo(false);
      setActionFeedback(null);
    }
  }, [activeChat?.id]);

  useBackHandler(
    showInfoDrawer && Boolean(activeChat) && (showAddMembers || showEditInfo),
    () => {
      setShowAddMembers(false);
      setShowEditInfo(false);
    },
    38
  );

  if (!showInfoDrawer || !activeChat) return null;

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

  const mediaMessages = messages.filter(
    (m) => !m.isDeleted && (m.type === 'image' || m.type === 'video') && m.mediaUrl
  );
  const fileMessages = messages.filter(
    (m) => !m.isDeleted && m.type === 'file' && m.mediaUrl
  );

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

  return (
    <div
      className={`w-80 border-r flex flex-col h-full shrink-0 z-20 shadow-xl select-none transition-all duration-300 ${
        theme === 'light' ? 'bg-white border-gray-200 text-slate-900' : 'bg-[#17212b] border-[#232e3c] text-white'
      }`}
    >
      {/* Header */}
      <div
        className={`h-15 px-4 flex items-center justify-between border-b shrink-0 ${
          theme === 'light' ? 'border-gray-200' : 'border-[#232e3c]'
        }`}
      >
        <span className="font-bold text-sm">معلومات المحادثة</span>
        <button
          onClick={() => setShowInfoDrawer(false)}
          className="p-1.5 rounded-full text-[#7f91a4] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Profile Details Scroll Area */}
      <div className="flex-1 overflow-y-auto">
        {actionFeedback && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-[#2481cc]/15 border border-[#2481cc]/30 text-[#2481cc] text-xs font-bold text-center">
            {actionFeedback}
          </div>
        )}

        {/* Big Avatar & Title */}
        <div className="p-6 flex flex-col items-center text-center border-b border-white/5">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center font-bold text-3xl text-white shadow-lg mb-3 overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
              displayInfo.otherUser?.uid || activeChat.id
            )}`}
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
          </div>

          <h3 className="font-bold text-base leading-tight mb-1">{displayInfo.title}</h3>
          <p
            className={`text-xs ${
              displayInfo.isOnline ? 'text-emerald-400 font-semibold' : 'text-[#7f91a4]'
            }`}
          >
            {displayInfo.subtitle}
          </p>

          {(activeChat.type === 'group' || activeChat.type === 'channel') && isActiveChatModerator && (
            <button
              type="button"
              onClick={() => {
                setEditTitle(activeChat.title || '');
                setEditDescription(activeChat.description || '');
                setEditPhotoURL(activeChat.photoURL || '');
                setShowEditInfo((prev) => !prev);
              }}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2481cc]/15 hover:bg-[#2481cc]/25 text-[#2481cc] text-xs font-bold transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{showEditInfo ? 'إغلاق التعديل' : 'تعديل معلومات ' + (activeChat.type === 'channel' ? 'القناة' : 'المجموعة')}</span>
            </button>
          )}
        </div>

        {/* Moderator Edit Info Form */}
        {showEditInfo && (activeChat.type === 'group' || activeChat.type === 'channel') && isActiveChatModerator && (
          <form
            onSubmit={handleSaveEditInfo}
            className="p-4 border-b border-white/5 space-y-3 bg-[#2481cc]/[0.04]"
          >
            <input
              ref={editAvatarRef}
              type="file"
              accept="image/*"
              onChange={handleEditAvatarChange}
              className="hidden"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => editAvatarRef.current?.click()}
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0 overflow-hidden relative group cursor-pointer bg-gradient-to-tr ${getAvatarGradient(
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
              <label className="block text-[11px] font-semibold opacity-80 mb-1">الاسم</label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border outline-hidden ${
                  theme === 'light'
                    ? 'bg-white border-slate-200 text-slate-900'
                    : 'bg-[#1a2533] border-white/[0.08] text-white'
                }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold opacity-80 mb-1">الوصف</label>
              <textarea
                rows={2}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className={`w-full px-3 py-2 text-xs rounded-xl border outline-hidden resize-none ${
                  theme === 'light'
                    ? 'bg-white border-slate-200 text-slate-900'
                    : 'bg-[#1a2533] border-white/[0.08] text-white'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={savingEdit || !editTitle.trim()}
              className="w-full py-2 rounded-xl bg-[#2481cc] hover:bg-[#1e6fb1] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {savingEdit ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </button>
          </form>
        )}

        {/* Info Rows */}
        <div className="p-4 space-y-3.5 text-xs border-b border-white/5">
          {(displayInfo.otherUser?.bio || activeChat.description) && (
            <div>
              <div className="text-[11px] text-[#7f91a4] mb-0.5">الوصف</div>
              <p className="font-medium leading-relaxed">
                {displayInfo.otherUser?.bio || activeChat.description}
              </p>
            </div>
          )}

          {displayInfo.otherUser && (
            <div>
              <div className="text-[11px] text-[#7f91a4] mb-0.5">اسم المستخدم</div>
              <p className="font-mono text-[#2481cc] font-semibold" dir="ltr">
                @{displayInfo.otherUser.username}
              </p>
            </div>
          )}

          {/* Join Button when previewing group or channel via invite link */}
          {!isActiveChatMember && (activeChat.type === 'group' || activeChat.type === 'channel') && (
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
              className="w-full py-2.5 px-3 rounded-xl bg-[#2481cc] hover:bg-[#1e6fb1] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
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
          )}

          {/* Group & Channel Shareable Invite Link */}
          {(activeChat.type === 'group' || activeChat.type === 'channel') && (
            <div className="p-3 rounded-2xl bg-[#2481cc]/10 border border-[#2481cc]/25 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#2481cc] flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  <span>
                    {activeChat.type === 'channel' ? 'رابط القناة العام' : 'رابط دعوة المجموعة'}
                  </span>
                </span>
                {inviteCode && (
                  <span className="font-mono text-[10px] opacity-80" dir="ltr">
                    {inviteCode}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={generatingLink}
                  onClick={() => handleCopyInvite('link')}
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60"
                >
                  {copiedType === 'link' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>تم نسخ الرابط</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{generatingLink ? 'جاري التجهيز...' : 'نسخ الرابط'}</span>
                    </>
                  )}
                </button>
                {inviteCode && (
                  <button
                    type="button"
                    onClick={() => handleCopyInvite('code')}
                    className="py-1.5 px-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedType === 'code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>الرمز</span>
                  </button>
                )}
              </div>

              {isActiveChatModerator && (
                <button
                  type="button"
                  disabled={regeneratingLink}
                  onClick={handleRegenerateInvite}
                  className="w-full py-1.5 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${regeneratingLink ? 'animate-spin' : ''}`} />
                  <span>{regeneratingLink ? 'جاري التجديد...' : 'إلغاء وتجديد رابط الدعوة'}</span>
                </button>
              )}
            </div>
          )}

          {/* Real Notifications Toggle */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              {!isMuted ? (
                <Bell className="w-4 h-4 text-[#2481cc]" />
              ) : (
                <BellOff className="w-4 h-4 text-[#7f91a4]" />
              )}
              <span className="font-medium">الإشعارات</span>
            </div>
            <button
              type="button"
              onClick={() => toggleMuteChat(activeChat.id)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                !isMuted ? 'bg-[#2481cc]' : 'bg-gray-500'
              }`}
              aria-label="تبديل الإشعارات"
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform ${
                  !isMuted ? '-translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Pin Chat Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Pin className={`w-4 h-4 rotate-45 ${isPinned ? 'text-[#2481cc]' : 'text-[#7f91a4]'}`} />
              <span className="font-medium">تثبيت المحادثة في الأعلى</span>
            </div>
            <button
              type="button"
              onClick={() => togglePinChat(activeChat.id)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                isPinned ? 'bg-[#2481cc]' : 'bg-gray-500'
              }`}
              aria-label="تبديل تثبيت المحادثة"
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform ${
                  isPinned ? '-translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Direct Chat: Block / Unblock User */}
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
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 ${
                isBlocked
                  ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                  : 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25'
              }`}
            >
              <Ban className="w-4 h-4" />
              <span>{isBlocked ? 'إلغاء حظر المستخدم' : 'حظر المستخدم'}</span>
            </button>
          )}
        </div>

        {/* Group Members List & Moderation */}
        {(activeChat.type === 'group' || (activeChat.type === 'channel' && isActiveChatModerator)) && (
          <div className="p-4 border-b border-white/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold flex items-center gap-1.5">
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
                    onClick={() => setShowAddMembers((prev) => !prev)}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#2481cc] hover:underline cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{showAddMembers ? 'إلغاء' : 'إضافة عضو'}</span>
                  </button>
                )}
            </div>

            {showAddMembers && (
              <div className="p-2.5 rounded-2xl bg-[#242f3d]/50 border border-white/10 space-y-2">
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {nonMembers.map((u) => {
                    const checked = selectedNewMembers.includes(u.uid);
                    return (
                      <button
                        key={u.uid}
                        onClick={() =>
                          setSelectedNewMembers((prev) =>
                            checked ? prev.filter((id) => id !== u.uid) : [...prev, u.uid]
                          )
                        }
                        className={`w-full flex items-center justify-between p-1.5 rounded-xl text-xs cursor-pointer ${
                          checked ? 'bg-[#2481cc]/25' : 'hover:bg-white/5'
                        }`}
                      >
                        <span className="truncate font-medium">{u.displayName}</span>
                        <span className="text-[10px] text-[#7f91a4] font-mono" dir="ltr">
                          @{u.username}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  disabled={selectedNewMembers.length === 0 || addingMembers}
                  onClick={handleAddMembers}
                  className="w-full py-1.5 rounded-xl bg-[#2481cc] text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                >
                  {addingMembers
                    ? 'جاري الإضافة...'
                    : `إضافة (${selectedNewMembers.length})`}
                </button>
              </div>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto">
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
                  <div key={mId} className="py-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] text-white overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
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
                            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#17212b] rounded-full" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{name}</div>
                          {member?.username && (
                            <div className="text-[10px] text-[#7f91a4] font-mono" dir="ltr">
                              @{member.username}
                            </div>
                          )}
                        </div>
                      </div>

                      {isCreator ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2481cc]/15 text-[#2481cc] font-bold flex items-center gap-0.5 shrink-0">
                          <Shield className="w-2.5 h-2.5" />
                          منشئ
                        </span>
                      ) : isChatAdmin ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold flex items-center gap-0.5 shrink-0">
                          <Crown className="w-2.5 h-2.5" />
                          مشرف
                        </span>
                      ) : null}
                    </div>

                    {canModerateThisMember && (
                      <div className="flex items-center gap-1 pr-10 flex-wrap">
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
                          className="px-2 py-0.5 rounded-lg bg-[#2481cc]/15 hover:bg-[#2481cc]/25 text-[#2481cc] text-[10px] font-bold cursor-pointer disabled:opacity-50"
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
                          className="px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                        >
                          <UserMinus className="w-2.5 h-2.5" />
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
                          className="px-2 py-0.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                        >
                          <Ban className="w-2.5 h-2.5" />
                          <span>حظر</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Banned Members List for Moderators */}
            {isActiveChatModerator && bannedIds.length > 0 && (
              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <div className="text-[11px] font-bold text-rose-400">
                  المحظورون ({bannedIds.length})
                </div>
                {bannedIds.map((bId) => {
                  const bannedUser = usersMap[bId];
                  return (
                    <div
                      key={bId}
                      className="flex items-center justify-between gap-2 text-xs py-1 px-2 rounded-xl bg-rose-500/10"
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
                        className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-[10px] font-bold cursor-pointer shrink-0"
                      >
                        إلغاء الحظر
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Leave Group / Unsubscribe Channel */}
        {isActiveChatMember &&
          (activeChat.type === 'group' || activeChat.type === 'channel') &&
          activeChat.createdBy !== currentUser?.uid && (
            <div className="px-4 py-3 border-b border-white/5">
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
                className="w-full py-2 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                <span>
                  {isLeaving
                    ? 'جاري التنفيذ...'
                    : activeChat.type === 'channel'
                    ? 'إلغاء الاشتراك في القناة'
                    : 'مغادرة المجموعة'}
                </span>
              </button>
            </div>
          )}

        {/* Shared Media Tabs */}
        <div className="p-4">
          <div className="flex border-b border-white/10 text-xs font-semibold mb-3">
            <button
              onClick={() => setActiveMediaTab('media')}
              className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
                activeMediaTab === 'media'
                  ? 'text-[#2481cc] border-b-2 border-[#2481cc]'
                  : 'text-[#7f91a4] hover:text-white'
              }`}
            >
              الصور والفيديو ({mediaMessages.length})
            </button>
            <button
              onClick={() => setActiveMediaTab('files')}
              className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
                activeMediaTab === 'files'
                  ? 'text-[#2481cc] border-b-2 border-[#2481cc]'
                  : 'text-[#7f91a4] hover:text-white'
              }`}
            >
              الملفات ({fileMessages.length})
            </button>
          </div>

          {activeMediaTab === 'media' ? (
            mediaMessages.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#7f91a4]">لا توجد وسائط مشاركة بعد</div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
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
          ) : fileMessages.length === 0 ? (
            <div className="text-center py-6 text-xs text-[#7f91a4]">لا توجد ملفات مشاركة بعد</div>
          ) : (
            <div className="space-y-2">
              {fileMessages.map((m) => (
                <a
                  key={m.id}
                  href={m.mediaUrl}
                  download={m.mediaName || 'file'}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs transition-colors"
                >
                  <FileText className="w-4 h-4 text-[#2481cc] shrink-0" />
                  <div className="flex-1 truncate font-medium">{m.mediaName || 'ملف'}</div>
                  <span className="text-[10px] text-[#7f91a4]">{m.mediaSize || 'ملف'}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
