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
} from 'lucide-react';
import { Message } from '../../types/telegram';
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
} from '../../utils/telegramHelpers';
import { saveImageToGallery } from '../../utils/gallerySaver';

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

export const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({
  message,
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
  } = useChat();

  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState<'1x' | '1.5x' | '2x'>('1x');
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [isSpoilerRevealed, setIsSpoilerRevealed] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const isMe = message.senderId === currentUser?.uid;
  const isChannel = activeChat?.type === 'channel';
  const isSticker = message.type === 'sticker';
  const isDice = message.type === 'dice';

  const [isImageDownloaded, setIsImageDownloaded] = useState<boolean>(() => {
    if (message.type !== 'image') return true;
    if (message.senderId === currentUser?.uid) return true;
    if (activeChat?.type === 'saved') return true;
    return isMediaLocallyDownloaded(currentUser?.uid, message.id);
  });
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [galleryToast, setGalleryToast] = useState<string | null>(null);
  const [stickerImgError, setStickerImgError] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  // Live sender info from usersMap (so profile photo/name changes appear everywhere)
  const liveSender = usersMap[message.senderId];
  const senderDisplayName = liveSender?.displayName || message.senderName;
  const senderPhoto = liveSender?.photoURL || message.senderPhoto;

  // Real Read Receipt Calculation
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
    if (message.type !== 'image') return;
    if (isMe || activeChat?.type === 'saved') {
      setIsImageDownloaded(true);
    } else {
      setIsImageDownloaded(isMediaLocallyDownloaded(currentUser?.uid, message.id));
    }
  }, [message.id, message.type, isMe, activeChat?.type, currentUser?.uid]);

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
    if (!showActionMenu) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowActionMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showActionMenu]);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const triggerReplyToThisMessage = () => {
    setShowActionMenu(false);
    setShowReactionPicker(false);
    setReplyingTo(message);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, [data-no-gesture="true"]')) {
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
      if (dx < -10 && Math.abs(dx) > Math.abs(dy) * 1.15) {
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
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, [data-no-gesture="true"]')) {
      return;
    }
    e.preventDefault();
    clearLongPressTimer();
    setShowReactionPicker(false);
    setShowActionMenu(true);
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
    if (message.text) {
      navigator.clipboard.writeText(message.text);
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

    // Smooth Telegram-style progress animation while fetching & decoding image
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
        // Fallback: reveal image cleanly if browser blocked fetch CORS
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

  return (
    <>
      <div
        id={`msg-${message.id}`}
        data-message-id={message.id}
        className={`group relative flex items-end gap-2 my-1 px-4 touch-pan-y transition-colors duration-500 ${
          isMe ? 'justify-end' : 'justify-start'
        } ${isHighlighted || isActiveSearchMatch ? 'bg-[#2481cc]/20 rounded-2xl py-1' : ''}`}
        onMouseLeave={() => setShowReactionPicker(false)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => finishPointerGesture(e, false)}
        onPointerCancel={(e) => finishPointerGesture(e, true)}
        onContextMenu={handleContextMenu}
        onClickCapture={(e) => {
          if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false;
            e.stopPropagation();
          }
        }}
        style={{ WebkitTouchCallout: 'none' }}
      >
        {/* Swipe Left Reply Visual Indicator */}
        {swipeOffset < -6 && (
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

        {/* Sender Avatar in Group chat for others */}
        {!isMe && !isChannel && activeChat?.type === 'group' && isLastInGroup && (
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
              message.senderId
            )} mb-1`}
          >
            {senderPhoto ? (
              <img src={senderPhoto} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
            ) : (
              <span>{getInitials(senderDisplayName)}</span>
            )}
          </div>
        )}

        {/* Bubble Container */}
        <div
          style={{
            transform: swipeOffset !== 0 ? `translateX(${swipeOffset}px)` : undefined,
            transition: isSwiping ? 'none' : 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
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
          } ${!isSticker && !isDice ? 'px-3.5 py-2.5' : ''} ${
            isActiveSearchMatch && !isSticker && !isDice ? 'ring-2 ring-amber-400/80' : ''
          }`}
        >
          {/* Sender Name for group messages */}
          {!isMe && !isChannel && activeChat?.type === 'group' && (
            <div className="text-xs font-bold text-[#2481cc] mb-1">
              {senderDisplayName}
            </div>
          )}

          {/* Quoted Reply Preview (click to jump to original message) */}
          {(message.replyToId || message.replyToText) && (
            <div
              data-no-gesture="true"
              onClick={(e) => {
                e.stopPropagation();
                if (message.replyToId && onJumpToMessage) {
                  onJumpToMessage(message.replyToId);
                }
              }}
              className={`border-r-2 border-[#2481cc] pr-2 pl-3 py-1 mb-1.5 rounded text-xs opacity-90 transition-colors ${
                message.replyToId && onJumpToMessage ? 'cursor-pointer hover:opacity-100' : ''
              } ${theme === 'light' ? 'bg-black/5 hover:bg-black/10' : 'bg-black/20 hover:bg-black/30'}`}
            >
              <div className="font-semibold text-[#2481cc] text-[11px]">
                {message.replyToSender || 'رد على رسالة'}
              </div>
              <div className="truncate opacity-80">{message.replyToText || 'رسالة'}</div>
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

        {/* 3. IMAGE MESSAGE (Telegram-style pre-open download with blur & progress ring) */}
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

            {/* Telegram Pre-Download Overlay */}
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

            {/* Top-right Save badge when already downloaded */}
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

        {/* 4. VOICE MESSAGE */}
        {message.type === 'voice' && (
          <div className="flex items-center gap-3 py-1 min-w-[220px]">
            {message.mediaUrl && (
              <audio
                ref={audioRef}
                src={message.mediaUrl}
                onEnded={() => setIsPlayingVoice(false)}
                className="hidden"
              />
            )}
            <button
              onClick={handleToggleVoice}
              className="w-10 h-10 rounded-full bg-[#2481cc] text-white flex items-center justify-center shrink-0 hover:scale-105 transition-transform cursor-pointer"
            >
              {isPlayingVoice ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

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

            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-mono opacity-75">
                {formatDuration(message.voiceDuration || 5)}
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
              <div className="text-xs font-semibold truncate">
                {renderHighlightedText(message.mediaName || 'مستند', searchQuery, isActiveSearchMatch)}
              </div>
              <div className="text-[11px] opacity-75">{message.mediaSize || '1.4 MB'}</div>
            </div>
            <a
              href={message.mediaUrl || '#'}
              download={message.mediaName || 'file'}
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
                        {renderHighlightedText(option.text, searchQuery, isActiveSearchMatch)}
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

        {/* 7. TEXT MESSAGE */}
        {message.text && !isDice && !isSticker && (
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
                {renderHighlightedText(message.text, searchQuery, isActiveSearchMatch)}
              </span>
            )}
          </div>
        )}

        {/* 8. INLINE BUTTONS */}
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

        {/* Timestamp, Edited Badge and REAL Read Receipts */}
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
            <span
              className={`inline-flex items-center gap-0.5 ${
                isReadByOthers ? 'text-[#38bdf8]' : 'opacity-65'
              }`}
              title={readerNamesTooltip}
            >
              {isReadByOthers ? (
                <>
                  <CheckCheck className="w-3.5 h-3.5 inline" />
                  {activeChat?.type === 'group' && otherReaders.length > 0 && (
                    <span className="text-[9px] font-bold">{otherReaders.length}</span>
                  )}
                </>
              ) : (
                <Check className="w-3.5 h-3.5 inline" />
              )}
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

        {/* Floating Quick Action Trigger */}
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
            <button
              onClick={() => setShowReactionPicker(!showReactionPicker)}
              className="p-1 rounded-full hover:bg-[#2481cc]/20 hover:text-[#2481cc] transition-colors"
              title="تفاعل"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setReplyingTo(message)}
              className="p-1 rounded-full hover:bg-[#2481cc]/20 hover:text-[#2481cc] transition-colors"
              title="رد"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>

            {isMe && message.type === 'text' && (
              <button
                onClick={() => setEditingMessage(message)}
                className="p-1 rounded-full hover:bg-[#2481cc]/20 hover:text-[#2481cc] transition-colors"
                title="تعديل الرسالة"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={() => pinMessage(message.id, !message.isPinned)}
              className={`p-1 rounded-full hover:bg-[#2481cc]/20 transition-colors ${
                message.isPinned ? 'text-[#2481cc]' : 'hover:text-[#2481cc]'
              }`}
              title={message.isPinned ? 'إلغاء التثبيت' : 'تثبيت'}
            >
              <Pin className="w-3.5 h-3.5 rotate-45" />
            </button>

            {message.text && (
              <button
                onClick={handleCopy}
                className="p-1 rounded-full hover:bg-[#2481cc]/20 hover:text-[#2481cc] transition-colors"
                title="نسخ"
              >
                <Copy className="w-3.5 h-3.5" />
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

      {/* Long-Press / Right-Click Action Menu Overlay */}
      {showActionMenu && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-150"
          onClick={() => setShowActionMenu(false)}
          data-no-gesture="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-xs rounded-2xl shadow-2xl border overflow-hidden animate-in zoom-in-95 duration-150 ${
              theme === 'light'
                ? 'bg-white border-gray-200 text-gray-900'
                : 'bg-[#17212b] border-[#2b3a4a] text-white'
            }`}
          >
            {/* Quick Emoji Reactions */}
            <div
              className={`flex items-center justify-between px-3 py-2.5 border-b overflow-x-auto gap-1 ${
                theme === 'light' ? 'border-gray-100 bg-gray-50' : 'border-[#232e3c] bg-[#1e2a38]'
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

            {/* Selected Message Snippet */}
            <div
              className={`px-3.5 py-2.5 border-b text-xs ${
                theme === 'light' ? 'border-gray-100 bg-gray-50/60' : 'border-[#232e3c] bg-black/15'
              }`}
            >
              <div className="font-bold text-[#2481cc] truncate">{senderDisplayName}</div>
              <div className="truncate opacity-80 mt-0.5">{getMessageReplyPreview(message)}</div>
            </div>

            {/* Action Buttons */}
            <div className="p-1.5 space-y-1">
              <button
                onClick={triggerReplyToThisMessage}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold bg-[#2481cc]/12 text-[#2481cc] hover:bg-[#2481cc] hover:text-white transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Reply className="w-4 h-4" />
                  <span>رد على هذه الرسالة</span>
                </span>
              </button>

              {isMe && message.type === 'text' && (
                <button
                  onClick={() => {
                    setEditingMessage(message);
                    setShowActionMenu(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-white/5'
                  }`}
                >
                  <Edit2 className="w-4 h-4 text-[#7f91a4]" />
                  <span>تعديل الرسالة</span>
                </button>
              )}

              <button
                onClick={() => {
                  pinMessage(message.id, !message.isPinned);
                  setShowActionMenu(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-white/5'
                }`}
              >
                <Pin className={`w-4 h-4 rotate-45 ${message.isPinned ? 'text-[#2481cc]' : 'text-[#7f91a4]'}`} />
                <span>{message.isPinned ? 'إلغاء تثبيت الرسالة' : 'تثبيت الرسالة'}</span>
              </button>

              {message.type === 'image' && message.mediaUrl && isImageDownloaded && (
                <button
                  onClick={handleSaveToGallery}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-white/5'
                  }`}
                >
                  <Download className="w-4 h-4 text-[#2481cc]" />
                  <span>حفظ في المعرض</span>
                </button>
              )}

              {message.text && (
                <button
                  onClick={() => {
                    handleCopy();
                    setShowActionMenu(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-white/5'
                  }`}
                >
                  <Copy className="w-4 h-4 text-[#7f91a4]" />
                  <span>نسخ النص</span>
                </button>
              )}

              <button
                onClick={() => setShowActionMenu(false)}
                className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium opacity-75 transition-colors cursor-pointer ${
                  theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-white/5'
                }`}
              >
                <X className="w-3.5 h-3.5" />
                <span>إلغاء</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
