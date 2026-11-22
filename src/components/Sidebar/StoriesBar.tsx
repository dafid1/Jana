import React from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { getAvatarGradient, getInitials } from '../../utils/telegramHelpers';

interface StoriesBarProps {
  onOpenNewStory: () => void;
}

export const StoriesBar: React.FC<StoriesBarProps> = React.memo(({ onOpenNewStory }) => {
  const { theme, userProfile, usersMap } = useAuth();
  const { stories, setActiveStoryIndex } = useChat();

  return (
    <div
      className={`px-3 py-2 border-b overflow-x-auto no-scrollbar flex items-center gap-3 shrink-0 select-none ${
        theme === 'light' ? 'bg-[#f8f9fa] border-gray-100' : 'bg-[#151e27] border-[#202b36]'
      }`}
    >
      {/* My Story Add Button */}
      <div
        onClick={onOpenNewStory}
        className="flex flex-col items-center gap-1 cursor-pointer shrink-0 group"
      >
        <div className="relative">
          <div className="w-13 h-13 rounded-full p-0.5 border border-dashed border-[#2481cc]/60 group-hover:border-[#2481cc] transition-colors flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-[#2481cc]/15 flex items-center justify-center text-[#2481cc]">
              {userProfile?.photoURL ? (
                <img
                  src={userProfile.photoURL}
                  alt="My Story"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="font-bold text-xs">{getInitials(userProfile?.displayName)}</span>
              )}
            </div>
          </div>
          <div className="absolute -bottom-0.5 -left-0.5 w-4.5 h-4.5 rounded-full bg-[#2481cc] text-white flex items-center justify-center border-2 border-[#151e27] shadow-xs">
            <Plus className="w-3 h-3 stroke-[3]" />
          </div>
        </div>
        <span className="text-[10px] font-medium opacity-80 truncate max-w-[56px] text-center">
          قصتك
        </span>
      </div>

      {/* Stories List */}
      {stories.map((story, index) => {
        const author = usersMap[story.userId];
        const authorName = author?.displayName || story.userName;
        const authorAvatar = author?.photoURL || story.userAvatar;
        return (
          <div
            key={story.id}
            onClick={() => setActiveStoryIndex(index)}
            className="flex flex-col items-center gap-1 cursor-pointer shrink-0 group"
          >
            {/* Gradient Ring Avatar */}
            <div className="p-0.5 rounded-full bg-gradient-to-tr from-[#2481cc] via-[#a674e0] to-[#e17076] group-hover:scale-105 transition-transform duration-200">
              <div
                className={`w-12 h-12 rounded-full p-0.5 ${
                  theme === 'light' ? 'bg-white' : 'bg-[#17212b]'
                }`}
              >
                <div
                  className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center font-bold text-xs text-white bg-gradient-to-tr ${getAvatarGradient(
                    story.userId
                  )}`}
                >
                  {authorAvatar ? (
                    <img
                      src={authorAvatar}
                      alt={authorName}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{getInitials(authorName)}</span>
                  )}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-medium opacity-80 truncate max-w-[56px] text-center">
              {authorName.split(' ')[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
});
