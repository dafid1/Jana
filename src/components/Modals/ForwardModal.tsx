import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  Forward,
  Hash,
  Search,
  Send,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { Chat, UserProfile } from '../../types/telegram';
import {
  getAvatarGradient,
  getInitials,
  getMessageReplyPreview,
  isUserOnlineByLastSeen,
} from '../../utils/telegramHelpers';

interface SelectedTarget {
  key: string;
  label: string;
  isSaved?: boolean;
  user?: UserProfile;
  chatId?: string;
}

export const ForwardModal: React.FC = () => {
  const { theme, currentUser, allUsers } = useAuth();
  const {
    chats,
    forwardingMessages,
    closeForwardModal,
    forwardMessages,
    getChatDisplayInfo,
  } = useChat();

  const [queryText, setQueryText] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<Record<string, SelectedTarget>>({});
  const [comment, setComment] = useState('');
  const [isForwarding, setIsForwarding] = useState(false);

  const isOpen = Boolean(forwardingMessages && forwardingMessages.length > 0);

  useEffect(() => {
    if (!isOpen) {
      setQueryText('');
      setSelectedTargets({});
      setComment('');
      setIsForwarding(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isForwarding) {
        closeForwardModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isForwarding, closeForwardModal]);

  const otherUsers = useMemo(
    () => allUsers.filter((u) => u.uid !== currentUser?.uid),
    [allUsers, currentUser?.uid]
  );

  const groupAndChannelChats = useMemo(
    () => chats.filter((c) => c.type === 'group' || c.type === 'channel'),
    [chats]
  );

  const normalizedQuery = queryText.trim().toLowerCase();

  const showSavedMessages = useMemo(() => {
    if (!normalizedQuery) return true;
    return (
      'الرسائل المحفوظة'.includes(normalizedQuery) ||
      'saved messages'.includes(normalizedQuery) ||
      'محفوظة'.includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  const filteredUsers = useMemo(() => {
    if (!normalizedQuery) return otherUsers;
    return otherUsers.filter(
      (u) =>
        u.displayName.toLowerCase().includes(normalizedQuery) ||
        u.username.toLowerCase().includes(normalizedQuery) ||
        (u.phone || '').toLowerCase().includes(normalizedQuery)
    );
  }, [otherUsers, normalizedQuery]);

  const filteredGroupChats = useMemo(() => {
    if (!normalizedQuery) return groupAndChannelChats;
    return groupAndChannelChats.filter((c) => {
      const info = getChatDisplayInfo(c);
      return (
        info.title.toLowerCase().includes(normalizedQuery) ||
        (c.description || '').toLowerCase().includes(normalizedQuery)
      );
    });
  }, [groupAndChannelChats, normalizedQuery, getChatDisplayInfo]);

  if (!isOpen || !forwardingMessages) return null;

  const selectedList = Object.values(selectedTargets);

  const toggleTarget = (target: SelectedTarget) => {
    setSelectedTargets((prev) => {
      const next = { ...prev };
      if (next[target.key]) {
        delete next[target.key];
      } else {
        next[target.key] = target;
      }
      return next;
    });
  };

  const handleConfirmForward = async () => {
    if (selectedList.length === 0 || isForwarding) return;
    setIsForwarding(true);
    try {
      await forwardMessages(
        forwardingMessages,
        selectedList.map((t) => ({
          isSaved: t.isSaved,
          user: t.user,
          chatId: t.chatId,
        })),
        comment
      );
    } catch {
      // Error toast is already surfaced by ChatContext
    } finally {
      setIsForwarding(false);
    }
  };

  const handleQuickForwardToSaved = async () => {
    if (isForwarding) return;
    setIsForwarding(true);
    try {
      await forwardMessages(forwardingMessages, [{ isSaved: true }], comment);
    } catch {
      // Error toast is already surfaced by ChatContext
    } finally {
      setIsForwarding(false);
    }
  };

  const previewSummary =
    forwardingMessages.length === 1
      ? getMessageReplyPreview(forwardingMessages[0])
      : `${forwardingMessages.length} رسائل محددة (${getMessageReplyPreview(
          forwardingMessages[0]
        )}...)`;

  const actionButtonLabel =
    selectedList.length === 0
      ? 'اختر وجهة للتحويل'
      : selectedList.length === 1
      ? `تحويل إلى ${selectedList[0].label}`
      : `تحويل إلى ${selectedList.length} وجهات`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs select-none animate-in fade-in duration-150"
      onClick={() => {
        if (!isForwarding) closeForwardModal();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-3xl shadow-2xl border text-right transition-all max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 ${
          theme === 'light'
            ? 'bg-white border-slate-200/80 text-slate-900'
            : 'bg-[#111923] border-white/[0.08] text-white'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 pt-5 pb-3.5 border-b shrink-0 ${
            theme === 'light' ? 'border-slate-100' : 'border-white/[0.06]'
          }`}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#2481cc]/15 text-[#2481cc] flex items-center justify-center shrink-0">
                <Forward className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold truncate">
                  {forwardingMessages.length === 1
                    ? 'تحويل رسالة'
                    : `تحويل ${forwardingMessages.length} رسائل`}
                </h2>
                <p
                  className={`text-[11px] truncate ${
                    theme === 'light' ? 'text-slate-500' : 'text-[#8ea0b5]'
                  }`}
                >
                  اختر الرسائل المحفوظة أو مستخدماً أو مجموعة
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isForwarding}
              onClick={closeForwardModal}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 ${
                theme === 'light'
                  ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                  : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
              }`}
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Forwarded Payload Preview */}
          <div
            className={`px-3 py-2 rounded-xl border text-xs mb-3 flex items-center justify-between gap-2 ${
              theme === 'light'
                ? 'bg-slate-50 border-slate-200/70 text-slate-700'
                : 'bg-[#162230] border-white/[0.06] text-slate-200'
            }`}
          >
            <span className="truncate">{previewSummary}</span>
            <span className="px-2 py-0.5 rounded-lg bg-[#2481cc]/15 text-[#2481cc] text-[10px] font-bold tabular-nums shrink-0">
              {forwardingMessages.length}
            </span>
          </div>

          {/* Search Input */}
          <div
            className={`flex items-center gap-2 rounded-xl px-3 py-2 border transition-all focus-within:border-[#2481cc] focus-within:ring-2 ${
              theme === 'light'
                ? 'bg-slate-100/90 border-slate-200/80 text-slate-900 focus-within:bg-white focus-within:ring-[#2481cc]/20'
                : 'bg-[#1a2533] border-white/[0.07] text-white focus-within:bg-[#1e2b3b] focus-within:ring-[#2481cc]/25'
            }`}
          >
            <Search className="w-4 h-4 text-[#8ea0b5] shrink-0" />
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="ابحث عن مستخدم أو محادثة..."
              className="flex-1 min-w-0 bg-transparent text-xs focus:outline-none placeholder:text-[#7f91a4]"
            />
            {queryText && (
              <button
                type="button"
                onClick={() => setQueryText('')}
                className="p-0.5 text-[#8ea0b5] hover:text-[#2481cc] cursor-pointer"
                aria-label="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Targets List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {/* 1. Saved Messages */}
          {showSavedMessages && (
            <div>
              <div
                className={`px-2 mb-1.5 text-[11px] font-bold ${
                  theme === 'light' ? 'text-slate-500' : 'text-[#8ea0b5]'
                }`}
              >
                السحابة الشخصية
              </div>
              <div
                onClick={() =>
                  toggleTarget({
                    key: 'saved',
                    label: 'الرسائل المحفوظة',
                    isSaved: true,
                  })
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleTarget({
                      key: 'saved',
                      label: 'الرسائل المحفوظة',
                      isSaved: true,
                    });
                  }
                }}
                className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all cursor-pointer ${
                  selectedTargets['saved']
                    ? 'border-[#2481cc] bg-[#2481cc]/12'
                    : theme === 'light'
                    ? 'border-slate-200/80 bg-slate-50/70 hover:bg-slate-100'
                    : 'border-white/[0.06] bg-[#162230]/80 hover:bg-[#1a2838]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#2481cc] to-sky-400 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Bookmark className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">الرسائل المحفوظة</div>
                    <div
                      className={`text-[11px] truncate mt-0.5 ${
                        theme === 'light' ? 'text-slate-500' : 'text-[#8ea0b5]'
                      }`}
                    >
                      حفظ في مساحتك السحابية الخاصة
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isForwarding}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickForwardToSaved();
                    }}
                    className="px-2.5 py-1 rounded-xl bg-[#2481cc]/15 hover:bg-[#2481cc] text-[#2481cc] hover:text-white text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    حفظ سريع
                  </button>

                  <span
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                      selectedTargets['saved']
                        ? 'bg-[#2481cc] border-[#2481cc] text-white'
                        : theme === 'light'
                        ? 'border-slate-300'
                        : 'border-white/25'
                    }`}
                  >
                    {selectedTargets['saved'] && <Check className="w-3 h-3 stroke-[3]" />}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 2. Registered Users (Forward to another user) */}
          <div>
            <div
              className={`px-2 mb-1.5 text-[11px] font-bold flex items-center justify-between ${
                theme === 'light' ? 'text-slate-500' : 'text-[#8ea0b5]'
              }`}
            >
              <span>المستخدمون المسجلون</span>
              <span className="tabular-nums">{filteredUsers.length}</span>
            </div>

            {filteredUsers.length === 0 ? (
              <div
                className={`text-center py-5 rounded-2xl border text-xs ${
                  theme === 'light'
                    ? 'border-slate-200/70 text-slate-500 bg-slate-50/50'
                    : 'border-white/[0.05] text-[#8ea0b5] bg-[#162230]/40'
                }`}
              >
                لا يوجد مستخدمون مطابقون للبحث
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredUsers.map((user) => {
                  const key = `user_${user.uid}`;
                  const isSelected = Boolean(selectedTargets[key]);
                  const online = isUserOnlineByLastSeen(user);
                  const hasExistingDm = currentUser
                    ? chats.some(
                        (c) => c.id === `dm_${[currentUser.uid, user.uid].sort().join('_')}`
                      )
                    : false;

                  return (
                    <button
                      type="button"
                      key={user.uid}
                      onClick={() =>
                        toggleTarget({
                          key,
                          label: user.displayName || user.username,
                          user,
                        })
                      }
                      className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all text-right cursor-pointer ${
                        isSelected
                          ? 'border-[#2481cc] bg-[#2481cc]/12'
                          : theme === 'light'
                          ? 'border-transparent hover:bg-slate-100'
                          : 'border-transparent hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
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
                            <span
                              className={`absolute bottom-0 left-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 ${
                                theme === 'light' ? 'border-white' : 'border-[#111923]'
                              }`}
                            />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold truncate">{user.displayName}</span>
                            {user.role === 'admin' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#2481cc]/15 text-[#2481cc] text-[10px] font-bold">
                                <Shield className="w-2.5 h-2.5" />
                                مشرف
                              </span>
                            )}
                          </div>
                          <div
                            className={`text-[11px] truncate mt-0.5 ${
                              theme === 'light' ? 'text-slate-500' : 'text-[#8ea0b5]'
                            }`}
                          >
                            <span dir="ltr" className="font-mono">
                              @{user.username}
                            </span>
                            {!hasExistingDm && ' • محادثة جديدة'}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-[#2481cc] border-[#2481cc] text-white'
                            : theme === 'light'
                            ? 'border-slate-300'
                            : 'border-white/25'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Groups & Channels */}
          {filteredGroupChats.length > 0 && (
            <div>
              <div
                className={`px-2 mb-1.5 text-[11px] font-bold flex items-center justify-between ${
                  theme === 'light' ? 'text-slate-500' : 'text-[#8ea0b5]'
                }`}
              >
                <span>المجموعات والقنوات</span>
                <span className="tabular-nums">{filteredGroupChats.length}</span>
              </div>

              <div className="space-y-1.5">
                {filteredGroupChats.map((chat: Chat) => {
                  const key = `chat_${chat.id}`;
                  const isSelected = Boolean(selectedTargets[key]);
                  const info = getChatDisplayInfo(chat);

                  return (
                    <button
                      type="button"
                      key={chat.id}
                      onClick={() =>
                        toggleTarget({
                          key,
                          label: info.title,
                          chatId: chat.id,
                        })
                      }
                      className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all text-right cursor-pointer ${
                        isSelected
                          ? 'border-[#2481cc] bg-[#2481cc]/12'
                          : theme === 'light'
                          ? 'border-transparent hover:bg-slate-100'
                          : 'border-transparent hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                            chat.id
                          )}`}
                        >
                          {info.photoURL ? (
                            <img
                              src={info.photoURL}
                              alt={info.title}
                              className="w-full h-full object-cover"
                            />
                          ) : chat.type === 'channel' ? (
                            <Hash className="w-4 h-4" />
                          ) : (
                            <Users className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">{info.title}</div>
                          <div
                            className={`text-[11px] truncate mt-0.5 ${
                              theme === 'light' ? 'text-slate-500' : 'text-[#8ea0b5]'
                            }`}
                          >
                            {info.subtitle}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-[#2481cc] border-[#2481cc] text-white'
                            : theme === 'light'
                            ? 'border-slate-300'
                            : 'border-white/25'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer: Optional Comment & Forward Action */}
        <div
          className={`px-4 py-3.5 border-t space-y-2.5 shrink-0 ${
            theme === 'light'
              ? 'border-slate-100 bg-slate-50/70'
              : 'border-white/[0.06] bg-[#0e151f]'
          }`}
        >
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="أضف رسالة أو تعليقاً قبل التحويل (اختياري)..."
            className={`w-full px-3.5 py-2 text-xs rounded-xl outline-hidden border transition-colors ${
              theme === 'light'
                ? 'bg-white border-slate-200/80 text-slate-900 placeholder-slate-400 focus:border-[#2481cc]'
                : 'bg-[#1a2533] border-white/[0.07] text-white placeholder-[#7f91a4] focus:border-[#2481cc]'
            }`}
          />

          <button
            type="button"
            disabled={selectedList.length === 0 || isForwarding}
            onClick={handleConfirmForward}
            className="w-full py-2.5 px-4 rounded-xl bg-[#2481cc] hover:bg-[#1e6fb1] text-white text-xs font-bold shadow-lg shadow-[#2481cc]/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isForwarding ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>جاري التحويل...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="truncate">{actionButtonLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
