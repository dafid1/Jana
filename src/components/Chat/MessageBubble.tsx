import React, { useState, useRef, useEffect } from 'react';
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
  Smile,
  BarChart2,
  Edit2,
  ExternalLink,
  X,
  ArrowDown,
  CheckCircle2,
  Forward,
  Bookmark,
  CheckSquare,
  Users,
  Megaphone,
  Link2,
  Trash2,
  Phone,
  Video,
  PhoneMissed,
  Film,
  Globe,
  Eye,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Chat, Message } from '../../types/telegram';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import {
  formatTelegramTime,
  formatDuration,
  QUICK_REACTIONS,
  getAvatarGradient,
  getInitials,
  getMessageReplyPreview,
  estimateMediaSizeLabel,
  isMediaLocallyDownloaded,
  markMediaLocallyDownloaded,
  splitTextWithLinks,
  extractFirstInviteUrl,
  sanitizeExternalUrl,
  parseInviteTarget,
} from '../../utils/telegramHelpers';
import { saveImageToGallery } from '../../utils/gallerySaver';
import { useBackHandler } from '../../utils/androidBackNavigation';

interface MessageBubbleProps {
  message: Message;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  isHighlighted?: boolean;
  searchQuery?: string;
  isActiveSearchMatch?: boolean;
  onJumpToMessage?: (messageId: string) => void;
}

const renderHighlightedText = (
  text: string,
  query: string | undefined,
  isActiveMatch: boolean
): React.ReactNode => {
  const trimmed = query?.trim();
  if (!trimmed || !text) return text;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  if (parts.length <= 1) return text;

  return parts.map((part, idx) =>
    idx % 2 === 1 ? (
      <mark
        key={idx}
        className={`rounded-[3px] px-0.5 transition-colors ${
          isActiveMatch
            ? 'bg-amber-400 text-slate-950 font-semibold shadow-xs'
            : 'bg-yellow-300/85 text-slate-950'
        }`}
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
};

const MENTION_REGEX = /(@[a-zA-Z0-9_.-]{3,30})/g;

const renderTextWithMentions = (
  text: string,
  query: string | undefined,
  isActiveMatch: boolean,
  isOutgoingDark: boolean
): React.ReactNode => {
  if (!text) return text;
  const parts = text.split(MENTION_REGEX);
  if (parts.length <= 1) {
    return renderHighlightedText(text, query, isActiveMatch);
  }
  return parts.map((part, idx) => {
    if (part.startsWith('@') && /^@[a-zA-Z0-9_.-]{3,30}$/.test(part)) {
      return (
        <span
          key={idx}
          dir="ltr"
          className={`inline-block font-bold ${
            isOutgoingDark ? 'text-sky-300' : 'text-[#2481cc]'
          }`}
        >
          {renderHighlightedText(part, query, isActiveMatch)}
        </span>
      );
    }
    return (
      <React.Fragment key={idx}>
        {renderHighlightedText(part, query, isActiveMatch)}
      </React.Fragment>
    );
  });
};

export const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({
  message,
  isFirstInGroup = true,
  isLastInGroup = true,
  isHighlighted = false,
  searchQuery,
  isActiveSearchMatch = false,
  onJumpToMessage,
}) => {
  const { theme, currentUser, usersMap } = useAuth();
  const {
    activeChat,
    toggleReaction,
    pinMessage,
    setReplyingTo,
    setEditingMessage,
    voteInPoll,
    setActiveMediaUrl,
    sendMessage,
    isSelectionMode,
    selectedMessageIds,
    toggleMessageSelection,
    enterSelectionMode,
    openForwardModal,
    forwardMessages,
    isActiveChatMember,
    isActiveChatModerator,
    openInviteLink,
    resolveInvitePreview,
    deleteMessages,
    startCall,
  } = useChat();

  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [voiceCurrentTime, setVoiceCurrentTime] = useState(0);
  const [voiceTotalDuration, setVoiceTotalDuration] = useState(message.voiceDuration || 5);
  const [voiceSpeed, setVoiceSpeed] = useState<'1x' | '1.5x' | '2x'>('1x');
  const [isPlayingVideoNote, setIsPlayingVideoNote] = useState(false);
  const [isVideoNoteMuted, setIsVideoNoteMuted] = useState(false);
  const [videoNoteProgress, setVideoNoteProgress] = useState(0);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSpoilerRevealed, setIsSpoilerRevealed] = useState(false);

  useBackHandler(
    showReactionPicker || showActionMenu || showDeleteConfirm,
    () => {
      setShowReactionPicker(false);
      setShowActionMenu(false);
      setShowDeleteConfirm(false);
    },
    48
  );

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const isMe = message.senderId === currentUser?.uid;
  const isDeleted = Boolean(message.isDeleted);
  const isChannel = activeChat?.type === 'channel';
  const isSticker = message.type === 'sticker' && !isDeleted;
  const isDice = message.type === 'dice' && !isDeleted;
  const isCallLog = message.type === 'call' && !isDeleted;
  const isVideoNote = message.type === 'video' && Boolean(message.isVideoNote) && !isDeleted;
  const isSelected = isSelectionMode && selectedMessageIds.includes(message.id);
  const canDeleteForEveryone = isMe || isActiveChatModerator || activeChat?.type === 'saved';

  const [isImageDownloaded, setIsImageDownloaded] = useState<boolean>(() => {
    if (message.type !== 'image' || message.isDeleted) return true;
    if (message.senderId === currentUser?.uid) return true;
    if (activeChat?.type === 'saved') return true;
    return isMediaLocallyDownloaded(currentUser?.uid, message.id);
  });
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [galleryToast, setGalleryToast] = useState<string | null>(null);
  const [stickerImgError, setStickerImgError] = useState(false);
  const [invitePreviewChat, setInvitePreviewChat] = useState<Chat | null>(null);
  const [openingInvite, setOpeningInvite] = useState(false);

  const detectedInviteUrl =
    message.text && !isDeleted && !isSticker && !isDice && !isCallLog && !message.isSpoiler
      ? extractFirstInviteUrl(message.text)
      : null;

  useEffect(() => {
    let cancelled = false;
    if (!detectedInviteUrl) {
      setInvitePreviewChat(null);
      return;
    }
    resolveInvitePreview(detectedInviteUrl).then((resolved) => {
      if (!cancelled) {
        setInvitePreviewChat(resolved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [detectedInviteUrl, resolveInvitePreview]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoNoteRef = useRef<HTMLVideoElement | null>(null);
  const downloadAbortRef = useRef<AbortController | null>(null);
  const downloadTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const gestureModeRef = useRef<'pending' | 'swipe' | 'scroll' | 'none'>('none');
  const swipeOffsetRef = useRef(0);
  const hapticTriggeredRef = useRef(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const suppressNextClickRef = useRef(false);

  const SWIPE_REPLY_THRESHOLD = -52;

  const liveSender = usersMap[message.senderId];
  const senderDisplayName = liveSender?.displayName || message.senderName;
  const senderPhoto = liveSender?.photoURL || message.senderPhoto;

  const otherReaders = (message.readBy || []).filter((uid) => uid !== currentUser?.uid);
  const isReadByOthers = activeChat?.type === 'saved' ? true : otherReaders.length > 0;
  const readerNamesTooltip =
    otherReaders.length > 0
      ? `قرأها: ${otherReaders
          .map((uid) => usersMap[uid]?.displayName || usersMap[uid]?.username || 'عضو')
          .join('، ')}`
      : 'تم الإرسال إلى السحابة (لم تُقرأ بعد)';

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate =
        voiceSpeed === '1.5x' ? 1.5 : voiceSpeed === '2x' ? 2 : 1;
    }
  }, [voiceSpeed]);

  useEffect(() => {
    if (message.type !== 'image' || message.isDeleted) return;
    if (isMe || activeChat?.type === 'saved') {
      setIsImageDownloaded(true);
    } else {
      setIsImageDownloaded(isMediaLocallyDownloaded(currentUser?.uid, message.id));
    }
  }, [message.id, message.type, message.isDeleted, isMe, activeChat?.type, currentUser?.uid]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      if (downloadTimerRef.current) {
        clearInterval(downloadTimerRef.current);
      }
      if (downloadAbortRef.current) {
        downloadAbortRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (!showActionMenu && !showDeleteConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowActionMenu(false);
        setShowDeleteConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showActionMenu, showDeleteConfirm]);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const triggerReplyToThisMessage = () => {
    if (isDeleted) return;
    setShowActionMenu(false);
    setShowReactionPicker(false);
    setReplyingTo(message);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isSelectionMode) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, video, [data-no-gesture="true"]')) {
      return;
    }

    clearLongPressTimer();
    pointerStartRef.current = { x: e.clientX, y: e.clientY, active: true };
    gestureModeRef.current = 'pending';
    hapticTriggeredRef.current = false;
    suppressNextClickRef.current = false;

    longPressTimerRef.current = setTimeout(() => {
      if (gestureModeRef.current === 'pending' && pointerStartRef.current.active) {
        gestureModeRef.current = 'none';
        pointerStartRef.current.active = false;
        suppressNextClickRef.current = true;
        try {
          window.getSelection()?.removeAllRanges();
        } catch {
          // Ignore
        }
        try {
          navigator.vibrate?.(20);
        } catch {
          // Ignore
        }
        setShowReactionPicker(false);
        setShowActionMenu(true);
      }
    }, 450);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current.active) return;

    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;

    if (gestureModeRef.current === 'pending') {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        clearLongPressTimer();
      }
      if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) {
        gestureModeRef.current = 'scroll';
        return;
      }
      if (!isDeleted && dx < -10 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        gestureModeRef.current = 'swipe';
        setIsSwiping(true);
        suppressNextClickRef.current = true;
        try {
          window.getSelection()?.removeAllRanges();
        } catch {
          // Ignore
        }
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
      } else {
        return;
      }
    }

    if (gestureModeRef.current === 'swipe') {
      const clamped =
        dx >= 0
          ? 0
          : dx >= SWIPE_REPLY_THRESHOLD
          ? dx
          : SWIPE_REPLY_THRESHOLD - Math.min(24, (-dx + SWIPE_REPLY_THRESHOLD) * 0.35);

      swipeOffsetRef.current = clamped;
      setSwipeOffset(clamped);

      if (clamped <= SWIPE_REPLY_THRESHOLD && !hapticTriggeredRef.current) {
        hapticTriggeredRef.current = true;
        try {
          navigator.vibrate?.(15);
        } catch {
          // Ignore
        }
      } else if (clamped > SWIPE_REPLY_THRESHOLD) {
        hapticTriggeredRef.current = false;
      }
    }
  };

  const finishPointerGesture = (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    clearLongPressTimer();
    if (!pointerStartRef.current.active) return;

    pointerStartRef.current.active = false;
    const wasSwiping = gestureModeRef.current === 'swipe';
    gestureModeRef.current = 'none';

    if (wasSwiping) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      const finalOffset = swipeOffsetRef.current;
      setIsSwiping(false);
      swipeOffsetRef.current = 0;
      setSwipeOffset(0);

      if (!cancelled && finalOffset <= SWIPE_REPLY_THRESHOLD) {
        triggerReplyToThisMessage();
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isSelectionMode) {
      e.preventDefault();
      return;
    }
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, video, [data-no-gesture="true"]')) {
      return;
    }
    e.preventDefault();
    clearLongPressTimer();
    setShowReactionPicker(false);
    setShowActionMenu(true);
  };

  const handleBubbleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isActiveChatMember || isSelectionMode || isDeleted) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, video, [data-no-gesture="true"]')) {
      return;
    }
    toggleReaction(message.id, '❤️').catch(() => {});
  };

  const handleToggleVoice = () => {
    if (message.mediaUrl && audioRef.current) {
      if (isPlayingVoice) {
        audioRef.current.pause();
        setIsPlayingVoice(false);
      } else {
        audioRef.current.play().catch(() => {});
        setIsPlayingVoice(true);
      }
    } else {
      setIsPlayingVoice((prev) => !prev);
    }
  };

  const handleCycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (voiceSpeed === '1x') setVoiceSpeed('1.5x');
    else if (voiceSpeed === '1.5x') setVoiceSpeed('2x');
    else setVoiceSpeed('1x');
  };

  const handleCopy = () => {
    if (message.text && !isDeleted) {
      navigator.clipboard.writeText(message.text);
    }
  };

  const handleDeleteChoice = async (mode: 'me' | 'everyone') => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteMessages([message.id], mode);
      setShowDeleteConfirm(false);
      setShowActionMenu(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelImageDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloadTimerRef.current) {
      clearInterval(downloadTimerRef.current);
      downloadTimerRef.current = null;
    }
    if (downloadAbortRef.current) {
      downloadAbortRef.current.abort();
      downloadAbortRef.current = null;
    }
    setIsDownloadingImage(false);
    setDownloadProgress(0);
  };

  const handleStartImageDownload = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!message.mediaUrl || isDownloadingImage || isImageDownloaded) return;

    const controller = new AbortController();
    downloadAbortRef.current = controller;
    setIsDownloadingImage(true);
    setDownloadProgress(8);

    let simulatedProgress = 8;
    if (downloadTimerRef.current) clearInterval(downloadTimerRef.current);
    downloadTimerRef.current = setInterval(() => {
      simulatedProgress = Math.min(90, simulatedProgress + 14);
      setDownloadProgress((prev) => Math.max(prev, simulatedProgress));
    }, 65);

    try {
      const response = await fetch(message.mediaUrl, { signal: controller.signal });
      const contentLength = Number(response.headers.get('content-length') || 0);

      if (response.body && contentLength > 0) {
        const reader = response.body.getReader();
        const chunks: BlobPart[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            const pct = Math.min(96, Math.max(12, Math.round((received / contentLength) * 96)));
            setDownloadProgress((prev) => Math.max(prev, pct));
          }
        }
        const blob = new Blob(chunks);
        const objUrl = URL.createObjectURL(blob);
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = objUrl;
        }).finally(() => URL.revokeObjectURL(objUrl));
      } else {
        const blob = await response.blob();
        const objUrl = URL.createObjectURL(blob);
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = objUrl;
        }).finally(() => URL.revokeObjectURL(objUrl));
      }

      if (controller.signal.aborted) return;

      if (downloadTimerRef.current) {
        clearInterval(downloadTimerRef.current);
        downloadTimerRef.current = null;
      }
      setDownloadProgress(100);
      await new Promise((r) => setTimeout(r, 160));
      if (controller.signal.aborted) return;

      markMediaLocallyDownloaded(currentUser?.uid, message.id);
      setIsImageDownloaded(true);
      setIsDownloadingImage(false);
    } catch (err) {
      if ((err as { name?: string })?.name !== 'AbortError') {
        markMediaLocallyDownloaded(currentUser?.uid, message.id);
        setIsImageDownloaded(true);
      }
      if (downloadTimerRef.current) {
        clearInterval(downloadTimerRef.current);
        downloadTimerRef.current = null;
      }
      setIsDownloadingImage(false);
      setDownloadProgress(0);
    } finally {
      if (downloadAbortRef.current === controller) {
        downloadAbortRef.current = null;
      }
    }
  };

  const handleSaveToGallery = async () => {
    if (!message.mediaUrl) return;
    setShowActionMenu(false);
    try {
      const target = await saveImageToGallery(
        message.mediaUrl,
        message.mediaName || `JanaX_${message.id}`
      );
      setGalleryToast(
        target === 'gallery' ? 'تم حفظ الصورة في المعرض' : 'تم تنزيل الصورة وحفظها'
      );
      setTimeout(() => setGalleryToast(null), 2400);
    } catch {
      setGalleryToast('تعذر حفظ الصورة');
      setTimeout(() => setGalleryToast(null), 2400);
    }
  };

  const diceFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const swipeProgress = Math.min(1, Math.abs(swipeOffset) / Math.abs(SWIPE_REPLY_THRESHOLD));
  const isSwipeReady = swipeOffset <= SWIPE_REPLY_THRESHOLD;
  const imageSizeLabel = estimateMediaSizeLabel(message.mediaUrl, message.mediaSize);
  const safePreviewUrl = message.linkPreview?.url
    ? sanitizeExternalUrl(message.linkPreview.url)
    : null;
  const isOutgoingDark = isMe && theme === 'dark';

  // Deterministic 26-bar voice waveform seeded from message.id
  const voiceWaveformBars = React.useMemo(() => {
    const seedStr = message.id || 'voice';
    const bars: number[] = [];
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
    }
    for (let i = 0; i < 26; i++) {
      hash = (hash * 1664525 + 1013904223) >>> 0;
      const pct = 22 + (hash % 78);
      bars.push(pct);
    }
    return bars;
  }, [message.id]);

  const voiceProgressRatio =
    voiceTotalDuration > 0 ? Math.min(1, Math.max(0, voiceCurrentTime / voiceTotalDuration)) : 0;

  const handleSeekVoice = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
    const ratio = rect.width > 0 ? relX / rect.width : 0;
    if (audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
      audioRef.current.currentTime = ratio * audioRef.current.duration;
      setVoiceCurrentTime(audioRef.current.currentTime);
    }
  };

  const bubbleBgHex = isMe
    ? theme === 'light'
      ? '#effdde'
      : '#2b5278'
    : theme === 'light'
    ? '#ffffff'
    : '#182533';

  const bubbleRadiusClasses = isSticker || isDice || isVideoNote
    ? ''
    : isMe
    ? `${isFirstInGroup ? 'rounded-t-2xl' : 'rounded-tr-2xl rounded-tl-md'} ${
        isLastInGroup ? 'rounded-br-2xl rounded-bl-none' : 'rounded-br-2xl rounded-bl-md'
      }`
    : `${isFirstInGroup ? 'rounded-t-2xl' : 'rounded-tl-2xl rounded-tr-md'} ${
        isLastInGroup ? 'rounded-bl-2xl rounded-br-none' : 'rounded-bl-2xl rounded-br-md'
      }`;

  return (
    <>
      <div
        id={`msg-${message.id}`}
        data-message-id={message.id}
        className={`group relative flex items-end gap-2 px-3 sm:px-4 touch-pan-y transition-colors duration-200 ${
          isFirstInGroup ? 'mt-2.5' : 'mt-[2px]'
        } ${isLastInGroup ? 'mb-0.5' : ''} ${
          isSelectionMode ? 'cursor-pointer select-none' : ''
        } ${isMe ? 'justify-end' : 'justify-start'} ${
          isSelected
            ? theme === 'light'
              ? 'bg-[#3390ec]/12 rounded-2xl py-1'
              : 'bg-[#3390ec]/18 rounded-2xl py-1'
            : isHighlighted || isActiveSearchMatch
            ? 'bg-[#3390ec]/20 rounded-2xl py-1'
            : ''
        }`}
        onMouseLeave={() => setShowReactionPicker(false)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => finishPointerGesture(e, false)}
        onPointerCancel={(e) => finishPointerGesture(e, true)}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleBubbleDoubleClick}
        onClickCapture={(e) => {
          if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false;
            e.stopPropagation();
            return;
          }
          if (isSelectionMode) {
            e.preventDefault();
            e.stopPropagation();
            toggleMessageSelection(message.id);
          }
        }}
        style={{ WebkitTouchCallout: 'none' }}
      >
        {/* Selection Mode Checkbox */}
        {isSelectionMode && (
          <div className="self-center shrink-0 flex items-center justify-center pl-1">
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                isSelected
                  ? 'bg-[#2481cc] border-[#2481cc] text-white scale-105 shadow-xs'
                  : theme === 'light'
                  ? 'border-slate-300 bg-white/80'
                  : 'border-white/30 bg-black/20'
              }`}
            >
              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
          </div>
        )}

        {/* Swipe Left Reply Visual Indicator */}
        {swipeOffset < -6 && !isSelectionMode && !isDeleted && (
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none z-10 flex items-center justify-center"
            style={{
              opacity: swipeProgress,
              transform: `scale(${0.6 + swipeProgress * 0.4})`,
            }}
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-colors duration-150 ${
                isSwipeReady
                  ? 'bg-[#2481cc] text-white scale-110'
                  : theme === 'light'
                  ? 'bg-white text-[#2481cc] border border-gray-200'
                  : 'bg-[#1e2a38] text-[#2481cc] border border-[#2b3a4a]'
              }`}
            >
              <Reply className="w-4 h-4" />
            </div>
          </div>
        )}

        {/* Sender Avatar in Group chat for others (aligned spacer when mid-group) */}
        {!isMe && !isChannel && activeChat?.type === 'group' && (
          isLastInGroup ? (
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                message.senderId
              )} mb-0.5`}
            >
              {senderPhoto ? (
                <img src={senderPhoto} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              ) : (
                <span>{getInitials(senderDisplayName)}</span>
              )}
            </div>
          ) : (
            <div className="w-8 shrink-0" aria-hidden="true" />
          )
        )}

        {/* Bubble Container */}
        <div
          style={{
            transform: swipeOffset !== 0 ? `translateX(${swipeOffset}px)` : undefined,
            transition: isSwiping ? 'none' : 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
          className={`relative max-w-[85%] sm:max-w-[70%] text-sm transition-shadow ${bubbleRadiusClasses} ${
            isSticker || isDice || isVideoNote
              ? 'bg-transparent shadow-none p-0'
              : isMe
              ? theme === 'light'
                ? 'bg-[#effdde] text-slate-900 shadow-xs'
                : 'bg-[#2b5278] text-white shadow-sm'
              : theme === 'light'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'bg-[#182533] text-white shadow-sm'
          } ${!isSticker && !isDice && !isVideoNote ? 'px-3.5 py-2' : ''} ${
            isActiveSearchMatch && !isSticker && !isDice && !isVideoNote ? 'ring-2 ring-amber-400/80' : ''
          } ${isSelected && !isSticker && !isDice && !isVideoNote ? 'ring-2 ring-[#3390ec]' : ''}`}
        >
          {/* Authentic SVG Telegram Bubble Tail on last bubble of group */}
          {isLastInGroup && !isSticker && !isDice && !isVideoNote && (
            <svg
              aria-hidden="true"
              viewBox="0 0 11 20"
              className={`absolute bottom-0 w-[9px] h-[16px] pointer-events-none ${
                isMe ? '-left-[7px]' : '-right-[7px] -scale-x-100'
              }`}
            >
              <path
                d="M11 0v20H0c5.5-2.5 8.5-7.5 11-20z"
                fill={bubbleBgHex}
              />
            </svg>
          )}

          {/* Sender Name for first message in group */}
          {!isMe && !isChannel && activeChat?.type === 'group' && isFirstInGroup && (
            <div className="text-xs font-bold text-[#3390ec] mb-1">
              {senderDisplayName}
            </div>
          )}

          {/* DELETED MESSAGE PLACEHOLDER */}
          {isDeleted ? (
            <div className="flex items-center gap-2 italic text-xs opacity-70 py-0.5">
              <span>🚫 تم حذف هذه الرسالة</span>
            </div>
          ) : (
            <>
              {/* Forwarded From Attribution */}
              {message.forwardedFrom && (
                <div
                  className={`flex items-center gap-1.5 text-[11px] font-semibold mb-1.5 ${
                    isSticker || isDice
                      ? 'px-2.5 py-1 rounded-full bg-black/45 text-sky-200 backdrop-blur-xs mb-1'
                      : isOutgoingDark
                      ? 'text-sky-300'
                      : 'text-[#2481cc]'
                  }`}
                >
                  <Forward className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    محوّلة من{' '}
                    {usersMap[message.forwardedFrom.senderId]?.displayName ||
                      message.forwardedFrom.senderName}
                    {message.forwardedFrom.chatTitle ? ` • ${message.forwardedFrom.chatTitle}` : ''}
                  </span>
                </div>
              )}

              {/* Quoted Reply Preview */}
              {(message.replyToId || message.replyToText) && (
                <div
                  data-no-gesture="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (message.replyToId && onJumpToMessage) {
                      onJumpToMessage(message.replyToId);
                    }
                  }}
                  className={`border-r-2 border-[#2481cc] pr-2.5 pl-3 py-1.5 mb-1.5 rounded-lg text-xs opacity-95 transition-colors ${
                    message.replyToId && onJumpToMessage ? 'cursor-pointer hover:opacity-100' : ''
                  } ${theme === 'light' ? 'bg-black/[0.04] hover:bg-black/[0.07]' : 'bg-black/25 hover:bg-black/35'}`}
                >
                  <div className="font-bold text-[#2481cc] text-[11px]">
                    {message.replyToSender || 'رد على رسالة'}
                  </div>
                  <div className="truncate opacity-80 mt-0.5">{message.replyToText || 'رسالة'}</div>
                </div>
              )}

              {/* 1. STICKER MESSAGE */}
              {isSticker && (
                <div
                  title={message.mediaName || 'ملصق'}
                  className={`relative group/sticker select-none rounded-2xl p-1 transition-all ${
                    isActiveSearchMatch ? 'ring-2 ring-amber-400/80 bg-amber-400/10' : ''
                  }`}
                >
                  {stickerImgError || !message.mediaUrl ? (
                    <div className="w-36 h-36 rounded-2xl bg-black/20 backdrop-blur-xs flex flex-col items-center justify-center gap-1 shadow-md">
                      <span className="text-6xl leading-none">{message.text || '🎨'}</span>
                      {message.mediaName && (
                        <span className="text-[11px] font-medium text-white/90 px-2 truncate max-w-full">
                          {message.mediaName}
                        </span>
                      )}
                    </div>
                  ) : (
                    <img
                      src={message.mediaUrl}
                      alt={message.mediaName || 'Sticker'}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={() => setStickerImgError(true)}
                      className="w-40 h-40 sm:w-44 sm:h-44 object-contain rounded-2xl drop-shadow-md hover:scale-105 transition-transform duration-200 cursor-pointer"
                    />
                  )}
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

              {/* 3. CALL LOG MESSAGE */}
              {isCallLog && (
                <div
                  className={`flex items-center gap-3 p-2.5 rounded-xl min-w-[215px] border ${
                    theme === 'light'
                      ? 'bg-black/[0.03] border-black/[0.06]'
                      : 'bg-black/20 border-white/[0.08]'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      message.callInfo?.status === 'ended' && (message.callInfo?.duration || 0) > 0
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-rose-500/15 text-rose-400'
                    }`}
                  >
                    {message.callInfo?.status === 'missed' || message.callInfo?.status === 'declined' ? (
                      <PhoneMissed className="w-5 h-5" />
                    ) : message.callInfo?.isVideo ? (
                      <Video className="w-5 h-5" />
                    ) : (
                      <Phone className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate">
                      {message.callInfo?.isVideo ? 'مكالمة فيديو' : 'مكالمة صوتية'}
                    </div>
                    <div className="text-[11px] opacity-75 truncate mt-0.5">
                      {message.callInfo?.status === 'ended' && (message.callInfo?.duration || 0) > 0
                        ? `المدة: ${formatDuration(message.callInfo?.duration || 0)}`
                        : message.callInfo?.status === 'declined'
                        ? 'تم رفض المكالمة'
                        : 'مكالمة فائتة'}
                    </div>
                  </div>
                  {activeChat && (
                    <button
                      type="button"
                      data-no-gesture="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        startCall(activeChat, Boolean(message.callInfo?.isVideo)).catch(() => {});
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-[#2481cc]/15 hover:bg-[#2481cc] text-[#2481cc] hover:text-white text-[11px] font-bold transition-colors cursor-pointer shrink-0"
                    >
                      معاودة الاتصال
                    </button>
                  )}
                </div>
              )}

              {/* 4. IMAGE MESSAGE */}
              {message.type === 'image' && message.mediaUrl && (
                <div
                  className="relative mb-1.5 overflow-hidden rounded-xl cursor-pointer group/img select-none min-w-[200px] min-h-[160px] bg-black/25 flex items-center justify-center"
                  onClick={(e) => {
                    if (!isImageDownloaded) {
                      if (isDownloadingImage) {
                        handleCancelImageDownload(e);
                      } else {
                        handleStartImageDownload(e);
                      }
                      return;
                    }
                    setActiveMediaUrl(message.mediaUrl || null);
                  }}
                >
                  <img
                    src={message.mediaUrl}
                    alt="Attachment"
                    loading="lazy"
                    decoding="async"
                    className={`max-h-72 w-full object-cover rounded-xl transition-all duration-300 ${
                      !isImageDownloaded
                        ? 'blur-xl scale-110 brightness-75'
                        : 'group-hover/img:scale-[1.02]'
                    }`}
                  />

                  {!isImageDownloaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/20">
                      <div className="relative w-14 h-14 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center shadow-xl border border-white/15 transition-transform active:scale-95">
                        {isDownloadingImage ? (
                          <>
                            <svg
                              className="absolute inset-0 w-full h-full -rotate-90"
                              viewBox="0 0 56 56"
                            >
                              <circle
                                cx="28"
                                cy="28"
                                r="24"
                                fill="none"
                                stroke="rgba(255,255,255,0.22)"
                                strokeWidth="3"
                              />
                              <circle
                                cx="28"
                                cy="28"
                                r="24"
                                fill="none"
                                stroke="#ffffff"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray={150.8}
                                strokeDashoffset={150.8 - (150.8 * downloadProgress) / 100}
                                className="transition-[stroke-dashoffset] duration-100 ease-linear"
                              />
                            </svg>
                            <X className="w-5 h-5 text-white relative z-10" />
                          </>
                        ) : (
                          <ArrowDown className="w-6 h-6 text-white stroke-[2.4]" />
                        )}
                      </div>

                      <span className="px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-semibold text-white/95 shadow-xs">
                        {isDownloadingImage ? `${downloadProgress}%` : imageSizeLabel}
                      </span>
                    </div>
                  )}

                  {isImageDownloaded && galleryToast && (
                    <div className="absolute bottom-2 inset-x-2 flex justify-center pointer-events-none">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/75 text-white text-[11px] font-semibold shadow-md">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        {galleryToast}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 5. VIDEO MESSAGE OR CIRCULAR TELEGRAM VIDEO NOTE */}
              {message.type === 'video' && message.mediaUrl && isVideoNote && (
                <div className="relative w-52 h-52 sm:w-56 sm:h-56 my-1 select-none" data-no-gesture="true">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      const vid = videoNoteRef.current;
                      if (!vid) return;
                      if (vid.paused) {
                        vid.play().catch(() => {});
                        setIsPlayingVideoNote(true);
                      } else {
                        vid.pause();
                        setIsPlayingVideoNote(false);
                      }
                    }}
                    className="relative w-full h-full rounded-full overflow-hidden shadow-xl bg-black cursor-pointer border-2 border-[#3390ec]/50"
                  >
                    <video
                      ref={videoNoteRef}
                      src={message.mediaUrl}
                      playsInline
                      loop
                      muted={isVideoNoteMuted}
                      onTimeUpdate={(e) => {
                        const vid = e.currentTarget;
                        if (vid.duration > 0) {
                          setVideoNoteProgress((vid.currentTime / vid.duration) * 100);
                        }
                      }}
                      onEnded={() => setIsPlayingVideoNote(false)}
                      className="w-full h-full object-cover"
                    />
                    {!isPlayingVideoNote && (
                      <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-black/55 backdrop-blur-sm text-white flex items-center justify-center">
                          <Play className="w-6 h-6 ml-0.5" />
                        </div>
                      </div>
                    )}
                    {/* Circular Progress Ring */}
                    <svg
                      viewBox="0 0 100 100"
                      className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
                    >
                      <circle
                        cx="50"
                        cy="50"
                        r="48.5"
                        fill="none"
                        stroke="#3390ec"
                        strokeWidth="2.5"
                        strokeDasharray={304.7}
                        strokeDashoffset={304.7 - (304.7 * videoNoteProgress) / 100}
                        className="transition-[stroke-dashoffset] duration-100 ease-linear"
                      />
                    </svg>
                  </div>

                  {/* Video Note Duration & Sound Pill */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsVideoNoteMuted((prev) => !prev);
                    }}
                    className="absolute bottom-2 right-2 px-2 py-1 rounded-full bg-black/65 backdrop-blur-md text-white text-[10px] font-mono font-semibold flex items-center gap-1 cursor-pointer"
                    title={isVideoNoteMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
                  >
                    {isVideoNoteMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    <span>{formatDuration(message.voiceDuration || 5)}</span>
                  </button>
                </div>
              )}

              {message.type === 'video' && message.mediaUrl && !isVideoNote && (
                <div className="mb-1.5 overflow-hidden rounded-xl bg-black/80 border border-white/10">
                  <video
                    src={message.mediaUrl}
                    controls
                    playsInline
                    preload="metadata"
                    data-no-gesture="true"
                    className="max-h-72 w-full rounded-xl bg-black"
                  />
                  {(message.mediaName || message.mediaSize) && (
                    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] text-slate-300 bg-black/60">
                      <span className="flex items-center gap-1.5 truncate">
                        <Film className="w-3.5 h-3.5 text-[#3390ec] shrink-0" />
                        <span className="truncate">{message.mediaName || 'فيديو'}</span>
                      </span>
                      {message.mediaSize && (
                        <span className="tabular-nums opacity-75 shrink-0">{message.mediaSize}</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 6. VOICE MESSAGE WITH INTERACTIVE SCRUBBABLE WAVEFORM */}
              {message.type === 'voice' && (
                <div className="flex items-center gap-3 py-1 min-w-[235px]" data-no-gesture="true">
                  {message.mediaUrl && (
                    <audio
                      ref={audioRef}
                      src={message.mediaUrl}
                      onLoadedMetadata={(e) => {
                        const dur = e.currentTarget.duration;
                        if (Number.isFinite(dur) && dur > 0) {
                          setVoiceTotalDuration(Math.round(dur));
                        }
                      }}
                      onTimeUpdate={(e) => {
                        setVoiceCurrentTime(e.currentTarget.currentTime);
                      }}
                      onEnded={() => {
                        setIsPlayingVoice(false);
                        setVoiceCurrentTime(0);
                      }}
                      className="hidden"
                    />
                  )}
                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 hover:scale-105 transition-transform cursor-pointer ${
                      isMe && theme === 'light'
                        ? 'bg-[#4fae4e] text-white'
                        : 'bg-[#3390ec] text-white'
                    }`}
                  >
                    {isPlayingVoice ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div
                      dir="ltr"
                      onClick={handleSeekVoice}
                      className="flex items-center gap-[2px] h-7 cursor-pointer select-none"
                      title="اسحب أو اضغط للتقديم والترجيع"
                    >
                      {voiceWaveformBars.map((h, i) => {
                        const barRatio = (i + 1) / voiceWaveformBars.length;
                        const isFilled = barRatio <= voiceProgressRatio;
                        return (
                          <div
                            key={i}
                            className={`flex-1 min-w-[2.5px] rounded-full transition-colors duration-100 ${
                              isFilled
                                ? isMe && theme === 'light'
                                  ? 'bg-[#4fae4e]'
                                  : 'bg-[#5cb0ff]'
                                : isMe && theme === 'light'
                                ? 'bg-[#4fae4e]/35'
                                : isMe
                                ? 'bg-sky-200/35'
                                : 'bg-[#7f91a4]/45'
                            } ${isPlayingVoice && !isFilled ? 'animate-tg-wave' : ''}`}
                            style={{
                              height: `${h}%`,
                              animationDelay: `${i * 0.04}s`,
                            }}
                          />
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10.5px] font-mono tabular-nums opacity-80">
                        {isPlayingVoice || voiceCurrentTime > 0
                          ? `${formatDuration(Math.floor(voiceCurrentTime))} / ${formatDuration(
                              voiceTotalDuration
                            )}`
                          : formatDuration(voiceTotalDuration)}
                      </span>
                      <button
                        type="button"
                        onClick={handleCycleSpeed}
                        className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-bold transition-colors cursor-pointer ${
                          isMe && theme === 'light'
                            ? 'bg-[#4fae4e]/20 text-[#2e7d32] hover:bg-[#4fae4e] hover:text-white'
                            : 'bg-[#3390ec]/25 text-sky-300 hover:bg-[#3390ec] hover:text-white'
                        }`}
                        title="تغيير سرعة الصوت"
                      >
                        {voiceSpeed}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 7. FILE / DOCUMENT MESSAGE */}
              {message.type === 'file' && (
                <div
                  className={`flex items-center gap-3 p-2.5 rounded-xl mb-1 border ${
                    theme === 'light'
                      ? 'bg-black/[0.03] border-black/[0.05]'
                      : 'bg-black/20 border-white/[0.06]'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#2481cc] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">
                      {renderHighlightedText(message.mediaName || 'مستند', searchQuery, isActiveSearchMatch)}
                    </div>
                    <div className="text-[11px] tabular-nums opacity-75">{message.mediaSize || '1.4 MB'}</div>
                  </div>
                  <a
                    href={message.mediaUrl || '#'}
                    download={message.mediaName || 'file'}
                    target="_blank"
                    rel="noreferrer"
                    className={`p-2 rounded-xl text-[#2481cc] transition-colors ${
                      theme === 'light' ? 'hover:bg-slate-200/70' : 'hover:bg-white/10'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              )}

              {/* 8. INTERACTIVE POLL MESSAGE */}
              {message.type === 'poll' && message.pollData && (
                <div className="min-w-[240px] sm:min-w-[280px] py-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#2481cc] mb-1">
                    <BarChart2 className="w-4 h-4" />
                    <span>استطلاع رأي</span>
                  </div>
                  <h4 className="font-semibold text-sm mb-3">
                    {renderHighlightedText(message.pollData.question, searchQuery, isActiveSearchMatch)}
                  </h4>

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
                              ? 'border-slate-200/80 hover:bg-slate-50'
                              : 'border-white/[0.08] hover:bg-white/[0.04]'
                          }`}
                        >
                          <div
                            className="absolute inset-y-0 right-0 bg-[#2481cc]/20 transition-all duration-300 rounded-xl"
                            style={{ width: `${percentage}%` }}
                          />
                          <div className="relative flex items-center justify-between text-xs z-10">
                            <span className={`font-medium ${hasVoted ? 'text-[#2481cc] font-bold' : ''}`}>
                              {renderHighlightedText(option.text, searchQuery, isActiveSearchMatch)}
                            </span>
                            <span className="font-mono tabular-nums text-[11px] font-semibold opacity-80">
                              {percentage}%
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="text-[11px] tabular-nums opacity-75 mt-2 text-right">
                    {message.pollData.totalVotes} أصوات • تصويت متاح للجميع
                  </div>
                </div>
              )}

              {/* 9. TEXT MESSAGE (with links, invite detection & @mentions) */}
              {message.text && !isDice && !isSticker && !isCallLog && (
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
                    <span className="whitespace-pre-wrap break-words">
                      {splitTextWithLinks(message.text).map((seg, idx) => {
                        if (!seg.url) {
                          return (
                            <React.Fragment key={idx}>
                              {renderTextWithMentions(
                                seg.text,
                                searchQuery,
                                isActiveSearchMatch,
                                isOutgoingDark
                              )}
                            </React.Fragment>
                          );
                        }

                        const isInvite = Boolean(seg.inviteTarget);
                        return (
                          <a
                            key={idx}
                            href={seg.url}
                            target={isInvite ? undefined : '_blank'}
                            rel={isInvite ? undefined : 'noopener noreferrer'}
                            data-no-gesture="true"
                            onClick={(e) => {
                              if (isSelectionMode) {
                                e.preventDefault();
                                return;
                              }
                              if (isInvite) {
                                e.preventDefault();
                                e.stopPropagation();
                                openInviteLink(seg.url!).catch(() => {});
                              } else {
                                e.stopPropagation();
                              }
                            }}
                            className={`underline decoration-current/50 hover:decoration-current font-medium break-all cursor-pointer transition-colors ${
                              isOutgoingDark
                                ? 'text-sky-300 hover:text-sky-200'
                                : 'text-[#2481cc] hover:text-[#1c6fb5]'
                            }`}
                          >
                            {renderHighlightedText(seg.text, searchQuery, isActiveSearchMatch)}
                          </a>
                        );
                      })}
                    </span>
                  )}
                </div>
              )}

              {/* 9b. TELEGRAM-STYLE INVITE PREVIEW CARD */}
              {detectedInviteUrl && !message.isSpoiler && !isSticker && !isDice && !isCallLog && (
                <div
                  data-no-gesture="true"
                  onClick={(e) => {
                    if (isSelectionMode || openingInvite) return;
                    e.stopPropagation();
                    setOpeningInvite(true);
                    openInviteLink(detectedInviteUrl)
                      .catch(() => {})
                      .finally(() => setOpeningInvite(false));
                  }}
                  className={`mt-2 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    theme === 'light'
                      ? 'bg-slate-50/90 border-slate-200/90 hover:bg-slate-100'
                      : 'bg-black/25 border-white/[0.08] hover:bg-black/35'
                  }`}
                >
                  {invitePreviewChat ? (
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                          invitePreviewChat.id
                        )}`}
                      >
                        {invitePreviewChat.photoURL ? (
                          <img
                            src={invitePreviewChat.photoURL}
                            alt={invitePreviewChat.title}
                            className="w-full h-full object-cover"
                          />
                        ) : invitePreviewChat.type === 'channel' ? (
                          <Megaphone className="w-4 h-4" />
                        ) : (
                          <Users className="w-4 h-4" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate flex items-center gap-1">
                          <span className="truncate">{invitePreviewChat.title}</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[#2481cc]/15 text-[#2481cc] shrink-0">
                            {invitePreviewChat.type === 'channel' ? 'قناة' : 'مجموعة'}
                          </span>
                        </div>
                        <div
                          className={`text-[11px] truncate mt-0.5 ${
                            theme === 'light' ? 'text-slate-500' : 'text-[#8ea0b5]'
                          }`}
                        >
                          {invitePreviewChat.type === 'channel'
                            ? `${invitePreviewChat.membersCount || invitePreviewChat.memberIds?.length || 1} مشترك`
                            : `${invitePreviewChat.membersCount || invitePreviewChat.memberIds?.length || 1} أعضاء`}
                          {invitePreviewChat.description ? ` • ${invitePreviewChat.description}` : ''}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={openingInvite}
                        className="px-3 py-1.5 rounded-xl bg-[#2481cc] hover:bg-[#1e6fb1] text-white text-[11px] font-bold shrink-0 shadow-xs transition-colors cursor-pointer"
                      >
                        {openingInvite
                          ? '...'
                          : invitePreviewChat.memberIds?.includes(currentUser?.uid || '')
                          ? 'فتح'
                          : 'عرض وانضمام'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#2481cc]/15 text-[#2481cc] flex items-center justify-center shrink-0">
                          <Link2 className="w-4 h-4" />
                        </div>
                        <span className="font-semibold truncate">رابط دعوة مجموعة / قناة JanaX</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-[#2481cc] text-white text-[11px] font-bold shrink-0">
                        فتح الرابط
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 9c. RICH EXTERNAL LINK PREVIEW CARD */}
              {!detectedInviteUrl && !message.isSpoiler && message.linkPreview && safePreviewUrl && (
                <a
                  href={safePreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-no-gesture="true"
                  onClick={(e) => {
                    if (isSelectionMode) {
                      e.preventDefault();
                      return;
                    }
                    e.stopPropagation();
                  }}
                  className={`mt-2 block p-2.5 rounded-xl border-r-2 border-r-[#2481cc] border transition-colors ${
                    theme === 'light'
                      ? 'bg-black/[0.03] border-slate-200/80 hover:bg-black/[0.06]'
                      : 'bg-black/25 border-white/[0.08] hover:bg-black/35'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-[#2481cc] mb-0.5">
                        <Globe className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {message.linkPreview.siteName || message.linkPreview.domain}
                        </span>
                      </div>
                      <div className="text-xs font-bold leading-snug line-clamp-2">
                        {message.linkPreview.title}
                      </div>
                      {message.linkPreview.description && (
                        <div className="text-[11px] opacity-75 line-clamp-2 mt-0.5 leading-relaxed">
                          {message.linkPreview.description}
                        </div>
                      )}
                    </div>
                    {message.linkPreview.imageUrl && (
                      <img
                        src={message.linkPreview.imageUrl}
                        alt={message.linkPreview.title}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 rounded-lg object-cover shrink-0 bg-black/20"
                      />
                    )}
                  </div>
                </a>
              )}

              {/* 10. INLINE BUTTONS */}
              {message.inlineButtons && message.inlineButtons.length > 0 && (
                <div className="mt-2 space-y-1.5 pt-1.5 border-t border-white/10">
                  {message.inlineButtons.map((row, rowIdx) => (
                    <div key={rowIdx} className="flex items-center gap-1.5">
                      {row.map((btn, btnIdx) => {
                        const safeBtnUrl = btn.url ? sanitizeExternalUrl(btn.url) : null;
                        const inviteBtnTarget = btn.url ? parseInviteTarget(btn.url) : null;

                        if (safeBtnUrl) {
                          return (
                            <a
                              key={btnIdx}
                              href={safeBtnUrl}
                              target={inviteBtnTarget ? undefined : '_blank'}
                              rel={inviteBtnTarget ? undefined : 'noopener noreferrer'}
                              data-no-gesture="true"
                              onClick={(e) => {
                                if (inviteBtnTarget) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openInviteLink(safeBtnUrl).catch(() => {});
                                } else {
                                  e.stopPropagation();
                                }
                              }}
                              className="flex-1 py-1.5 px-3 rounded-xl bg-[#2481cc]/20 hover:bg-[#2481cc] hover:text-white text-[#2481cc] text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span>{btn.text}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          );
                        }

                        return (
                          <button
                            key={btnIdx}
                            onClick={() => sendMessage(btn.data, 'text')}
                            className="flex-1 py-1.5 px-3 rounded-xl bg-[#2481cc]/20 hover:bg-[#2481cc] hover:text-white text-[#2481cc] text-xs font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>{btn.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Timestamp, Channel Views, Edited Badge and Read Receipts */}
          <div
            className={`flex items-center justify-end gap-1.5 mt-1 text-[10.5px] tabular-nums select-none ${
              isSticker || isDice || isVideoNote
                ? 'px-2 py-0.5 rounded-full bg-black/45 text-white backdrop-blur-xs w-fit mr-auto'
                : isMe
                ? theme === 'light'
                  ? 'text-emerald-800/75'
                  : 'text-sky-200/80'
                : theme === 'light'
                ? 'text-slate-400'
                : 'text-[#8ea0b5]'
            }`}
          >
            {isChannel && !isDeleted && (
              <span className="inline-flex items-center gap-0.5 opacity-80 ml-1" title="المشاهدات">
                <Eye className="w-3 h-3" />
                <span>{message.viewsCount || Math.max(1, message.readBy?.length || 1)}</span>
              </span>
            )}
            {!isDeleted && message.editedAt && <span className="opacity-75">معدلة</span>}
            <span>{formatTelegramTime(message.createdAt)}</span>
            {isMe && !isDeleted && (
              <span
                className={`inline-flex items-center gap-0.5 ${
                  isReadByOthers
                    ? theme === 'light'
                      ? 'text-[#4fae4e]'
                      : 'text-[#5cb0ff]'
                    : 'opacity-65'
                }`}
                title={readerNamesTooltip}
              >
                {isReadByOthers ? (
                  <>
                    <CheckCheck className="w-3.5 h-3.5 inline" />
                    {activeChat?.type === 'group' && otherReaders.length > 0 && (
                      <span className="text-[9px] font-bold tabular-nums">{otherReaders.length}</span>
                    )}
                  </>
                ) : (
                  <Check className="w-3.5 h-3.5 inline" />
                )}
              </span>
            )}
          </div>

          {/* Reactions List */}
          {!isDeleted && message.reactions && Object.keys(message.reactions).length > 0 && (
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

          {/* Floating Quick Action Trigger */}
          {!isSelectionMode && isActiveChatMember && (
            <div
              className={`absolute top-0 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-20 ${
                isMe ? 'left-2' : 'right-2'
              }`}
            >
              <div
                className={`flex items-center gap-0.5 p-1 rounded-full shadow-xl border backdrop-blur-md ${
                  theme === 'light'
                    ? 'bg-white/95 border-slate-200/80 text-slate-700'
                    : 'bg-[#162230]/95 border-white/[0.08] text-white'
                }`}
              >
                {!isDeleted && (
                  <>
                    <button
                      onClick={() => setShowReactionPicker(!showReactionPicker)}
                      className="p-1.5 rounded-full hover:bg-[#2481cc]/20 hover:text-[#2481cc] transition-colors cursor-pointer"
                      title="تفاعل"
                    >
                      <Smile className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setReplyingTo(message)}
                      className="p-1.5 rounded-full hover:bg-[#2481cc]/20 hover:text-[#2481cc] transition-colors cursor-pointer"
                      title="رد"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => openForwardModal([message])}
                      className="p-1.5 rounded-full hover:bg-[#2481cc]/20 hover:text-[#2481cc] transition-colors cursor-pointer"
                      title="تحويل"
                    >
                      <Forward className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => enterSelectionMode(message.id)}
                      className="p-1.5 rounded-full hover:bg-[#2481cc]/20 hover:text-[#2481cc] transition-colors cursor-pointer"
                      title="تحديد"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                    </button>

                    {isMe && message.type === 'text' && (
                      <button
                        onClick={() => setEditingMessage(message)}
                        className="p-1.5 rounded-full hover:bg-[#2481cc]/20 hover:text-[#2481cc] transition-colors cursor-pointer"
                        title="تعديل الرسالة"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => pinMessage(message.id, !message.isPinned)}
                      className={`p-1.5 rounded-full hover:bg-[#2481cc]/20 transition-colors cursor-pointer ${
                        message.isPinned ? 'text-[#2481cc]' : 'hover:text-[#2481cc]'
                      }`}
                      title={message.isPinned ? 'إلغاء التثبيت' : 'تثبيت'}
                    >
                      <Pin className="w-3.5 h-3.5 rotate-45" />
                    </button>

                    {message.text && (
                      <button
                        onClick={handleCopy}
                        className="p-1.5 rounded-full hover:bg-[#2481cc]/20 hover:text-[#2481cc] transition-colors cursor-pointer"
                        title="نسخ"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}

                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1.5 rounded-full hover:bg-rose-500/20 hover:text-rose-400 transition-colors cursor-pointer"
                  title="حذف الرسالة"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Quick Emoji Reaction Palette Bar */}
          {!isSelectionMode && !isDeleted && showReactionPicker && (
            <div
              className={`absolute -top-12 z-30 flex items-center gap-1.5 p-1.5 rounded-full shadow-2xl border backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 ${
                isMe ? 'left-0' : 'right-0'
              } ${
                theme === 'light'
                  ? 'bg-white/95 border-slate-200/80'
                  : 'bg-[#162230]/95 border-white/[0.08]'
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

      {/* Telegram Blur Spotlight Long-Press / Right-Click Action Overlay */}
      {showActionMenu && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/55 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setShowActionMenu(false)}
          data-no-gesture="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs flex flex-col gap-2.5 animate-in zoom-in-95 duration-150"
          >
            {/* Floating Reaction Pill Bar Above Spotlighted Message */}
            {isActiveChatMember && !isDeleted && (
              <div
                className={`flex items-center justify-between px-3 py-2 rounded-full shadow-2xl border overflow-x-auto gap-1 ${
                  theme === 'light'
                    ? 'bg-white border-slate-200/90'
                    : 'bg-[#17212b] border-white/10'
                }`}
              >
                {QUICK_REACTIONS.slice(0, 7).map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      toggleReaction(message.id, emoji);
                      setShowActionMenu(false);
                    }}
                    className="text-xl hover:scale-125 active:scale-95 transition-transform p-1 cursor-pointer shrink-0"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Spotlighted Message Preview Card */}
            <div
              className={`px-3.5 py-2.5 rounded-2xl shadow-2xl border text-xs ${
                isMe
                  ? theme === 'light'
                    ? 'bg-[#effdde] border-emerald-900/10 text-slate-900'
                    : 'bg-[#2b5278] border-white/10 text-white'
                  : theme === 'light'
                  ? 'bg-white border-slate-200 text-slate-900'
                  : 'bg-[#182533] border-white/10 text-white'
              }`}
            >
              <div className="font-bold text-[#3390ec] truncate">{senderDisplayName}</div>
              <div className="line-clamp-3 opacity-90 mt-0.5 leading-relaxed">
                {getMessageReplyPreview(message)}
              </div>
            </div>

            {/* Action Menu Sheet */}
            <div
              className={`rounded-2xl shadow-2xl border overflow-hidden ${
                theme === 'light'
                  ? 'bg-white border-slate-200/80 text-slate-900'
                  : 'bg-[#17212b] border-white/[0.08] text-white'
              }`}
            >

            <div className="p-1.5 space-y-1">
              {!isDeleted && isActiveChatMember && (
                <button
                  onClick={triggerReplyToThisMessage}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold bg-[#2481cc]/12 text-[#2481cc] hover:bg-[#2481cc] hover:text-white transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Reply className="w-4 h-4" />
                    <span>رد على هذه الرسالة</span>
                  </span>
                </button>
              )}

              {!isDeleted && (
                <button
                  onClick={() => {
                    setShowActionMenu(false);
                    openForwardModal([message]);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <Forward className="w-4 h-4 text-[#2481cc]" />
                  <span>تحويل إلى مستخدم أو محادثة</span>
                </button>
              )}

              {!isDeleted && activeChat?.type !== 'saved' && (
                <button
                  onClick={() => {
                    setShowActionMenu(false);
                    forwardMessages([message], [{ isSaved: true }]);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <Bookmark className="w-4 h-4 text-amber-500" />
                  <span>حفظ في الرسائل المحفوظة</span>
                </button>
              )}

              {!isDeleted && (
                <button
                  onClick={() => {
                    setShowActionMenu(false);
                    enterSelectionMode(message.id);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <CheckSquare className="w-4 h-4 text-[#8ea0b5]" />
                  <span>تحديد عدة رسائل</span>
                </button>
              )}

              {!isDeleted && isActiveChatMember && isMe && message.type === 'text' && (
                <button
                  onClick={() => {
                    setEditingMessage(message);
                    setShowActionMenu(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <Edit2 className="w-4 h-4 text-[#8ea0b5]" />
                  <span>تعديل الرسالة</span>
                </button>
              )}

              {!isDeleted && isActiveChatMember && (
                <button
                  onClick={() => {
                    pinMessage(message.id, !message.isPinned);
                    setShowActionMenu(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <Pin className={`w-4 h-4 rotate-45 ${message.isPinned ? 'text-[#2481cc]' : 'text-[#8ea0b5]'}`} />
                  <span>{message.isPinned ? 'إلغاء تثبيت الرسالة' : 'تثبيت الرسالة'}</span>
                </button>
              )}

              {!isDeleted && message.type === 'image' && message.mediaUrl && isImageDownloaded && (
                <button
                  onClick={handleSaveToGallery}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <Download className="w-4 h-4 text-[#2481cc]" />
                  <span>حفظ في المعرض</span>
                </button>
              )}

              {!isDeleted && message.text && (
                <button
                  onClick={() => {
                    handleCopy();
                    setShowActionMenu(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <Copy className="w-4 h-4 text-[#8ea0b5]" />
                  <span>نسخ النص</span>
                </button>
              )}

              {isActiveChatMember && (
                <button
                  onClick={() => {
                    setShowActionMenu(false);
                    setShowDeleteConfirm(true);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-rose-500 transition-colors cursor-pointer ${
                    theme === 'light' ? 'hover:bg-rose-50' : 'hover:bg-rose-500/10'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>حذف الرسالة</span>
                </button>
              )}

              <button
                onClick={() => setShowActionMenu(false)}
                className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium opacity-75 transition-colors cursor-pointer ${
                  theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/[0.06]'
                }`}
              >
                <X className="w-3.5 h-3.5" />
                <span>إلغاء</span>
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => !isDeleting && setShowDeleteConfirm(false)}
          data-no-gesture="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-xs rounded-2xl p-5 shadow-2xl border text-right ${
              theme === 'light'
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-[#111923] border-white/[0.08] text-white'
            }`}
          >
            <div className="flex items-center gap-2 mb-2 text-rose-500 font-bold text-sm">
              <Trash2 className="w-4 h-4" />
              <span>حذف الرسالة</span>
            </div>
            <p className={`text-xs mb-4 leading-relaxed ${theme === 'light' ? 'text-slate-600' : 'text-[#8ea0b5]'}`}>
              {isDeleted
                ? 'إخفاء هذه الرسالة المحذوفة من شاشتك؟'
                : 'اختر طريقة حذف هذه الرسالة:'}
            </p>
            <div className="space-y-2">
              {!isDeleted && canDeleteForEveryone && (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleDeleteChoice('everyone')}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  حذف للجميع
                </button>
              )}
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDeleteChoice('me')}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                  theme === 'light'
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    : 'bg-white/[0.07] hover:bg-white/[0.12] text-white'
                }`}
              >
                حذف لدي فقط
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteConfirm(false)}
                className={`w-full py-2 px-3 rounded-xl text-xs font-medium opacity-75 cursor-pointer ${
                  theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-white/[0.04]'
                }`}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
