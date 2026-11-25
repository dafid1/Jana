import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Paperclip,
  Smile,
  Send,
  Mic,
  X,
  Image as ImageIcon,
  FileText,
  BarChart2,
  Check,
  Edit2,
  Dices,
  EyeOff,
  Reply,
  Sticker,
  Forward,
  Bookmark,
  Copy,
  UserPlus,
  Video,
  Ban,
  Bell,
  BellOff,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import {
  formatDuration,
  compressImageFile,
  getMessageReplyPreview,
  formatBytes,
  estimateDataUrlBytes,
  getAvatarGradient,
  getInitials,
} from '../../utils/telegramHelpers';
import { uploadMediaWithFallback } from '../../utils/mediaStorage';
import { StickerPicker, SelectableSticker } from './StickerPicker';
import { useBackHandler } from '../../utils/androidBackNavigation';

interface ChatInputProps {
  onOpenPollModal: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onOpenPollModal }) => {
  const {
    theme,
    currentUser,
    userProfile,
    usersMap,
    toggleBlockUser,
    toggleMuteChat,
  } = useAuth();
  const {
    activeChat,
    activeChatId,
    sendMessage,
    sendVideoMessage,
    replyingTo,
    setReplyingTo,
    editingMessage,
    setEditingMessage,
    editMessageText,
    sendDiceRoll,
    sendStickerMessage,
    updateTypingStatus,
    isSelectionMode,
    selectedMessageIds,
    selectedMessages,
    clearSelection,
    openForwardModal,
    forwardMessages,
    isActiveChatMember,
    isActiveChatBlocked,
    canPostInActiveChat,
    joinChat,
  } = useChat();

  const [text, setText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activePickerTab, setActivePickerTab] = useState<'emoji' | 'sticker'>('emoji');
  const [isSpoilerActive, setIsSpoilerActive] = useState(false);
  const [copiedSelection, setCopiedSelection] = useState(false);
  const [savingToSaved, setSavingToSaved] = useState(false);
  const [isJoiningChat, setIsJoiningChat] = useState(false);
  const [isUnblocking, setIsUnblocking] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadLabel, setUploadLabel] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerWrapperRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTypingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingPingRef = useRef<number>(0);
  const isTypingSentRef = useRef<boolean>(false);

  useBackHandler(
    Boolean(activeChat) && (showEmojiPicker || showAttachMenu),
    () => {
      setShowEmojiPicker(false);
      setShowAttachMenu(false);
    },
    45
  );

  // Close Emoji/Sticker picker and Attach menu on outside click or Escape
  useEffect(() => {
    if (!showEmojiPicker && !showAttachMenu) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (pickerWrapperRef.current && !pickerWrapperRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
        setShowAttachMenu(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowEmojiPicker(false);
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [showEmojiPicker, showAttachMenu]);

  // Clear typing status on chat switch or unmount
  useEffect(() => {
    const currentChatForCleanup = activeChatId;
    setUploadError(null);
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (recordingTypingIntervalRef.current) {
        clearInterval(recordingTypingIntervalRef.current);
        recordingTypingIntervalRef.current = null;
      }
      if (isTypingSentRef.current && currentChatForCleanup) {
        isTypingSentRef.current = false;
        updateTypingStatus(false, currentChatForCleanup, 'typing').catch(() => {});
      }
    };
  }, [activeChatId]);

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text);
      textareaRef.current?.focus();
    }
  }, [editingMessage]);

  useEffect(() => {
    if (replyingTo) {
      textareaRef.current?.focus();
    }
  }, [replyingTo]);

  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
      updateTypingStatus(true, activeChatId || undefined, 'recording').catch(() => {});
      recordingTypingIntervalRef.current = setInterval(() => {
        updateTypingStatus(true, activeChatId || undefined, 'recording').catch(() => {});
      }, 2500);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (recordingTypingIntervalRef.current) {
        clearInterval(recordingTypingIntervalRef.current);
        recordingTypingIntervalRef.current = null;
      }
      setRecordingSeconds(0);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (recordingTypingIntervalRef.current) {
        clearInterval(recordingTypingIntervalRef.current);
        recordingTypingIntervalRef.current = null;
      }
    };
  }, [isRecording, activeChatId]);

  // @mention autocomplete candidates for group & channel chats
  const mentionSuggestions = useMemo(() => {
    if (!activeChat || (activeChat.type !== 'group' && activeChat.type !== 'channel')) {
      return [];
    }
    const match = text.match(/(?:^|\s)@([a-zA-Z0-9_.-]*)$/);
    if (!match) return [];
    const query = (match[1] || '').toLowerCase();
    return (activeChat.memberIds || [])
      .filter((uid) => uid !== currentUser?.uid)
      .map((uid) => usersMap[uid])
      .filter((u): u is NonNullable<typeof u> => Boolean(u && u.username))
      .filter(
        (u) =>
          u.username.toLowerCase().includes(query) ||
          u.displayName.toLowerCase().includes(query)
      )
      .slice(0, 5);
  }, [activeChat, text, currentUser?.uid, usersMap]);

  const handleInsertMention = (username: string) => {
    setText((prev) => prev.replace(/@([a-zA-Z0-9_.-]*)$/, `@${username} `));
    textareaRef.current?.focus();
  };

  const clearTypingIndicator = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingSentRef.current) {
      isTypingSentRef.current = false;
      updateTypingStatus(false, undefined, 'typing').catch(() => {});
    }
  };

  const showTemporaryUploadError = (msg: string) => {
    setUploadError(msg);
    setTimeout(() => setUploadError(null), 4000);
  };

  const handleSendText = async () => {
    if (!text.trim()) return;

    clearTypingIndicator();

    if (editingMessage) {
      await editMessageText(editingMessage.id, text.trim());
      setText('');
      setEditingMessage(null);
      return;
    }

    const msgText = text;
    const spoiler = isSpoilerActive;
    setText('');
    setIsSpoilerActive(false);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendMessage(msgText, 'text', { isSpoiler: spoiler });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  // Compressed Image Upload (Safe for Cloud Firestore 1MB limit)
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setShowAttachMenu(false);
    try {
      const compressed = await compressImageFile(file, 900, 0.78);
      const estimatedBytes = estimateDataUrlBytes(compressed);
      await sendMessage('📷 صورة', 'image', {
        mediaUrl: compressed,
        mediaName: file.name,
        mediaSize: estimatedBytes > 0 ? formatBytes(estimatedBytes) : undefined,
      });
    } catch (err) {
      showTemporaryUploadError(err instanceof Error ? err.message : 'تعذر إرسال الصورة');
    }
  };

  // Video Upload via Firebase Storage with progress bar
  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setShowAttachMenu(false);
    setUploadError(null);
    setUploadLabel(`جاري رفع الفيديو: ${file.name}`);
    setUploadProgress(5);
    try {
      await sendVideoMessage(file, text.trim(), (pct) => setUploadProgress(pct));
      if (text.trim()) setText('');
    } catch (err) {
      showTemporaryUploadError(err instanceof Error ? err.message : 'تعذر رفع الفيديو');
    } finally {
      setUploadProgress(null);
      setUploadLabel('');
    }
  };

  // Document Upload (up to 15MB via Firebase Storage with <450KB inline fallback)
  const handleDocSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChatId) return;
    e.target.value = '';
    setShowAttachMenu(false);
    setUploadError(null);

    if (file.size > 15 * 1024 * 1024) {
      showTemporaryUploadError('الحد الأقصى لحجم المستندات هو 15 ميجابايت');
      return;
    }

    setUploadLabel(`جاري رفع الملف: ${file.name}`);
    setUploadProgress(5);
    try {
      const uploaded = await uploadMediaWithFallback(
        file,
        `chats/${activeChatId}/files`,
        file.name,
        { onProgress: (pct) => setUploadProgress(pct) }
      );
      await sendMessage(file.name, 'file', {
        mediaUrl: uploaded.url,
        mediaName: file.name,
        mediaSize: formatBytes(file.size),
      });
    } catch (err) {
      showTemporaryUploadError(err instanceof Error ? err.message : 'تعذر رفع الملف');
    } finally {
      setUploadProgress(null);
      setUploadLabel('');
    }
  };

  const handleSendSticker = async (sticker: SelectableSticker) => {
    await sendStickerMessage(sticker);
    setShowEmojiPicker(false);
  };

  const handleStartVoice = async () => {
    setIsRecording(true);
    audioChunksRef.current = [];
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
      }
    } catch {
      mediaRecorderRef.current = null;
    }
  };

  const stopRecorderStream = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
  };

  const handleCancelVoice = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch {
      // Ignore
    }
    stopRecorderStream();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    updateTypingStatus(false, activeChatId || undefined, 'typing').catch(() => {});
  };

  const handleFinishVoice = async () => {
    const duration = Math.max(recordingSeconds, 1);
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = async () => {
        stopRecorderStream();
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        updateTypingStatus(false, activeChatId || undefined, 'typing').catch(() => {});
        if (blob.size > 0 && activeChatId) {
          try {
            const uploaded = await uploadMediaWithFallback(
              blob,
              `chats/${activeChatId}/voice`,
              `voice_${Date.now()}.webm`
            );
            await sendMessage('🎤 رسالة صوتية', 'voice', {
              voiceDuration: duration,
              mediaUrl: uploaded.url,
            });
          } catch {
            await sendMessage('🎤 رسالة صوتية', 'voice', { voiceDuration: duration });
          }
        } else {
          await sendMessage('🎤 رسالة صوتية', 'voice', { voiceDuration: duration });
        }
      };
      recorder.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);
    } else {
      setIsRecording(false);
      updateTypingStatus(false, activeChatId || undefined, 'typing').catch(() => {});
      await sendMessage('🎤 رسالة صوتية', 'voice', {
        voiceDuration: duration,
      });
    }
  };

  const emojis = [
    '😀', '😂', '😍', '😎', '🥳', '🔥', '❤️', '👍', '🙏', '👏',
    '🎉', '✨', '🤔', '🙌', '💯', '🚀', '☕️', '🌟', '💪', '🤩',
    '😉', '🤝', '😊', '👌', '⚡️', '🍉', '🍕', '🎯', '💡', '🌈',
  ];

  // 1. Non-member Join Bar for Groups & Channels
  if (activeChat && !isActiveChatMember && (activeChat.type === 'channel' || activeChat.type === 'group')) {
    const isChannel = activeChat.type === 'channel';
    return (
      <div
        className={`relative border-t shrink-0 px-4 py-3 select-none backdrop-blur-md transition-colors duration-150 ${
          theme === 'light'
            ? 'bg-white/95 border-slate-200/80'
            : 'bg-[#111923]/95 border-white/[0.06]'
        }`}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-center">
          <button
            type="button"
            disabled={isJoiningChat}
            onClick={async () => {
              if (isJoiningChat) return;
              setIsJoiningChat(true);
              try {
                await joinChat(activeChat.id);
              } finally {
                setIsJoiningChat(false);
              }
            }}
            className="w-full sm:w-auto sm:min-w-[260px] py-2.5 px-6 rounded-xl bg-[#2481cc] hover:bg-[#1e6fb1] text-white text-sm font-bold shadow-md shadow-[#2481cc]/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60"
          >
            <UserPlus className="w-4 h-4" />
            <span>
              {isJoiningChat
                ? 'جاري الانضمام...'
                : isChannel
                ? 'انضمام إلى القناة'
                : 'انضمام إلى المجموعة'}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Selection Mode Action Bar
  if (isSelectionMode) {
    const selectedCount = selectedMessageIds.length;
    const hasCopyableText = selectedMessages.some((m) => !m.isDeleted && Boolean(m.text?.trim()));

    return (
      <div
        className={`relative border-t shrink-0 px-3 py-2.5 sm:px-4 select-none backdrop-blur-md transition-colors duration-150 ${
          theme === 'light'
            ? 'bg-white/95 border-slate-200/80'
            : 'bg-[#111923]/95 border-white/[0.06]'
        }`}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  : 'bg-white/[0.06] text-[#8ea0b5] hover:text-white hover:bg-white/[0.1]'
              }`}
            >
              إلغاء
            </button>
            <span
              className={`text-xs font-semibold tabular-nums ${
                theme === 'light' ? 'text-slate-600' : 'text-[#8ea0b5]'
              }`}
            >
              {selectedCount > 0 ? `${selectedCount} محددة` : 'اضغط على الرسائل لتحديدها'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {hasCopyableText && (
              <button
                type="button"
                onClick={() => {
                  const joined = selectedMessages
                    .filter((m) => !m.isDeleted)
                    .map((m) => m.text?.trim())
                    .filter(Boolean)
                    .join('\n');
                  if (!joined) return;
                  navigator.clipboard.writeText(joined);
                  setCopiedSelection(true);
                  setTimeout(() => setCopiedSelection(false), 1800);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  copiedSelection
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
                    : theme === 'light'
                    ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    : 'bg-[#162230] border-white/[0.08] text-white hover:bg-[#1e2d3f]'
                }`}
              >
                {copiedSelection ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedSelection ? 'تم النسخ' : 'نسخ'}</span>
              </button>
            )}

            {activeChat?.type !== 'saved' && (
              <button
                type="button"
                disabled={selectedCount === 0 || savingToSaved}
                onClick={async () => {
                  if (selectedMessages.length === 0 || savingToSaved) return;
                  setSavingToSaved(true);
                  try {
                    await forwardMessages(selectedMessages, [{ isSaved: true }]);
                  } finally {
                    setSavingToSaved(false);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  theme === 'light'
                    ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                    : 'bg-amber-500/10 border-amber-500/25 text-amber-300 hover:bg-amber-500/20'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>حفظ في المحفوظة</span>
              </button>
            )}

            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => openForwardModal(selectedMessages)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2481cc] hover:bg-[#1e6fb1] text-white text-xs font-bold shadow-md shadow-[#2481cc]/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Forward className="w-3.5 h-3.5" />
              <span>تحويل</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Blocked Direct User Bar
  if (activeChat && isActiveChatBlocked) {
    const otherUid = activeChat.memberIds.find((id) => id !== currentUser?.uid);
    return (
      <div
        className={`relative border-t shrink-0 px-4 py-3 select-none backdrop-blur-md transition-colors duration-150 ${
          theme === 'light'
            ? 'bg-white/95 border-slate-200/80 text-slate-700'
            : 'bg-[#111923]/95 border-white/[0.06] text-slate-200'
        }`}
      >
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
            <Ban className="w-4 h-4" />
            <span>قمت بحظر هذا المستخدم — قم بإلغاء الحظر للمراسلة</span>
          </div>
          {otherUid && (
            <button
              type="button"
              disabled={isUnblocking}
              onClick={async () => {
                setIsUnblocking(true);
                try {
                  await toggleBlockUser(otherUid);
                } finally {
                  setIsUnblocking(false);
                }
              }}
              className="px-4 py-1.5 rounded-xl bg-[#2481cc] hover:bg-[#1e6fb1] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
            >
              {isUnblocking ? 'جاري التنفيذ...' : 'إلغاء حظر المستخدم'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // 4. Channel Read-Only Bar for non-moderator subscribers
  if (activeChat && isActiveChatMember && activeChat.type === 'channel' && !canPostInActiveChat) {
    const isMuted = Boolean(userProfile?.mutedChatIds?.includes(activeChat.id));
    return (
      <div
        className={`relative border-t shrink-0 px-4 py-3 select-none backdrop-blur-md transition-colors duration-150 ${
          theme === 'light'
            ? 'bg-white/95 border-slate-200/80 text-slate-600'
            : 'bg-[#111923]/95 border-white/[0.06] text-[#8ea0b5]'
        }`}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <span className="text-xs font-semibold">النشر مقتصر على مشرفي القناة</span>
          <button
            type="button"
            onClick={() => toggleMuteChat(activeChat.id)}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              isMuted
                ? 'bg-[#2481cc] text-white border-[#2481cc]'
                : theme === 'light'
                ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                : 'bg-white/[0.06] border-white/[0.08] text-white hover:bg-white/[0.1]'
            }`}
          >
            {isMuted ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            <span>{isMuted ? 'إلغاء الكتم' : 'كتم الإشعارات'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={pickerWrapperRef}
      className={`relative border-t shrink-0 p-2.5 sm:p-3 select-none backdrop-blur-md transition-colors duration-150 ${
        theme === 'light'
          ? 'bg-white/95 border-slate-200/80'
          : 'bg-[#111923]/95 border-white/[0.06]'
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageSelect}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={videoInputRef}
        onChange={handleVideoSelect}
        accept="video/*"
        className="hidden"
      />
      <input
        type="file"
        ref={docInputRef}
        onChange={handleDocSelect}
        accept=".pdf,.doc,.docx,.zip,.rar,.txt,.csv,.xlsx,.pptx"
        className="hidden"
      />

      {/* @mention Autocomplete Popover */}
      {mentionSuggestions.length > 0 && !isRecording && (
        <div
          className={`absolute bottom-full mb-2 right-3 left-3 sm:right-auto sm:w-72 rounded-2xl shadow-2xl border overflow-hidden z-50 backdrop-blur-xl ${
            theme === 'light'
              ? 'bg-white/95 border-slate-200/80 text-slate-900'
              : 'bg-[#162230]/95 border-white/[0.08] text-white'
          }`}
        >
          <div className="px-3 py-1.5 text-[10px] font-bold text-[#8ea0b5] border-b border-white/[0.06]">
            الإشارة إلى عضو
          </div>
          {mentionSuggestions.map((u) => (
            <button
              key={u.uid}
              type="button"
              onClick={() => handleInsertMention(u.username)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-right cursor-pointer ${
                theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] text-white shrink-0 overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                  u.uid
                )}`}
              >
                {u.photoURL ? (
                  <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                ) : (
                  <span>{getInitials(u.displayName)}</span>
                )}
              </div>
              <span className="font-semibold truncate flex-1">{u.displayName}</span>
              <span className="font-mono text-[11px] text-[#2481cc] shrink-0" dir="ltr">
                @{u.username}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Upload Progress / Error Bar */}
      {uploadProgress !== null && (
        <div
          className={`mb-2 p-2.5 rounded-xl border text-xs ${
            theme === 'light'
              ? 'bg-sky-50 border-sky-200 text-slate-800'
              : 'bg-[#162230] border-[#2481cc]/30 text-white'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="truncate font-semibold">{uploadLabel || 'جاري الرفع...'}</span>
            <span className="font-mono tabular-nums text-[#2481cc] font-bold">{uploadProgress}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-black/20 overflow-hidden">
            <div
              className="h-full bg-[#2481cc] transition-all duration-150"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {uploadError && (
        <div className="mb-2 px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="p-0.5 rounded-full hover:bg-rose-500/20 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Editing Message Banner */}
      {editingMessage && (
        <div
          className={`flex items-center justify-between p-2.5 mb-2 rounded-xl border text-xs ${
            theme === 'light'
              ? 'bg-amber-50 border-amber-200/80'
              : 'bg-amber-950/30 border-amber-500/20'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
              <Edit2 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-amber-500 leading-tight">تعديل الرسالة</div>
              <div
                className={`truncate mt-0.5 ${
                  theme === 'light' ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                {editingMessage.text}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingMessage(null);
              setText('');
            }}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
              theme === 'light'
                ? 'text-slate-400 hover:text-slate-700 hover:bg-amber-100/70'
                : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
            }`}
            aria-label="إلغاء التعديل"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quoted Reply Preview Bar */}
      {replyingTo && !editingMessage && (
        <div
          className={`flex items-center justify-between p-2.5 mb-2 rounded-xl border text-xs ${
            theme === 'light'
              ? 'bg-slate-50 border-slate-200/80'
              : 'bg-[#162230] border-white/[0.07]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#2481cc]/12 text-[#2481cc] flex items-center justify-center shrink-0">
              <Reply className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[#2481cc] truncate leading-tight">
                الرد على {usersMap[replyingTo.senderId]?.displayName || replyingTo.senderName}
              </div>
              <div
                className={`truncate mt-0.5 ${
                  theme === 'light' ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                {getMessageReplyPreview(replyingTo)}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
              theme === 'light'
                ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/60'
                : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
            }`}
            title="إلغاء الرد"
            aria-label="إلغاء الرد"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Input Row */}
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowAttachMenu(!showAttachMenu);
              setShowEmojiPicker(false);
            }}
            className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors duration-150 cursor-pointer ${
              showAttachMenu
                ? 'text-[#2481cc] bg-[#2481cc]/15'
                : theme === 'light'
                ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
            }`}
            title="إرفاق ملف"
            aria-label="إرفاق ملف"
          >
            <Paperclip className="w-5 h-5 -rotate-45" />
          </button>

          {showAttachMenu && (
            <div
              className={`absolute bottom-13 right-0 rounded-2xl shadow-2xl border overflow-hidden p-1.5 flex flex-col gap-1 min-w-[205px] z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 ${
                theme === 'light'
                  ? 'bg-white/95 border-slate-200/80 text-slate-800'
                  : 'bg-[#162230]/95 border-white/[0.08] text-white'
              }`}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition-colors text-right cursor-pointer ${
                  theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-[#2481cc]/15 text-[#2481cc] flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <span>صورة</span>
              </button>

              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className={`flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition-colors text-right cursor-pointer ${
                  theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-rose-500/15 text-rose-500 flex items-center justify-center">
                  <Video className="w-4 h-4" />
                </div>
                <span>فيديو</span>
              </button>

              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                className={`flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition-colors text-right cursor-pointer ${
                  theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <span>ملف أو مستند</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAttachMenu(false);
                  onOpenPollModal();
                }}
                className={`flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition-colors text-right cursor-pointer ${
                  theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center">
                  <BarChart2 className="w-4 h-4" />
                </div>
                <span>استطلاع رأي</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAttachMenu(false);
                  sendDiceRoll('🎲');
                }}
                className={`flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-xl transition-colors text-right cursor-pointer ${
                  theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-purple-500/15 text-purple-500 flex items-center justify-center">
                  <Dices className="w-4 h-4" />
                </div>
                <span>رمي نرد عشوائي</span>
              </button>
            </div>
          )}
        </div>

        {isRecording ? (
          <div
            className={`flex-1 flex items-center justify-between px-4 py-2.5 rounded-2xl border ${
              theme === 'light'
                ? 'bg-rose-50 border-rose-200 text-rose-600'
                : 'bg-rose-950/30 border-rose-500/30 text-rose-400'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="font-mono tabular-nums text-sm font-bold">
                {formatDuration(recordingSeconds)}
              </span>
              <span className="text-xs font-medium">جاري تسجيل رسالة صوتية...</span>
            </div>

            <button
              type="button"
              onClick={handleCancelVoice}
              className="text-xs font-bold hover:underline cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        ) : (
          <div
            className={`flex-1 flex items-end rounded-2xl px-3 py-1.5 border transition-all duration-150 focus-within:ring-2 ${
              theme === 'light'
                ? 'bg-slate-100 border-slate-200/70 focus-within:bg-white focus-within:border-[#2481cc] focus-within:ring-[#2481cc]/20'
                : 'bg-[#1a2533] border-white/[0.07] focus-within:bg-[#1e2b3b] focus-within:border-[#2481cc] focus-within:ring-[#2481cc]/25'
            }`}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={(e) => {
                const val = e.target.value;
                setText(val);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;

                if (val.trim().length > 0) {
                  const now = Date.now();
                  if (!isTypingSentRef.current || now - lastTypingPingRef.current > 2000) {
                    isTypingSentRef.current = true;
                    lastTypingPingRef.current = now;
                    updateTypingStatus(true, undefined, 'typing').catch(() => {});
                  }
                  if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                  typingTimeoutRef.current = setTimeout(() => {
                    if (isTypingSentRef.current) {
                      isTypingSentRef.current = false;
                      updateTypingStatus(false, undefined, 'typing').catch(() => {});
                    }
                  }, 3500);
                } else if (isTypingSentRef.current) {
                  clearTypingIndicator();
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={editingMessage ? 'عدّل الرسالة...' : 'اكتب رسالة...'}
              className={`w-full py-1 text-sm bg-transparent outline-hidden resize-none max-h-32 text-right ${
                theme === 'light'
                  ? 'text-slate-900 placeholder-slate-400'
                  : 'text-white placeholder-[#7f91a4]'
              }`}
            />

            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsSpoilerActive(!isSpoilerActive)}
                className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                  isSpoilerActive
                    ? 'text-amber-400 bg-amber-400/20'
                    : theme === 'light'
                    ? 'text-slate-400 hover:text-slate-700'
                    : 'text-[#8ea0b5] hover:text-white'
                }`}
                title="تأثير نص مخفي (Spoiler)"
                aria-label="تأثير نص مخفي"
              >
                <EyeOff className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (showEmojiPicker && activePickerTab === 'sticker') {
                    setShowEmojiPicker(false);
                  } else {
                    setActivePickerTab('sticker');
                    setShowEmojiPicker(true);
                    setShowAttachMenu(false);
                  }
                }}
                className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                  showEmojiPicker && activePickerTab === 'sticker'
                    ? 'text-[#2481cc] bg-[#2481cc]/12'
                    : theme === 'light'
                    ? 'text-slate-400 hover:text-slate-700'
                    : 'text-[#8ea0b5] hover:text-white'
                }`}
                title="الملصقات"
                aria-label="فتح منتقي الملصقات"
              >
                <Sticker className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (showEmojiPicker && activePickerTab === 'emoji') {
                    setShowEmojiPicker(false);
                  } else {
                    setActivePickerTab('emoji');
                    setShowEmojiPicker(true);
                    setShowAttachMenu(false);
                  }
                }}
                className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                  showEmojiPicker && activePickerTab === 'emoji'
                    ? 'text-[#2481cc] bg-[#2481cc]/12'
                    : theme === 'light'
                    ? 'text-slate-400 hover:text-slate-700'
                    : 'text-[#8ea0b5] hover:text-white'
                }`}
                title="الرموز التعبيرية"
                aria-label="فتح الرموز التعبيرية"
              >
                <Smile className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {editingMessage ? (
          <button
            type="button"
            onClick={handleSendText}
            className="w-10 h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center shrink-0 shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            title="حفظ التعديل"
          >
            <Check className="w-5 h-5" />
          </button>
        ) : text.trim() ? (
          <button
            type="button"
            onClick={handleSendText}
            className="w-10 h-10 rounded-xl bg-[#2481cc] hover:bg-[#1e6fb1] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#2481cc]/25 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            title="إرسال"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        ) : isRecording ? (
          <button
            type="button"
            onClick={handleFinishVoice}
            className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            title="إرسال التسجيل"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStartVoice}
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              theme === 'light'
                ? 'text-slate-500 hover:bg-slate-100 hover:text-[#2481cc]'
                : 'text-[#8ea0b5] hover:bg-white/[0.06] hover:text-[#2481cc]'
            }`}
            title="تسجيل رسالة صوتية"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Emoji & Sticker Drawer Popover */}
      {showEmojiPicker && (
        <div
          className={`absolute bottom-16 left-4 right-4 sm:left-auto sm:right-16 sm:w-[340px] rounded-2xl shadow-2xl border overflow-hidden z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 ${
            theme === 'light'
              ? 'bg-white/95 border-slate-200/80'
              : 'bg-[#162230]/95 border-white/[0.08]'
          }`}
        >
          <div
            className={`flex border-b text-xs font-semibold ${
              theme === 'light' ? 'border-slate-100' : 'border-white/[0.06]'
            }`}
          >
            <button
              type="button"
              onClick={() => setActivePickerTab('emoji')}
              className={`flex-1 py-2.5 text-center transition-colors cursor-pointer ${
                activePickerTab === 'emoji'
                  ? 'text-[#2481cc] border-b-2 border-[#2481cc]'
                  : theme === 'light'
                  ? 'text-slate-500 hover:text-slate-800'
                  : 'text-[#8ea0b5] hover:text-white'
              }`}
            >
              الرموز التعبيرية
            </button>
            <button
              type="button"
              onClick={() => setActivePickerTab('sticker')}
              className={`flex-1 py-2.5 text-center transition-colors cursor-pointer ${
                activePickerTab === 'sticker'
                  ? 'text-[#2481cc] border-b-2 border-[#2481cc]'
                  : theme === 'light'
                  ? 'text-slate-500 hover:text-slate-800'
                  : 'text-[#8ea0b5] hover:text-white'
              }`}
            >
              ملصقات JanaX
            </button>
          </div>

          <div className="p-3">
            {activePickerTab === 'emoji' ? (
              <div className="grid grid-cols-6 gap-2 text-xl text-center max-h-64 overflow-y-auto">
                {emojis.map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    onClick={() => setText((prev) => prev + emoji)}
                    className="p-1.5 rounded-lg hover:scale-125 transition-transform cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : (
              <StickerPicker onSelectSticker={handleSendSticker} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
