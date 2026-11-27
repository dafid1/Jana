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
  Lock,
  Trash2,
  MapPin,
  Contact,
  Disc2,
  Sparkles,
  Search,
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

const makeAnimatedGifDataUrl = (
  bg1: string,
  bg2: string,
  emoji: string,
  label: string,
  animType: 'bounce' | 'pulse' | 'spin'
) => {
  const anim =
    animType === 'bounce'
      ? `<animateTransform attributeName="transform" type="translate" values="0 4; 0 -10; 0 4" dur="1.1s" repeatCount="indefinite"/>`
      : animType === 'spin'
      ? `<animateTransform attributeName="transform" type="rotate" from="-10 90 72" to="10 90 72" dur="0.9s" repeatCount="indefinite" additive="sum"/>`
      : `<animate attributeName="font-size" values="46;56;46" dur="1.2s" repeatCount="indefinite"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 140"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bg1}"/><stop offset="100%" stop-color="${bg2}"/></linearGradient></defs><rect width="180" height="140" rx="18" fill="url(#g)"/><text x="90" y="82" text-anchor="middle" font-size="48">${emoji}${anim}</text><text x="90" y="122" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="14" fill="rgba(255,255,255,0.92)">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const ANIMATED_GIFS = [
  { id: 'gif_heart', emoji: '❤️', label: 'حب كبير', url: makeAnimatedGifDataUrl('#be123c', '#f43f5e', '❤️', 'أحبك', 'pulse') },
  { id: 'gif_laugh', emoji: '😂', label: 'ضحك', url: makeAnimatedGifDataUrl('#d97706', '#fbbf24', '😂', 'ههه رائع', 'bounce') },
  { id: 'gif_fire', emoji: '🔥', label: 'نار', url: makeAnimatedGifDataUrl('#c2410c', '#f97316', '🔥', 'ممتاز!', 'pulse') },
  { id: 'gif_party', emoji: '🥳', label: 'احتفال', url: makeAnimatedGifDataUrl('#6d28d9', '#ec4899', '🥳', 'مبروك!', 'bounce') },
  { id: 'gif_clap', emoji: '👏', label: 'تصفيق', url: makeAnimatedGifDataUrl('#0369a1', '#38bdf8', '👏', 'برافو', 'pulse') },
  { id: 'gif_star', emoji: '🌟', label: 'نجم', url: makeAnimatedGifDataUrl('#1e3a8a', '#3b82f6', '🌟', 'أسطوري', 'spin') },
  { id: 'gif_cool', emoji: '😎', label: 'كول', url: makeAnimatedGifDataUrl('#0f766e', '#14b8a6', '😎', 'تمااام', 'bounce') },
  { id: 'gif_100', emoji: '💯', label: '100%', url: makeAnimatedGifDataUrl('#15803d', '#22c55e', '💯', 'مئة بالمئة', 'pulse') },
  { id: 'gif_rocket', emoji: '🚀', label: 'انطلاق', url: makeAnimatedGifDataUrl('#312e81', '#6366f1', '🚀', 'انطلاق!', 'bounce') },
];

export const ChatInput: React.FC<ChatInputProps> = ({ onOpenPollModal }) => {
  const {
    theme,
    currentUser,
    userProfile,
    usersMap,
    allUsers,
    toggleBlockUser,
    toggleMuteChat,
  } = useAuth();
  const {
    activeChat,
    activeChatId,
    sendMessage,
    sendVideoMessage,
    sendVideoNote,
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
  const [attachSubView, setAttachSubView] = useState<'grid' | 'contacts'>('grid');
  const [contactSearch, setContactSearch] = useState('');
  const [sendingLocation, setSendingLocation] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activePickerTab, setActivePickerTab] = useState<'emoji' | 'sticker' | 'gif'>('emoji');
  const [isSpoilerActive, setIsSpoilerActive] = useState(false);
  const [copiedSelection, setCopiedSelection] = useState(false);
  const [savingToSaved, setSavingToSaved] = useState(false);
  const [isJoiningChat, setIsJoiningChat] = useState(false);
  const [isUnblocking, setIsUnblocking] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadLabel, setUploadLabel] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [modeHint, setModeHint] = useState<string | null>(null);

  // Voice & Video Note recording state
  const [recordMode, setRecordMode] = useState<'voice' | 'video_note'>('voice');
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingLocked, setIsRecordingLocked] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Circular Video Note recorder modal state
  const [isRecordingVideoNote, setIsRecordingVideoNote] = useState(false);
  const [videoNoteSeconds, setVideoNoteSeconds] = useState(0);
  const [videoNoteSending, setVideoNoteSending] = useState(false);

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

  // Video Note refs
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const videoNoteRecorderRef = useRef<MediaRecorder | null>(null);
  const videoNoteStreamRef = useRef<MediaStream | null>(null);
  const videoNoteChunksRef = useRef<Blob[]>([]);
  const videoNoteTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Gesture refs for hold-to-record + slide-to-cancel / slide-up-to-lock
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gestureStartRef = useRef<{ x: number; y: number } | null>(null);
  const didHoldStartRef = useRef(false);
  const isLockedRef = useRef(false);
  const recordingSecondsRef = useRef(0);

  useBackHandler(
    Boolean(activeChat) && (showEmojiPicker || showAttachMenu || isRecordingVideoNote),
    () => {
      if (isRecordingVideoNote) {
        cancelVideoNote();
        return;
      }
      setShowEmojiPicker(false);
      setShowAttachMenu(false);
      setAttachSubView('grid');
    },
    45
  );

  // Close Emoji/Sticker docked panel on Escape
  useEffect(() => {
    if (!showEmojiPicker && !showAttachMenu) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowEmojiPicker(false);
        setShowAttachMenu(false);
        setAttachSubView('grid');
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
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
      recordingSecondsRef.current = 0;
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          recordingSecondsRef.current = next;
          return next;
        });
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
      recordingSecondsRef.current = 0;
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (recordingTypingIntervalRef.current) {
        clearInterval(recordingTypingIntervalRef.current);
        recordingTypingIntervalRef.current = null;
      }
    };
  }, [isRecording, activeChatId]);

  useEffect(() => {
    if (isRecordingVideoNote && videoPreviewRef.current && videoNoteStreamRef.current) {
      videoPreviewRef.current.srcObject = videoNoteStreamRef.current;
      videoPreviewRef.current.play().catch(() => {});
    }
  }, [isRecordingVideoNote]);

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

  const contactCandidates = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    return allUsers
      .filter((u) => u.uid !== currentUser?.uid)
      .filter(
        (u) =>
          !q ||
          u.displayName.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          (u.phone || '').toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [allUsers, currentUser?.uid, contactSearch]);

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

  const showTemporaryHint = (msg: string) => {
    setModeHint(msg);
    setTimeout(() => setModeHint(null), 2200);
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

  // Compressed Image Upload
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

  // Video Upload
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

  // Document Upload
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
  };

  const handleSendLocation = () => {
    if (!navigator.geolocation) {
      showTemporaryUploadError('المتصفح لا يدعم مشاركة الموقع الجغرافي');
      setShowAttachMenu(false);
      return;
    }
    setSendingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        const mapUrl = `https://maps.google.com/?q=${lat},${lng}`;
        setSendingLocation(false);
        setShowAttachMenu(false);
        await sendMessage(`📍 موقعي الحالي\n${mapUrl}`, 'text', {
          linkPreview: {
            url: mapUrl,
            title: 'موقع جغرافي مشترك',
            description: `الإحداثيات: ${lat}, ${lng}`,
            domain: 'maps.google.com',
          },
        });
      },
      () => {
        setSendingLocation(false);
        setShowAttachMenu(false);
        showTemporaryUploadError('يرجى السماح بصلاحية الموقع لمشاركة موقعك');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSendContact = async (contact: (typeof allUsers)[number]) => {
    setShowAttachMenu(false);
    setAttachSubView('grid');
    setContactSearch('');
    const phoneLine = contact.phone ? `\n📱 ${contact.phone}` : '';
    await sendMessage(
      `📇 جهة اتصال: ${contact.displayName}\n@${contact.username}${phoneLine}`,
      'text'
    );
  };

  // --- Voice Recording ---
  const handleStartVoice = async () => {
    setIsRecording(true);
    setIsRecordingLocked(false);
    isLockedRef.current = false;
    setDragOffset({ x: 0, y: 0 });
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
    setIsRecordingLocked(false);
    isLockedRef.current = false;
    setDragOffset({ x: 0, y: 0 });
    updateTypingStatus(false, activeChatId || undefined, 'typing').catch(() => {});
  };

  const handleFinishVoice = async () => {
    const duration = Math.max(recordingSecondsRef.current, 1);
    const recorder = mediaRecorderRef.current;

    setIsRecording(false);
    setIsRecordingLocked(false);
    isLockedRef.current = false;
    setDragOffset({ x: 0, y: 0 });

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
    } else {
      updateTypingStatus(false, activeChatId || undefined, 'typing').catch(() => {});
      await sendMessage('🎤 رسالة صوتية', 'voice', {
        voiceDuration: duration,
      });
    }
  };

  // --- Circular Video Note Recorder ---
  const stopVideoNoteStream = () => {
    if (videoNoteTimerRef.current) {
      clearInterval(videoNoteTimerRef.current);
      videoNoteTimerRef.current = null;
    }
    if (videoNoteStreamRef.current) {
      videoNoteStreamRef.current.getTracks().forEach((t) => t.stop());
      videoNoteStreamRef.current = null;
    }
  };

  const startVideoNote = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showTemporaryUploadError('الكاميرا غير مدعومة في هذا المتصفح');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
        audio: true,
      });
      videoNoteStreamRef.current = stream;
      videoNoteChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) videoNoteChunksRef.current.push(ev.data);
      };
      recorder.start();
      videoNoteRecorderRef.current = recorder;
      setVideoNoteSeconds(0);
      setIsRecordingVideoNote(true);
      updateTypingStatus(true, activeChatId || undefined, 'recording').catch(() => {});
      videoNoteTimerRef.current = setInterval(() => {
        setVideoNoteSeconds((prev) => {
          if (prev >= 59) {
            finishVideoNote();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      stopVideoNoteStream();
      showTemporaryUploadError('تعذر الوصول إلى الكاميرا لتسجيل فيديو دائري');
    }
  };

  const cancelVideoNote = () => {
    try {
      if (videoNoteRecorderRef.current && videoNoteRecorderRef.current.state !== 'inactive') {
        videoNoteRecorderRef.current.stop();
      }
    } catch {
      // Ignore
    }
    videoNoteRecorderRef.current = null;
    stopVideoNoteStream();
    setIsRecordingVideoNote(false);
    setVideoNoteSeconds(0);
    updateTypingStatus(false, activeChatId || undefined, 'typing').catch(() => {});
  };

  const finishVideoNote = () => {
    const recorder = videoNoteRecorderRef.current;
    const dur = Math.max(videoNoteSeconds, 1);
    if (!recorder || recorder.state === 'inactive') {
      cancelVideoNote();
      return;
    }
    setVideoNoteSending(true);
    recorder.onstop = async () => {
      stopVideoNoteStream();
      const blob = new Blob(videoNoteChunksRef.current, { type: recorder.mimeType || 'video/webm' });
      videoNoteRecorderRef.current = null;
      setIsRecordingVideoNote(false);
      setVideoNoteSeconds(0);
      updateTypingStatus(false, activeChatId || undefined, 'typing').catch(() => {});
      try {
        if (blob.size > 0) {
          await sendVideoNote(blob, dur);
        }
      } catch (err) {
        showTemporaryUploadError(err instanceof Error ? err.message : 'تعذر إرسال الفيديو الدائري');
      } finally {
        setVideoNoteSending(false);
      }
    };
    recorder.stop();
  };

  // Hold-to-record + drag-left-to-cancel + drag-up-to-lock pointer handlers
  const handleRecordPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    gestureStartRef.current = { x: e.clientX, y: e.clientY };
    didHoldStartRef.current = false;
    setDragOffset({ x: 0, y: 0 });

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      didHoldStartRef.current = true;
      if (recordMode === 'voice') {
        handleStartVoice();
      } else {
        startVideoNote();
      }
    }, 220);
  };

  const handleRecordPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!gestureStartRef.current || !didHoldStartRef.current || recordMode !== 'voice' || isLockedRef.current) {
      return;
    }
    const dx = e.clientX - gestureStartRef.current.x;
    const dy = e.clientY - gestureStartRef.current.y;
    setDragOffset({ x: dx, y: dy });

    if (dy < -48) {
      isLockedRef.current = true;
      setIsRecordingLocked(true);
      setDragOffset({ x: 0, y: 0 });
      return;
    }
    if (Math.abs(dx) > 80) {
      gestureStartRef.current = null;
      didHoldStartRef.current = false;
      handleCancelVoice();
      showTemporaryHint('تم إلغاء التسجيل الصوتي');
    }
  };

  const handleRecordPointerUp = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (!didHoldStartRef.current) {
      // Short tap: toggle between Voice Mic and Circular Video Note!
      const next = recordMode === 'voice' ? 'video_note' : 'voice';
      setRecordMode(next);
      showTemporaryHint(
        next === 'video_note'
          ? 'وضع الفيديو الدائري: اضغط مطولاً للتسجيل'
          : 'وضع الرسائل الصوتية: اضغط مطولاً للتسجيل'
      );
      gestureStartRef.current = null;
      return;
    }

    gestureStartRef.current = null;
    didHoldStartRef.current = false;

    if (recordMode === 'voice' && !isLockedRef.current) {
      handleFinishVoice();
    }
  };

  const emojis = [
    '😀', '😂', '😍', '😎', '🥳', '🔥', '❤️', '👍', '🙏', '👏',
    '🎉', '✨', '🤔', '🙌', '💯', '🚀', '☕️', '🌟', '💪', '🤩',
    '😉', '🤝', '😊', '👌', '⚡️', '🍉', '🍕', '🎯', '💡', '🌈',
    '🥰', '😭', '😡', '🤯', '🫡', '🫶', '💎', '🏆', '🎵', '🌙',
  ];

  // 1. Non-member Join Bar for Groups & Channels
  if (activeChat && !isActiveChatMember && (activeChat.type === 'channel' || activeChat.type === 'group')) {
    const isChannel = activeChat.type === 'channel';
    return (
      <div
        className={`relative border-t shrink-0 px-4 py-3 select-none backdrop-blur-md transition-colors duration-150 ${
          theme === 'light'
            ? 'bg-white/95 border-slate-200/80'
            : 'bg-[#17212b]/95 border-[#0e1621]'
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
            className="w-full sm:w-auto sm:min-w-[260px] py-2.5 px-6 rounded-xl bg-[#3390ec] hover:bg-[#2a7fd4] text-white text-sm font-bold shadow-md shadow-[#3390ec]/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60"
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
            : 'bg-[#17212b]/95 border-[#0e1621]'
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
                    : 'bg-[#242f3d] border-white/[0.08] text-white hover:bg-[#2b3849]'
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3390ec] hover:bg-[#2a7fd4] text-white text-xs font-bold shadow-md shadow-[#3390ec]/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
            : 'bg-[#17212b]/95 border-[#0e1621] text-slate-200'
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
              className="px-4 py-1.5 rounded-xl bg-[#3390ec] hover:bg-[#2a7fd4] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
            >
              {isUnblocking ? 'جاري التنفيذ...' : 'إلغاء حظر المستخدم'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // 4. Channel Read-Only Bar
  if (activeChat && isActiveChatMember && activeChat.type === 'channel' && !canPostInActiveChat) {
    const isMuted = Boolean(userProfile?.mutedChatIds?.includes(activeChat.id));
    return (
      <div
        className={`relative border-t shrink-0 px-4 py-3 select-none backdrop-blur-md transition-colors duration-150 ${
          theme === 'light'
            ? 'bg-white/95 border-slate-200/80 text-slate-600'
            : 'bg-[#17212b]/95 border-[#0e1621] text-[#8ea0b5]'
        }`}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <span className="text-xs font-semibold">النشر مقتصر على مشرفي القناة</span>
          <button
            type="button"
            onClick={() => toggleMuteChat(activeChat.id)}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              isMuted
                ? 'bg-[#3390ec] text-white border-[#3390ec]'
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

  const videoRingDash = 2 * Math.PI * 124;
  const videoProgress = Math.min(1, videoNoteSeconds / 60);

  return (
    <div
      ref={pickerWrapperRef}
      className={`relative border-t shrink-0 select-none transition-colors duration-150 ${
        theme === 'light'
          ? 'bg-white border-slate-200/80'
          : 'bg-[#17212b] border-[#0e1621]'
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

      {/* Circular Video Note Live Camera Recorder Modal */}
      {isRecordingVideoNote && (
        <div className="fixed inset-0 z-[75] flex flex-col items-center justify-center bg-black/75 backdrop-blur-md p-6 select-none animate-in fade-in duration-150">
          <div className="relative w-64 h-64 flex items-center justify-center mb-6">
            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 256 256">
              <circle
                cx="128"
                cy="128"
                r="124"
                fill="none"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="5"
              />
              <circle
                cx="128"
                cy="128"
                r="124"
                fill="none"
                stroke="#3390ec"
                strokeWidth="5"
                strokeDasharray={videoRingDash}
                strokeDashoffset={videoRingDash * (1 - videoProgress)}
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            </svg>

            <div className="w-60 h-60 rounded-full overflow-hidden bg-black shadow-2xl border-2 border-white/20">
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />
            </div>

            <div className="absolute -bottom-3 px-3.5 py-1 rounded-full bg-rose-600 text-white text-xs font-mono font-bold shadow-lg flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>{formatDuration(videoNoteSeconds)}</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button
              type="button"
              disabled={videoNoteSending}
              onClick={cancelVideoNote}
              className="w-13 h-13 rounded-full bg-white/15 hover:bg-rose-600 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="إلغاء"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              type="button"
              disabled={videoNoteSending}
              onClick={finishVideoNote}
              className="w-15 h-15 rounded-full bg-[#3390ec] hover:bg-[#2a7fd4] text-white flex items-center justify-center shadow-2xl shadow-[#3390ec]/40 transition-transform hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-60"
              title="إرسال الفيديو الدائري"
            >
              {videoNoteSending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-6 h-6 ml-0.5" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Mode Hint Toast */}
      {modeHint && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-black/80 text-white text-[11px] font-bold shadow-xl whitespace-nowrap z-50 animate-in fade-in duration-150">
          {modeHint}
        </div>
      )}

      {/* @mention Autocomplete Popover */}
      {mentionSuggestions.length > 0 && !isRecording && (
        <div
          className={`absolute bottom-full mb-2 right-3 left-3 sm:right-auto sm:w-72 rounded-2xl shadow-2xl border overflow-hidden z-50 backdrop-blur-xl ${
            theme === 'light'
              ? 'bg-white/95 border-slate-200/80 text-slate-900'
              : 'bg-[#17212b]/95 border-white/[0.08] text-white'
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
              <span className="font-mono text-[11px] text-[#3390ec] shrink-0" dir="ltr">
                @{u.username}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="p-2 sm:p-2.5">
        {/* Upload Progress / Error Bar */}
        {uploadProgress !== null && (
          <div
            className={`mb-2 p-2.5 rounded-xl border text-xs ${
              theme === 'light'
                ? 'bg-sky-50 border-sky-200 text-slate-800'
                : 'bg-[#242f3d] border-[#3390ec]/30 text-white'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="truncate font-semibold">{uploadLabel || 'جاري الرفع...'}</span>
              <span className="font-mono tabular-nums text-[#3390ec] font-bold">{uploadProgress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-black/20 overflow-hidden">
              <div
                className="h-full bg-[#3390ec] transition-all duration-150"
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
                : 'bg-[#242f3d] border-white/[0.07]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#3390ec]/15 text-[#3390ec] flex items-center justify-center shrink-0">
                <Reply className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-[#3390ec] truncate leading-tight">
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
        <div className="flex items-end gap-2 max-w-4xl mx-auto relative">
          {/* Drag-up-to-lock Floating Pill when holding voice button */}
          {isRecording && !isRecordingLocked && (
            <div
              className={`absolute -top-16 left-0.5 w-10 py-2.5 rounded-full shadow-xl border flex flex-col items-center gap-1 pointer-events-none transition-transform ${
                dragOffset.y < -30 ? 'scale-110 bg-[#3390ec] text-white border-[#3390ec]' : theme === 'light' ? 'bg-white border-slate-200 text-slate-600' : 'bg-[#242f3d] border-white/10 text-slate-300'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span className="text-[9px] font-bold">قفل</span>
            </div>
          )}

          {/* Attach Button (opens Telegram Bottom Sheet) */}
          {!isRecording && (
            <button
              type="button"
              onClick={() => {
                setAttachSubView('grid');
                setShowAttachMenu(true);
                setShowEmojiPicker(false);
              }}
              className={`min-h-[42px] min-w-[42px] flex items-center justify-center rounded-full transition-colors duration-150 cursor-pointer ${
                showAttachMenu
                  ? 'text-[#3390ec] bg-[#3390ec]/15'
                  : theme === 'light'
                  ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
              }`}
              title="إرفاق وسائط أو ملفات"
              aria-label="إرفاق"
            >
              <Paperclip className="w-5 h-5 -rotate-45" />
            </button>
          )}

          {/* Recording Bar OR Telegram Message Pill */}
          {isRecording ? (
            <div
              style={
                !isRecordingLocked && dragOffset.x !== 0
                  ? { transform: `translateX(${dragOffset.x * 0.45}px)` }
                  : undefined
              }
              className={`flex-1 flex items-center justify-between px-4 py-2.5 rounded-3xl border transition-colors ${
                theme === 'light'
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : 'bg-[#242f3d] border-rose-500/30 text-rose-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="font-mono tabular-nums text-sm font-bold">
                  {formatDuration(recordingSeconds)}
                </span>
                {!isRecordingLocked && (
                  <span className="text-xs font-medium opacity-80 hidden sm:inline">
                    اسحب يميناً/يساراً للإلغاء • اسحب للأعلى للقفل
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleCancelVoice}
                className="flex items-center gap-1 text-xs font-bold text-rose-500 hover:underline cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>إلغاء</span>
              </button>
            </div>
          ) : (
            <div
              className={`flex-1 flex items-end rounded-[22px] px-3 py-1.5 border transition-all duration-150 focus-within:ring-2 ${
                theme === 'light'
                  ? 'bg-[#f4f5f7] border-slate-200/70 focus-within:bg-white focus-within:border-[#3390ec] focus-within:ring-[#3390ec]/15'
                  : 'bg-[#242f3d] border-white/[0.05] focus-within:border-[#3390ec] focus-within:ring-[#3390ec]/20'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setShowEmojiPicker((prev) => !prev);
                  setShowAttachMenu(false);
                }}
                className={`p-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                  showEmojiPicker
                    ? 'text-[#3390ec]'
                    : theme === 'light'
                    ? 'text-slate-500 hover:text-slate-800'
                    : 'text-[#8ea0b5] hover:text-white'
                }`}
                title="الرموز والملصقات و GIF"
                aria-label="الرموز والملصقات"
              >
                <Smile className="w-5 h-5" />
              </button>

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
                placeholder={editingMessage ? 'عدّل الرسالة...' : 'الرسالة...'}
                className={`w-full py-1.5 px-1.5 text-sm bg-transparent outline-hidden resize-none max-h-32 text-right ${
                  theme === 'light'
                    ? 'text-slate-900 placeholder-slate-400'
                    : 'text-white placeholder-[#7f91a4]'
                }`}
              />

              <button
                type="button"
                onClick={() => setIsSpoilerActive(!isSpoilerActive)}
                className={`p-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
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
            </div>
          )}

          {/* Send / Edit / Locked Voice Send / Hold-to-Record Mic & Video Note */}
          {editingMessage ? (
            <button
              type="button"
              onClick={handleSendText}
              className="w-11 h-11 rounded-full bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center shrink-0 shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              title="حفظ التعديل"
            >
              <Check className="w-5 h-5" />
            </button>
          ) : text.trim() ? (
            <button
              type="button"
              onClick={handleSendText}
              className="w-11 h-11 rounded-full bg-[#3390ec] hover:bg-[#2a7fd4] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#3390ec]/30 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              title="إرسال"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          ) : isRecording ? (
            <button
              type="button"
              onClick={handleFinishVoice}
              className="w-11 h-11 rounded-full bg-[#3390ec] hover:bg-[#2a7fd4] text-white flex items-center justify-center shrink-0 shadow-lg shadow-[#3390ec]/35 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              title="إرسال الرسالة الصوتية"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          ) : (
            <button
              type="button"
              onPointerDown={handleRecordPointerDown}
              onPointerMove={handleRecordPointerMove}
              onPointerUp={handleRecordPointerUp}
              onPointerCancel={handleCancelVoice}
              className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all hover:scale-105 active:scale-95 cursor-pointer touch-none ${
                recordMode === 'video_note'
                  ? 'bg-[#3390ec]/15 text-[#3390ec]'
                  : theme === 'light'
                  ? 'text-slate-600 hover:bg-slate-100 hover:text-[#3390ec]'
                  : 'text-[#8ea0b5] hover:bg-white/[0.06] hover:text-[#3390ec]'
              }`}
              title={
                recordMode === 'voice'
                  ? 'اضغط مطولاً للتسجيل الصوتي، أو انقر للتبديل للفيديو الدائري'
                  : 'اضغط مطولاً لتسجيل فيديو دائري، أو انقر للتبديل للصوت'
              }
            >
              {recordMode === 'voice' ? <Mic className="w-5 h-5" /> : <Disc2 className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Telegram Keyboard-Style Docked Emoji / Stickers / GIFs Panel */}
      {showEmojiPicker && (
        <div
          className={`border-t flex flex-col h-[285px] animate-in slide-in-from-bottom-4 duration-150 ${
            theme === 'light'
              ? 'bg-[#f4f5f7] border-slate-200'
              : 'bg-[#17212b] border-[#0e1621]'
          }`}
        >
          <div className="flex-1 overflow-y-auto p-3">
            {activePickerTab === 'emoji' ? (
              <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5 text-2xl text-center">
                {emojis.map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    onClick={() => setText((prev) => prev + emoji)}
                    className="p-2 rounded-xl hover:bg-white/10 active:scale-90 transition-transform cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : activePickerTab === 'sticker' ? (
              <StickerPicker onSelectSticker={handleSendSticker} />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {ANIMATED_GIFS.map((gif) => (
                  <button
                    key={gif.id}
                    type="button"
                    onClick={() =>
                      handleSendSticker({
                        id: gif.id,
                        emoji: gif.emoji,
                        name: gif.label,
                        label: gif.label,
                        url: gif.url,
                      })
                    }
                    className="rounded-xl overflow-hidden border border-white/10 hover:scale-[1.03] active:scale-95 transition-transform cursor-pointer bg-black/20"
                  >
                    <img src={gif.url} alt={gif.label} className="w-full h-24 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Docked Strip (Emoji | Stickers | GIFs) */}
          <div
            className={`h-11 px-3 border-t flex items-center justify-between shrink-0 ${
              theme === 'light'
                ? 'bg-white border-slate-200'
                : 'bg-[#0e1621] border-white/[0.06]'
            }`}
          >
            <div className="flex items-center gap-1 flex-1 justify-center">
              <button
                type="button"
                onClick={() => setActivePickerTab('emoji')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activePickerTab === 'emoji'
                    ? 'bg-[#3390ec]/15 text-[#3390ec]'
                    : 'text-[#7f91a4] hover:text-white'
                }`}
              >
                <Smile className="w-4 h-4" />
                <span>رموز</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePickerTab('sticker')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activePickerTab === 'sticker'
                    ? 'bg-[#3390ec]/15 text-[#3390ec]'
                    : 'text-[#7f91a4] hover:text-white'
                }`}
              >
                <Sticker className="w-4 h-4" />
                <span>ملصقات</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePickerTab('gif')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activePickerTab === 'gif'
                    ? 'bg-[#3390ec]/15 text-[#3390ec]'
                    : 'text-[#7f91a4] hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>GIF</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowEmojiPicker(false)}
              className="p-1.5 rounded-full text-[#7f91a4] hover:text-white cursor-pointer"
              aria-label="إغلاق اللوحة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Telegram Slide-Up Bottom Sheet Attach Drawer */}
      {showAttachMenu && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150"
          onClick={() => {
            setShowAttachMenu(false);
            setAttachSubView('grid');
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border text-right tg-sheet-up ${
              theme === 'light'
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-[#17212b] border-white/[0.08] text-white'
            }`}
          >
            <div className="sm:hidden flex justify-center -mt-2 mb-3">
              <div className="w-10 h-1 rounded-full bg-slate-400/40" />
            </div>

            {attachSubView === 'contacts' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Contact className="w-4 h-4 text-[#3390ec]" />
                    <span>مشاركة جهة اتصال</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setAttachSubView('grid')}
                    className="text-xs font-bold text-[#3390ec] cursor-pointer"
                  >
                    رجوع
                  </button>
                </div>

                <div
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${
                    theme === 'light'
                      ? 'bg-slate-100 border-slate-200 text-slate-900'
                      : 'bg-[#242f3d] border-white/[0.06] text-white'
                  }`}
                >
                  <Search className="w-4 h-4 text-[#7f91a4] shrink-0" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="ابحث عن مستخدم..."
                    className="flex-1 bg-transparent text-xs outline-none"
                  />
                </div>

                <div className="max-h-64 overflow-y-auto space-y-1">
                  {contactCandidates.map((u) => (
                    <button
                      key={u.uid}
                      type="button"
                      onClick={() => handleSendContact(u)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-right transition-colors cursor-pointer ${
                        theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.05]'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                          u.uid
                        )}`}
                      >
                        {u.photoURL ? (
                          <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>{getInitials(u.displayName)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{u.displayName}</div>
                        <div className="text-[11px] text-[#7f91a4] font-mono truncate" dir="ltr">
                          @{u.username} {u.phone ? `• ${u.phone}` : ''}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold">إرسال مرفق</h3>
                  <button
                    type="button"
                    onClick={() => setShowAttachMenu(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#7f91a4] hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-y-4 gap-x-2 text-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                  >
                    <div className="w-13 h-13 rounded-full bg-[#3390ec] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-semibold">صورة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                  >
                    <div className="w-13 h-13 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                      <Video className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-semibold">فيديو</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      startVideoNote();
                    }}
                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                  >
                    <div className="w-13 h-13 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                      <Disc2 className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-semibold">فيديو دائري</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => docInputRef.current?.click()}
                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                  >
                    <div className="w-13 h-13 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                      <FileText className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-semibold">ملف</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      onOpenPollModal();
                    }}
                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                  >
                    <div className="w-13 h-13 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                      <BarChart2 className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-semibold">استطلاع</span>
                  </button>

                  <button
                    type="button"
                    disabled={sendingLocation}
                    onClick={handleSendLocation}
                    className="flex flex-col items-center gap-1.5 cursor-pointer group disabled:opacity-60"
                  >
                    <div className="w-13 h-13 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-semibold">
                      {sendingLocation ? 'جاري...' : 'الموقع'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAttachSubView('contacts')}
                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                  >
                    <div className="w-13 h-13 rounded-full bg-cyan-500 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                      <Contact className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-semibold">جهة اتصال</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      sendDiceRoll('🎲');
                    }}
                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                  >
                    <div className="w-13 h-13 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                      <Dices className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-semibold">نرد</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
