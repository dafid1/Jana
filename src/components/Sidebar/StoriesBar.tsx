import React, { useMemo } from 'react';
import { Plus, ChevronUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { getAvatarGradient, getInitials } from '../../utils/telegramHelpers';
import { groupStoriesByAuthor, isStoryViewedByUser } from '../../utils/storiesHelper';

interface StoriesBarProps {
  onOpenNewStory: () => void;
  onCollapse?: () => void;
}

const StorySegmentedRing: React.FC<{
  total: number;
  viewedFlags: boolean[];
  gradientId: string;
}> = ({ total, viewedFlags, gradientId }) => {
  const size = 58;
  const center = size / 2;
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const count = Math.max(1, total);
  const gap = count > 1 ? 5 : 0;
  const segmentLength = Math.max(4, (circumference - count * gap) / count);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="pointer-events-none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2481cc" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      {Array.from({ length: count }).map((_, idx) => {
        const isViewed = Boolean(viewedFlags[idx]);
        const angle = -90 + (idx * 360) / count;
        return (
          <circle
            key={idx}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={isViewed ? 'rgba(142, 160, 181, 0.42)' : `url(#${gradientId})`}
            strokeWidth={isViewed ? 2 : 2.5}
            strokeLinecap="round"
            strokeDasharray={count > 1 ? `${segmentLength} ${circumference}` : undefined}
            transform={`rotate(${angle} ${center} ${center})`}
          />
        );
      })}
    </svg>
  );
};

export const StoriesBar: React.FC<StoriesBarProps> = React.memo(
  ({ onOpenNewStory, onCollapse }) => {
    const { theme, currentUser, userProfile, usersMap } = useAuth();
    const { stories, setActiveStoryIndex } = useChat();

    const { myGroup, otherGroups } = useMemo(
      () => groupStoriesByAuthor(stories, currentUser?.uid, usersMap),
      [stories, currentUser?.uid, usersMap]
    );

    const hasMyStories = Boolean(myGroup && myGroup.stories.length > 0);

    return (
      <div
        className={`px-3 pt-2 pb-2.5 border-b select-none transition-colors ${
          theme === 'light'
            ? 'bg-slate-50/70 border-slate-200/75'
            : 'bg-[#0e151e]/85 border-white/[0.06]'
        }`}
      >
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span
            className={`text-[11px] font-bold tracking-tight ${
              theme === 'light' ? 'text-slate-500' : 'text-[#8496ab]'
            }`}
          >
            القصص {stories.length > 0 ? `(${otherGroups.length + (hasMyStories ? 1 : 0)})` : ''}
          </span>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className={`p-1 rounded-lg transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/60'
                  : 'text-[#8496ab] hover:text-white hover:bg-white/[0.06]'
              }`}
              title="طي شريط القصص"
              aria-label="طي شريط القصص"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="overflow-x-auto no-scrollbar flex items-center gap-3 pb-0.5">
          {/* My Story Avatar */}
          <div className="flex flex-col items-center gap-1 shrink-0 group">
            <div className="relative w-[58px] h-[58px] flex items-center justify-center">
              {hasMyStories && myGroup ? (
                <div className="absolute inset-0">
                  <StorySegmentedRing
                    total={myGroup.stories.length}
                    viewedFlags={myGroup.stories.map(() => false)}
                    gradientId="tg-story-grad-me"
                  />
                </div>
              ) : (
                <div className="absolute inset-[2px] rounded-full border border-dashed border-[#2481cc]/60 group-hover:border-[#2481cc] transition-colors" />
              )}

              <button
                type="button"
                onClick={() => {
                  if (hasMyStories && myGroup) {
                    setActiveStoryIndex(myGroup.firstStoryFlatIndex);
                  } else {
                    onOpenNewStory();
                  }
                }}
                className={`w-[48px] h-[48px] rounded-full overflow-hidden flex items-center justify-center font-bold text-xs cursor-pointer transition-transform group-hover:scale-[1.03] ${
                  userProfile?.photoURL
                    ? ''
                    : 'bg-[#2481cc]/15 text-[#2481cc]'
                }`}
                title={hasMyStories ? 'عرض قصتك' : 'إضافة قصة جديدة'}
              >
                {userProfile?.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt="قصتك"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{getInitials(userProfile?.displayName)}</span>
                )}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenNewStory();
                }}
                aria-label="إضافة قصة جديدة"
                title="إضافة قصة جديدة"
                className={`absolute -bottom-0.5 -left-0.5 w-5 h-5 rounded-full bg-[#2481cc] hover:bg-[#1e6fb1] text-white flex items-center justify-center border-2 shadow-xs cursor-pointer transition-transform active:scale-90 ${
                  theme === 'light' ? 'border-slate-50' : 'border-[#0e151e]'
                }`}
              >
                <Plus className="w-3 h-3 stroke-[3]" />
              </button>
            </div>
            <span className="text-[11px] font-medium opacity-85 truncate max-w-[60px] text-center">
              قصتك
            </span>
          </div>

          {/* Grouped Authors Stories List */}
          {otherGroups.map((group) => {
            const viewedFlags = group.stories.map((s) =>
              isStoryViewedByUser(s, currentUser?.uid)
            );
            const gradId = `tg-story-grad-${group.userId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

            return (
              <button
                key={group.userId}
                type="button"
                onClick={() => setActiveStoryIndex(group.firstUnviewedFlatIndex)}
                className="flex flex-col items-center gap-1 cursor-pointer shrink-0 group focus:outline-none"
              >
                <div className="relative w-[58px] h-[58px] flex items-center justify-center">
                  <div className="absolute inset-0 transition-transform duration-150 group-hover:scale-105">
                    <StorySegmentedRing
                      total={group.stories.length}
                      viewedFlags={viewedFlags}
                      gradientId={gradId}
                    />
                  </div>
                  <div
                    className={`w-[48px] h-[48px] rounded-full overflow-hidden flex items-center justify-center font-bold text-xs text-white bg-gradient-to-tr ${getAvatarGradient(
                      group.userId
                    )}`}
                  >
                    {group.userAvatar ? (
                      <img
                        src={group.userAvatar}
                        alt={group.userName}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{getInitials(group.userName)}</span>
                    )}
                  </div>
                </div>
                <span
                  className={`text-[11px] truncate max-w-[60px] text-center ${
                    group.allViewed ? 'opacity-55 font-normal' : 'font-semibold opacity-95'
                  }`}
                >
                  {group.userName.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
);
