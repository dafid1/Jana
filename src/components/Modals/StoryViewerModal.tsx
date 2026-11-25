import React, { useEffect, useState, useRef, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Heart, Send, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { getAvatarGradient, getInitials, formatTelegramTime, tgAudio } from '../../utils/telegramHelpers';
import { groupStoriesByAuthor } from '../../utils/storiesHelper';
import confetti from 'canvas-confetti';

export const StoryViewerModal: React.FC = () => {
  const { currentUser, usersMap } = useAuth();
  const {
    stories,
    activeStoryIndex,
    setActiveStoryIndex,
    sendMessage,
    startDirectChat,
    activeChatId,
    markStoryViewed,
  } = useChat();
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [hasLiked, setHasLiked] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { orderedStories, allGroups } = useMemo(
    () => groupStoriesByAuthor(stories, currentUser?.uid, usersMap),
    [stories, currentUser?.uid, usersMap]
  );

  const currentStory =
    activeStoryIndex !== null ? orderedStories[activeStoryIndex] || null : null;

  const currentAuthorGroup = useMemo(() => {
    if (!currentStory) return null;
    return allGroups.find((g) => g.userId === currentStory.userId) || null;
  }, [allGroups, currentStory]);

  const authorStories = currentAuthorGroup?.stories || (currentStory ? [currentStory] : []);
  const indexWithinAuthor = currentStory
    ? Math.max(
        0,
        authorStories.findIndex((s) => s.id === currentStory.id)
      )
    : 0;

  useEffect(() => {
    if (currentStory?.id) {
      markStoryViewed(currentStory.id);
    }
  }, [currentStory?.id]);

  useEffect(() => {
    if (activeStoryIndex === null) {
      setProgress(0);
      return;
    }

    setProgress(0);
    setHasLiked(false);

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (!isPaused) {
        setProgress((prev) => {
          if (prev >= 100) {
            if (activeStoryIndex < orderedStories.length - 1) {
              setActiveStoryIndex(activeStoryIndex + 1);
            } else {
              setActiveStoryIndex(null);
            }
            return 0;
          }
          return prev + 2;
        });
      }
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeStoryIndex, isPaused, orderedStories.length]);

  if (activeStoryIndex === null || !currentStory) return null;

  const liveAuthor = usersMap[currentStory.userId];
  const displayAuthorName = liveAuthor?.displayName || currentStory.userName;
  const displayAuthorAvatar = liveAuthor?.photoURL || currentStory.userAvatar;

  const handleNext = () => {
    if (activeStoryIndex < orderedStories.length - 1) {
      setActiveStoryIndex(activeStoryIndex + 1);
    } else {
      setActiveStoryIndex(null);
    }
  };

  const handlePrev = () => {
    if (activeStoryIndex > 0) {
      setActiveStoryIndex(activeStoryIndex - 1);
    }
  };

  const handleLike = () => {
    setHasLiked(!hasLiked);
    tgAudio.playPopSound();
    confetti({ particleCount: 30, spread: 50 });
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    const txt = `رد على القصة: "${replyText.trim()}"`;
    setReplyText('');
    if (liveAuthor && currentStory.userId !== currentUser?.uid) {
      const targetChatId = await startDirectChat(liveAuthor);
      await sendMessage(txt, 'text', {}, targetChatId);
    } else if (activeChatId) {
      await sendMessage(txt, 'text');
    }
    setActiveStoryIndex(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md select-none"
      onMouseDown={() => setIsPaused(true)}
      onMouseUp={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={() => setActiveStoryIndex(null)}
        className="absolute top-5 left-5 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-white/20 transition-colors cursor-pointer"
        aria-label="إغلاق"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Desktop Navigation Arrows */}
      {activeStoryIndex > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          className="absolute right-4 md:right-10 z-50 p-3 rounded-full bg-black/50 text-white hover:bg-white/20 transition-colors hidden sm:flex cursor-pointer"
          aria-label="القصة السابقة"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {activeStoryIndex < orderedStories.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className="absolute left-4 md:left-10 z-50 p-3 rounded-full bg-black/50 text-white hover:bg-white/20 transition-colors hidden sm:flex cursor-pointer"
          aria-label="القصة التالية"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Story Card Container */}
      <div className="relative w-full max-w-md h-[92vh] max-h-[820px] rounded-3xl overflow-hidden shadow-2xl bg-[#111827] flex flex-col justify-between">
        {/* Per-Author Progress Bars (Telegram Style) */}
        <div className="absolute top-3 inset-x-3 z-30 flex items-center gap-1.5">
          {authorStories.map((s, idx) => (
            <div key={s.id} className="h-1 flex-1 bg-white/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-100 ease-linear rounded-full"
                style={{
                  width:
                    idx < indexWithinAuthor
                      ? '100%'
                      : idx === indexWithinAuthor
                      ? `${progress}%`
                      : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Story Header */}
        <div className="relative z-30 p-4 pt-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                currentStory.userId
              )} border-2 border-white/50`}
            >
              {displayAuthorAvatar ? (
                <img
                  src={displayAuthorAvatar}
                  alt={displayAuthorName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{getInitials(displayAuthorName)}</span>
              )}
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">{displayAuthorName}</div>
              <div className="text-[11px] text-white/75 tabular-nums">
                {formatTelegramTime(currentStory.createdAt)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs text-white/85 bg-black/40 px-2.5 py-1 rounded-full tabular-nums">
            <Eye className="w-3.5 h-3.5" />
            <span>{currentStory.viewedBy?.length || 1}</span>
          </div>
        </div>

        {/* Story Image + Left/Right Mobile Tap Navigation Zones */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <img
            src={currentStory.mediaUrl}
            alt="Story"
            className="w-full h-full object-cover select-none"
          />
          <button
            type="button"
            aria-label="القصة السابقة"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute inset-y-16 right-0 w-1/3 z-20 bg-transparent cursor-pointer focus:outline-none"
          />
          <button
            type="button"
            aria-label="القصة التالية"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute inset-y-16 left-0 w-2/3 z-20 bg-transparent cursor-pointer focus:outline-none"
          />
        </div>

        {/* Caption & Reply Footer */}
        <div
          className="relative z-30 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-white"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {currentStory.caption && (
            <div className="mb-3 p-3 rounded-2xl bg-black/45 backdrop-blur-md text-xs font-medium leading-relaxed text-right">
              {currentStory.caption}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onFocus={() => setIsPaused(true)}
              onBlur={() => setIsPaused(false)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
              placeholder="إرسال رد..."
              className="flex-1 px-4 py-2 text-xs rounded-full bg-white/20 text-white placeholder-white/70 outline-hidden focus:bg-white/30 backdrop-blur-md text-right"
            />
            {replyText.trim() ? (
              <button
                type="button"
                onClick={handleSendReply}
                className="w-9 h-9 rounded-full bg-[#2481cc] text-white flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLike}
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 backdrop-blur-md transition-transform active:scale-90 cursor-pointer ${
                  hasLiked ? 'bg-red-600 text-white scale-110' : 'bg-white/20 text-white'
                }`}
              >
                <Heart className={`w-5 h-5 ${hasLiked ? 'fill-current' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
