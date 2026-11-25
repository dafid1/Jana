import React from 'react';
import { Pin, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

export const PinnedMessageBanner: React.FC = () => {
  const { theme } = useAuth();
  const { pinnedMessage, pinMessage } = useChat();

  if (!pinnedMessage) return null;

  return (
    <div
      className={`px-3 sm:px-4 py-2 border-b flex items-center justify-between gap-3 text-xs z-10 backdrop-blur-md transition-colors duration-150 ${
        theme === 'light'
          ? 'bg-white/90 border-slate-200/80 text-slate-900'
          : 'bg-[#111923]/90 border-white/[0.06] text-white'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-[#2481cc]/12 text-[#2481cc] flex items-center justify-center shrink-0">
          <Pin className="w-3.5 h-3.5 rotate-45" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold text-[#2481cc] leading-tight">رسالة مثبتة</div>
          <div
            className={`truncate text-xs mt-0.5 ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-300'
            }`}
          >
            {pinnedMessage.text}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => pinMessage(pinnedMessage.id, false)}
        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150 shrink-0 cursor-pointer ${
          theme === 'light'
            ? 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'
            : 'text-[#8ea0b5] hover:text-rose-400 hover:bg-rose-500/10'
        }`}
        title="إلغاء التثبيت"
        aria-label="إلغاء تثبيت الرسالة"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
