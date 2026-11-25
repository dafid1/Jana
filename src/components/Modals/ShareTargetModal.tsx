import React, { useState, useMemo } from 'react';
import { X, Share2, Bookmark, Search, Send, Users, Megaphone, CheckCircle2 } from 'lucide-react';
import { PendingSharePayload } from '../../types/telegram';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { getAvatarGradient, getInitials } from '../../utils/telegramHelpers';
import { useBackHandler } from '../../utils/androidBackNavigation';

interface ShareTargetModalProps {
  payload: PendingSharePayload | null;
  onClose: () => void;
}

export const ShareTargetModal: React.FC<ShareTargetModalProps> = ({ payload, onClose }) => {
  const { theme, currentUser } = useAuth();
  const { chats, getChatDisplayInfo, sendMessage, setActiveChatId } = useChat();
  const [search, setSearch] = useState('');
  const [sendingToId, setSendingToId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useBackHandler(Boolean(payload), onClose, 82);

  const availableChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return chats.filter((chat) => {
      if (chat.type === 'channel') {
        const isOwnerOrMod =
          chat.createdBy === currentUser?.uid ||
          (chat.adminIds || []).includes(currentUser?.uid || '');
        if (!isOwnerOrMod) return false;
      }
      if (!q) return true;
      const info = getChatDisplayInfo(chat);
      return info.title.toLowerCase().includes(q);
    });
  }, [chats, search, currentUser?.uid, getChatDisplayInfo]);

  if (!payload || !currentUser) return null;

  const isLight = theme === 'light';

  const handleSendToChat = async (chatId: string) => {
    if (sendingToId) return;
    setError('');
    setSendingToId(chatId);
    try {
      if (payload.type === 'image' && payload.dataUrl) {
        await sendMessage(
          payload.text?.trim() || '📷 صورة مشاركة',
          'image',
          {
            mediaUrl: payload.dataUrl,
            mediaName: payload.fileName || 'shared-image.jpg',
          },
          chatId
        );
      } else {
        const textToSend = (payload.text || '').trim();
        if (!textToSend) {
          throw new Error('المحتوى المشارك فارغ');
        }
        await sendMessage(textToSend, 'text', {}, chatId);
      }
      setActiveChatId(chatId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال المحتوى المشارك');
    } finally {
      setSendingToId(null);
    }
  };

  const savedChatId = `saved_${currentUser.uid}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-3xl p-5 shadow-2xl border text-right flex flex-col max-h-[85vh] ${
          isLight
            ? 'bg-white border-slate-200/80 text-slate-900'
            : 'bg-[#111923] border-white/[0.08] text-white'
        }`}
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#2481cc]/15 text-[#2481cc] flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">مشاركة إلى JanaX</h2>
              <p className="text-[11px] text-[#8ea0b5]">اختر المحادثة لإرسال المحتوى المشارك</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#8ea0b5] hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview */}
        <div
          className={`p-3 rounded-2xl border mb-3 shrink-0 ${
            isLight ? 'bg-slate-50 border-slate-200/80' : 'bg-[#162230] border-white/[0.07]'
          }`}
        >
          {payload.type === 'image' && payload.dataUrl ? (
            <div className="flex items-center gap-3">
              <img
                src={payload.dataUrl}
                alt="Shared"
                className="w-14 h-14 rounded-xl object-cover shrink-0 border border-white/10"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold">صورة واردة للمشاركة</div>
                <div className="text-[11px] text-[#8ea0b5] truncate mt-0.5">
                  {payload.text || payload.fileName || 'صورة جاهزة للإرسال'}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs line-clamp-3 leading-relaxed break-words">{payload.text}</p>
          )}
        </div>

        {error && (
          <div className="p-2.5 mb-2 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-400 text-xs font-semibold shrink-0">
            {error}
          </div>
        )}

        {/* Quick Save to Saved Messages */}
        <button
          type="button"
          disabled={Boolean(sendingToId)}
          onClick={() => handleSendToChat(savedChatId)}
          className="mb-3 p-3 rounded-2xl bg-[#2481cc]/12 hover:bg-[#2481cc]/20 border border-[#2481cc]/30 flex items-center justify-between transition-colors cursor-pointer shrink-0 disabled:opacity-60"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#2481cc] text-white flex items-center justify-center">
              <Bookmark className="w-4 h-4" />
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-[#2481cc]">الرسائل المحفوظة</div>
              <div className="text-[11px] text-[#8ea0b5]">حفظ سريع في مساحتك السحابية</div>
            </div>
          </div>
          {sendingToId === savedChatId ? (
            <span className="text-xs font-bold text-[#2481cc]">جاري الإرسال...</span>
          ) : (
            <Send className="w-4 h-4 text-[#2481cc]" />
          )}
        </button>

        {/* Search Chats */}
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border mb-2.5 shrink-0 ${
            isLight ? 'bg-slate-50 border-slate-200/80' : 'bg-[#1a2533] border-white/[0.07]'
          }`}
        >
          <Search className="w-4 h-4 text-[#8ea0b5]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في المحادثات..."
            className="w-full bg-transparent text-xs focus:outline-none"
          />
        </div>

        {/* Chats List */}
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {availableChats
            .filter((c) => c.id !== savedChatId)
            .map((chat) => {
              const info = getChatDisplayInfo(chat);
              const isBusy = sendingToId === chat.id;
              return (
                <button
                  key={chat.id}
                  type="button"
                  disabled={Boolean(sendingToId)}
                  onClick={() => handleSendToChat(chat.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-2xl border transition-colors cursor-pointer disabled:opacity-60 ${
                    isLight
                      ? 'bg-slate-50/70 border-slate-200/70 hover:bg-slate-100'
                      : 'bg-[#162230]/70 border-white/[0.06] hover:bg-[#1e2d3f]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                        info.otherUser?.uid || chat.id
                      )}`}
                    >
                      {info.photoURL ? (
                        <img src={info.photoURL} alt={info.title} className="w-full h-full object-cover" />
                      ) : chat.type === 'channel' ? (
                        <Megaphone className="w-4 h-4" />
                      ) : chat.type === 'group' ? (
                        <Users className="w-4 h-4" />
                      ) : (
                        <span>{getInitials(info.title)}</span>
                      )}
                    </div>
                    <div className="text-right min-w-0">
                      <div className="text-xs font-bold truncate">{info.title}</div>
                      <div className="text-[11px] text-[#8ea0b5] truncate">{info.subtitle}</div>
                    </div>
                  </div>
                  {isBusy ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                  ) : (
                    <Send className="w-4 h-4 text-[#2481cc] shrink-0" />
                  )}
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
};
