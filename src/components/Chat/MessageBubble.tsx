import React, { useState } from 'react';
import {
  Check,
  CheckCheck,
  Play,
  Pause,
  FileText,
  Download,
  Pin,
  Reply,
  Copy,
  Trash2,
  Smile,
  BarChart2,
  Edit2,
  ExternalLink,
} from 'lucide-react';
import { Message, PollOption } from '../../types/telegram';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import {
  formatTelegramTime,
  formatDuration,
  QUICK_REACTIONS,
  getAvatarGradient,
  getInitials,
} from '../../utils/telegramHelpers';

interface MessageBubbleProps {
  message: Message;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isFirstInGroup = true,
  isLastInGroup = true,
}) => {
  const { theme, currentUser } = useAuth();
  const {
    activeChat,
    toggleReaction,
    pinMessage,
    deleteMessage,
    setReplyingTo,
    setEditingMessage,
    voteInPoll,
    setActiveMediaUrl,
    sendMessage,
  } = useChat();

  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState<'1x' | '1.5x' | '2x'>('1x');
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isSpoilerRevealed, setIsSpoilerRevealed] = useState(false);

  const isMe = message.senderId === currentUser?.uid;
  const isChannel = activeChat?.type === 'channel';
  const isSticker = message.type === 'sticker';
  const isDice = message.type === 'dice';

  const handleToggleVoice = () => {
    setIsPlayingVoice(!isPlayingVoice);
  };

  const handleCycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (voiceSpeed === '1x') setVoiceSpeed('1.5x');
    else if (voiceSpeed === '1.5x') setVoiceSpeed('2x');
    else setVoiceSpeed('1x');
  };

  const handleCopy = () => {
    if (message.text) {
      navigator.clipboard.writeText(message.text);
    }
  };

  const diceFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  return (
    <div
      className={`group relative flex items-end gap-2 my-1 px-4 ${
        isMe ? 'justify-end' : 'justify-start'
      }`}
      onMouseLeave={() => setShowReactionPicker(false)}
    >
      {/* Sender Avatar in Group chat for others */}
      {!isMe && !isChannel && activeChat?.type === 'group' && isLastInGroup && (
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
            message.senderId
          )} mb-1`}
        >
          {message.senderPhoto ? (
            <img src={message.senderPhoto} alt="" className="w-full h-full object-cover" />
          ) : (
            <span>{getInitials(message.senderName)}</span>
          )}
        </div>
      )}

      {/* Bubble Container */}
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] text-sm rounded-2xl shadow-xs transition-shadow ${
          isSticker || isDice
            ? 'bg-transparent shadow-none p-0'
            : isMe
            ? theme === 'light'
              ? 'bg-[#effdde] text-gray-900 rounded-br-xs'
              : 'bg-[#2b5278] text-white rounded-br-xs'
            : theme === 'light'
            ? 'bg-white text-gray-900 rounded-bl-xs'
            : 'bg-[#182533] text-white rounded-bl-xs'
        } ${!isSticker && !isDice ? 'px-3.5 py-2.5' : ''}`}
      >
        {/* Sender Name for group messages */}
        {!isMe && !isChannel && activeChat?.type === 'group' && (
          <div className="text-xs font-bold text-[#2481cc] mb-1 cursor-pointer">
            {message.senderName}
          </div>
        )}

        {/* Quoted Reply Preview */}
        {message.replyToText && (
          <div
            className={`border-r-2 border-[#2481cc] pr-2 pl-3 py-1 mb-1.5 rounded text-xs opacity-90 ${
              theme === 'light' ? 'bg-black/5' : 'bg-black/20'
            }`}
          >
            <div className="font-semibold text-[#2481cc] text-[11px]">
              {message.replyToSender || 'رد على رسالة'}
            </div>
            <div className="truncate opacity-80">{message.replyToText}</div>
          </div>
        )}

        {/* 1. STICKER MESSAGE */}
        {isSticker && (
          <div className="relative group/sticker">
            <img
              src={message.mediaUrl}
              alt="Telegram Sticker"
              className="w-44 h-44 object-cover rounded-2xl shadow-md hover:scale-105 transition-transform duration-200 cursor-pointer"
            />
          </div>
        )}

        {/* 2. DICE MESSAGE */}
        {isDice && (
          <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 select-none">
            <div className="text-6xl animate-bounce mb-1">
              {message.diceValue && message.diceValue >= 1 && message.diceValue <= 6
                ? diceFaces[message.diceValue - 1]
                : '🎲'}
            </div>
            <div className="text-xs font-bold text-sky-200">{message.text}</div>
          </div>
        )}

        {/* 3. IMAGE MESSAGE (Click opens Lightbox) */}
        {message.type === 'image' && message.mediaUrl && (
          <div
            className="mb-1.5 overflow-hidden rounded-xl cursor-pointer group/img"
            onClick={() => setActiveMediaUrl(message.mediaUrl || null)}
          >
            <img
              src={message.mediaUrl}
              alt="Attachment"
              className="max-h-72 w-auto object-cover rounded-xl group-hover/img:scale-[1.02] transition-transform duration-200"
            />
          </div>
        )}

        {/* 4. VOICE MESSAGE WITH SPEED CHANGER */}
        {message.type === 'voice' && (
          <div className="flex items-center gap-3 py-1 min-w-[220px]">
            {/* Play/Pause Button */}
            <button
              onClick={handleToggleVoice}
              className="w-10 h-10 rounded-full bg-[#2481cc] text-white flex items-center justify-center shrink-0 hover:scale-105 transition-transform cursor-pointer"
            >
              {isPlayingVoice ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            {/* Waveform visualization */}
            <div className="flex-1 flex items-center gap-0.5 h-6">
              {[40, 70, 30, 90, 60, 100, 45, 80, 50, 75, 35, 85, 60, 40, 70, 50].map((h, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-200 ${
                    isPlayingVoice
                      ? 'bg-[#2481cc] animate-tg-wave'
                      : isMe
                      ? 'bg-sky-200/60'
                      : 'bg-[#7f91a4]'
                  }`}
                  style={{
                    height: isPlayingVoice ? undefined : `${h}%`,
                    animationDelay: `${i * 0.05}s`,
                  }}
                />
              ))}
            </div>

            {/* Duration and Speed changer */}
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-mono opacity-75">
                {formatDuration(message.voiceDuration || 14)}
              </span>
              <button
                onClick={handleCycleSpeed}
                className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#2481cc]/30 text-[#2481cc] hover:bg-[#2481cc] hover:text-white transition-colors cursor-pointer"
                title="تغيير سرعة الصوت"
              >
                {voiceSpeed}
              </button>
            </div>
          </div>
        )}

        {/* 5. FILE / DOCUMENT MESSAGE */}
        {message.type === 'file' && (
          <div
            className={`flex items-center gap-3 p-2.5 rounded-xl mb-1 ${
              theme === 'light' ? 'bg-black/5' : 'bg-black/20'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-[#2481cc] text-white flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">{message.mediaName || 'مستند'}</div>
              <div className="text-[11px] opacity-75">{message.mediaSize || '1.4 MB'}</div>
            </div>
            <a
              href={message.mediaUrl || '#'}
              download
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-full hover:bg-white/10 text-[#2481cc] transition-colors"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* 6. INTERACTIVE POLL MESSAGE */}
        {message.type === 'poll' && message.pollData && (
          <div className="min-w-[240px] sm:min-w-[280px] py-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#2481cc] mb-1">
              <BarChart2 className="w-4 h-4" />
              <span>استطلاع رأي</span>
            </div>
            <h4 className="font-semibold text-sm mb-3">{message.pollData.question}</h4>

            <div className="space-y-2">
              {message.pollData.options.map((option) => {
                const total = message.pollData?.totalVotes || 0;
                const optVotes = option.votes?.length || 0;
                const percentage = total > 0 ? Math.round((optVotes / total) * 100) : 0;
                const hasVoted = option.votes?.includes(currentUser?.uid || '');

                return (
                  <button
                    key={option.id}
                    onClick={() => voteInPoll(message.id, option.id)}
                    className={`w-full text-right p-2.5 rounded-xl border relative overflow-hidden transition-colors cursor-pointer ${
                      hasVoted
                        ? 'border-[#2481cc] bg-[#2481cc]/15'
                        : theme === 'light'
                        ? 'border-gray-200 hover:bg-gray-50'
                        : 'border-[#2b3a4a] hover:bg-white/5'
                    }`}
                  >
                    <div
                      className="absolute inset-y-0 right-0 bg-[#2481cc]/20 transition-all duration-300 rounded-xl"
                      style={{ width: `${percentage}%` }}
                    />
                    <div className="relative flex items-center justify-between text-xs z-10">
                      <span className={`font-medium ${hasVoted ? 'text-[#2481cc] font-bold' : ''}`}>
                        {option.text}
                      </span>
                      <span className="font-mono text-[11px] font-semibold opacity-80">
                        {percentage}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="text-[11px] opacity-75 mt-2 text-right">
              {message.pollData.totalVotes} أصوات • تصويت متاح للجميع
            </div>
          </div>
        )}

        {/* 7. TEXT MESSAGE (With Spoiler and Link support) */}
        {message.text && !isDice && (
          <div className="leading-relaxed select-text text-right">
            {message.isSpoiler && !isSpoilerRevealed ? (
              <span
                onClick={() => setIsSpoilerRevealed(true)}
                className="bg-gray-500/30 filter blur-xs select-none cursor-pointer rounded px-1 transition-all hover:filter-none"
                title="اضغط لكشف النص المخفي (Spoiler)"
              >
                {message.text}
              </span>
            ) : (
              <span className="whitespace-pre-wrap break-words">{message.text}</span>
            )}
          </div>
        )}

        {/* 8. BOT INLINE KEYBOARD BUTTONS */}
        {message.inlineButtons && message.inlineButtons.length > 0 && (
          <div className="mt-2 space-y-1.5 pt-1.5 border-t border-white/10">
            {message.inlineButtons.map((row, rowIdx) => (
              <div key={rowIdx} className="flex items-center gap-1.5">
                {row.map((btn, btnIdx) => (
                  <button
                    key={btnIdx}
                    onClick={() => sendMessage(btn.data, 'text')}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-[#2481cc]/20 hover:bg-[#2481cc] hover:text-white text-[#2481cc] text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>{btn.text}</span>
                    {btn.url && <ExternalLink className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Timestamp, Edited Badge and Delivery Checks */}
        <div
          className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] select-none ${
            isMe
              ? theme === 'light'
                ? 'text-[#2481cc]'
                : 'text-sky-200/80'
              : theme === 'light'
              ? 'text-gray-400'
              : 'text-[#7f91a4]'
          }`}
        >
          {message.editedAt && <span className="opacity-75">(معدلة)</span>}
          <span>{formatTelegramTime(message.createdAt)}</span>
          {isMe && (
            <span className="text-[#2481cc]">
              <CheckCheck className="w-3.5 h-3.5 inline" />
            </span>
          )}
        </div>

        {/* Reactions List */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-1.5 pt-1 border-t border-white/10">
            {Object.entries(message.reactions).map(([emoji, users]) => {
              const hasReacted = users.includes(currentUser?.uid || '');
              return (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(message.id, emoji)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-transform active:scale-90 cursor-pointer ${
                    hasReacted
                      ? 'bg-[#2481cc] text-white shadow-xs'
                      : theme === 'light'
                      ? 'bg-black/5 text-gray-700 hover:bg-black/10'
                      : 'bg-white/10 text-white hover:bg-white/15'
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="text-[10px]">{users.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Floating Quick Action Trigger (Visible on Hover) */}
        <div
          className={`absolute top-0 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-20 ${
            isMe ? 'left-2' : 'right-2'
          }`}
        >
          <div
            className={`flex items-center gap-0.5 p-1 rounded-full shadow-lg border ${
              theme === 'light'
                ? 'bg-white border-gray-200 text-gray-700'
                : 'bg-[#1e2a38] border-[#2b3a4a] text-white'
            }`}
          >
            {/* Quick React Button */}
            <button
              onClick={() => setShowReactionPicker(!showReactionPicker)}
              className="p-1 rounded-full hover:bg-[#2481cc]/20 hover:text-[#2481cc] transition-colors"
              title="تفاعل"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>

            {/* Reply Button */}
            <button
              onClick={() => setReplyingTo(message)}
              className="p-1 rounded-full hover:bg-[#2481cc]/20 hover:text-[#2481cc] transition-colors"
              title="رد"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>

            {/* Edit Button (For user's text messages) */}
            {isMe && message.type === 'text' && (
              <button
                onClick={() => setEditingMessage(message)}
                className="p-1 rounded-full hover:bg-[#2481cc]/20 hover:text-[#2481cc] transition-colors"
                title="تعديل الرسالة"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Pin Button */}
            <button
              onClick={() => pinMessage(message.id, !message.isPinned)}
              className={`p-1 rounded-full hover:bg-[#2481cc]/20 transition-colors ${
                message.isPinned ? 'text-[#2481cc]' : 'hover:text-[#2481cc]'
              }`}
              title={message.isPinned ? 'إلغاء التثبيت' : 'تثبيت'}
            >
              <Pin className="w-3.5 h-3.5 rotate-45" />
            </button>

            {/* Copy Button */}
            {message.text && (
              <button
                onClick={handleCopy}
                className="p-1 rounded-full hover:bg-[#2481cc]/20 hover:text-[#2481cc] transition-colors"
                title="نسخ"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Delete button (for sender or admin) */}
            {(isMe || activeChat?.createdBy === currentUser?.uid) && (
              <button
                onClick={() => deleteMessage(message.id)}
                className="p-1 rounded-full hover:bg-red-500/20 hover:text-red-400 transition-colors"
                title="حذف"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Emoji Reaction Palette Bar */}
        {showReactionPicker && (
          <div
            className={`absolute -top-12 z-30 flex items-center gap-1.5 p-1.5 rounded-full shadow-2xl border animate-in fade-in zoom-in-95 duration-150 ${
              isMe ? 'left-0' : 'right-0'
            } ${
              theme === 'light'
                ? 'bg-white border-gray-200'
                : 'bg-[#1e2a38] border-[#2b3a4a]'
            }`}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  toggleReaction(message.id, emoji);
                  setShowReactionPicker(false);
                }}
                className="text-lg hover:scale-130 active:scale-95 transition-transform p-1 cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
