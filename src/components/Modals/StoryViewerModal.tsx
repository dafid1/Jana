import React, { useEffect, useState, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Heart, Send, Eye } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { getAvatarGradient, getInitials, formatTelegramTime, tgAudio } from '../../utils/telegramHelpers';
import confetti from 'canvas-confetti';

export const StoryViewerModal: React.FC = () => {
  const { stories, activeStoryIndex, setActiveStoryIndex, sendMessage, activeChatId } = useChat();
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [hasLiked, setHasLiked] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentStory = activeStoryIndex !== null ? stories[activeStoryIndex] : null;

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
            // Next story
            if (activeStoryIndex < stories.length - 1) {
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
  }, [activeStoryIndex, isPaused, stories.length]);

  if (activeStoryIndex === null || !currentStory) return null;

  const handleNext = () => {
    if (activeStoryIndex < stories.length - 1) {
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
    if (activeChatId) {
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
        onClick={() => setActiveStoryIndex(null)}
        className="absolute top-5 left-5 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-white/20 transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Navigation Arrows */}
      {activeStoryIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          className="absolute right-4 md:right-10 z-50 p-3 rounded-full bg-black/50 text-white hover:bg-white/20 transition-colors hidden sm:flex"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {activeStoryIndex < stories.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className="absolute left-4 md:left-10 z-50 p-3 rounded-full bg-black/50 text-white hover:bg-white/20 transition-colors hidden sm:flex"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Story Card Container */}
      <div className="relative w-full max-w-md h-[92vh] max-h-[820px] rounded-3xl overflow-hidden shadow-2xl bg-[#111827] flex flex-col justify-between">
        {/* Progress Bars */}
        <div className="absolute top-3 inset-x-3 z-30 flex items-center gap-1.5">
          {stories.map((s, idx) => (
            <div key={s.id} className="h-1 flex-1 bg-white/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-100 ease-linear rounded-full"
                style={{
                  width:
                    idx < activeStoryIndex
                      ? '100%'
                      : idx === activeStoryIndex
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
              {currentStory.userAvatar ? (
                <img
                  src={currentStory.userAvatar}
                  alt={currentStory.userName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{getInitials(currentStory.userName)}</span>
              )}
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">{currentStory.userName}</div>
              <div className="text-[11px] text-white/70">
                {formatTelegramTime(currentStory.createdAt)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs text-white/80 bg-black/40 px-2 py-1 rounded-full">
            <Eye className="w-3.5 h-3.5" />
            <span>{currentStory.viewsCount || 1}</span>
          </div>
        </div>

        {/* Story Image / Video */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <img
            src={currentStory.mediaUrl}
            alt="Story"
            className="w-full h-full object-cover select-none"
          />
        </div>

        {/* Caption & Reply Footer */}
        <div className="relative z-30 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-white">
          {currentStory.caption && (
            <div className="mb-3 p-3 rounded-2xl bg-black/40 backdrop-blur-md text-xs font-medium leading-relaxed text-right">
              {currentStory.caption}
            </div>
          )}

          {/* Quick Reaction & Reply bar */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
              placeholder="إرسال رد..."
              className="flex-1 px-4 py-2 text-xs rounded-full bg-white/20 text-white placeholder-white/70 outline-hidden focus:bg-white/30 backdrop-blur-md text-right"
            />
            {replyText.trim() ? (
              <button
                onClick={handleSendReply}
                className="w-9 h-9 rounded-full bg-[#2481cc] text-white flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            ) : (
              <button
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
