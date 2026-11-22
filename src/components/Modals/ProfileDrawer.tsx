import React, { useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { getAvatarGradient, getInitials } from '../../utils/telegramHelpers';

export const ProfileDrawer: React.FC = () => {
  const { theme, usersMap, allUsers, currentUser } = useAuth();
  const {
    activeChat,
    showInfoDrawer,
    setShowInfoDrawer,
    messages,
    getChatDisplayInfo,
    addMembersToGroup,
  } = useChat();

  const [activeMediaTab, setActiveMediaTab] = useState<'media' | 'files'>('media');
  const [notifications, setNotifications] = useState(true);
  const [copiedType, setCopiedType] = useState<'link' | 'code' | null>(null);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);

  if (!showInfoDrawer || !activeChat) return null;

  const displayInfo = getChatDisplayInfo(activeChat);
  const mediaMessages = messages.filter((m) => m.type === 'image' && m.mediaUrl);
  const fileMessages = messages.filter((m) => m.type === 'file' && m.mediaUrl);

  const inviteCode = activeChat.inviteCode || '';
  const inviteLink = inviteCode
    ? `${window.location.origin}${window.location.pathname}?join=${inviteCode}`
    : '';

  const handleCopyInvite = (type: 'link' | 'code') => {
    const val = type === 'link' ? inviteLink : inviteCode;
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const nonMembers = allUsers.filter(
    (u) => !(activeChat.memberIds || []).includes(u.uid)
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

  return (
    <div
      className={`w-80 border-r flex flex-col h-full shrink-0 z-20 shadow-xl select-none transition-all duration-300 ${
        theme === 'light' ? 'bg-white border-gray-200' : 'bg-[#17212b] border-[#232e3c]'
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
          className="p-1.5 rounded-full text-[#7f91a4] hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Profile Details Scroll Area */}
      <div className="flex-1 overflow-y-auto">
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
        </div>

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

          {/* Group Invite Link & Code */}
          {activeChat.type === 'group' && inviteCode && (
            <div className="p-3 rounded-2xl bg-[#2481cc]/10 border border-[#2481cc]/25 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#2481cc] flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  <span>رابط دعوة المجموعة</span>
                </span>
                <span className="font-mono text-[10px] opacity-80" dir="ltr">
                  {inviteCode}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyInvite('link')}
                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  {copiedType === 'link' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>تم نسخ الرابط</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ الرابط</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleCopyInvite('code')}
                  className="py-1.5 px-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  {copiedType === 'code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>الرمز</span>
                </button>
              </div>
            </div>
          )}

          {/* Notifications Toggle */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              {notifications ? (
                <Bell className="w-4 h-4 text-[#2481cc]" />
              ) : (
                <BellOff className="w-4 h-4 text-[#7f91a4]" />
              )}
              <span className="font-medium">الإشعارات</span>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                notifications ? 'bg-[#2481cc]' : 'bg-gray-400'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform ${
                  notifications ? '-translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Group Members List & Add Member */}
        {activeChat.type === 'group' && (
          <div className="p-4 border-b border-white/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#2481cc]" />
                <span>الأعضاء ({activeChat.memberIds?.length || 1})</span>
              </div>
              {nonMembers.length > 0 && (
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
                    : `إضافة (${selectedNewMembers.length}) للمجموعة`}
                </button>
              </div>
            )}

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {(activeChat.memberIds || []).map((mId) => {
                const member = usersMap[mId];
                const name =
                  member?.displayName ||
                  (mId === currentUser?.uid ? 'أنت' : 'عضو في JanaX');
                return (
                  <div key={mId} className="flex items-center justify-between py-1">
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
                        {member?.isOnline && (
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
                    {mId === activeChat.createdBy && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#2481cc]/15 text-[#2481cc] font-bold flex items-center gap-0.5">
                        <Shield className="w-2.5 h-2.5" />
                        منشئ
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
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
              الصور ({mediaMessages.length})
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
                  <div key={m.id} className="aspect-square rounded-lg overflow-hidden bg-black/20">
                    <img
                      src={m.mediaUrl}
                      alt="Media"
                      className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            )
          ) : fileMessages.length === 0 ? (
            <div className="text-center py-6 text-xs text-[#7f91a4]">لا توجد ملفات مشاركة بعد</div>
          ) : (
            <div className="space-y-2">
              {fileMessages.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 p-2 rounded-xl bg-white/5 text-xs"
                >
                  <FileText className="w-4 h-4 text-[#2481cc] shrink-0" />
                  <div className="flex-1 truncate font-medium">{m.mediaName || 'ملف'}</div>
                  <span className="text-[10px] text-[#7f91a4]">{m.mediaSize || '1.2MB'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
