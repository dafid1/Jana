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
      className={`px-4 py-2 border-b flex items-center justify-between gap-3 text-xs z-10 transition-colors shadow-xs ${
        theme === 'light'
          ? 'bg-[#f4f7fb] border-gray-200 text-gray-800'
          : 'bg-[#182533] border-[#232e3c] text-white'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-1.5 h-7 bg-[#2481cc] rounded-full shrink-0" />
        <Pin className="w-4 h-4 text-[#2481cc] rotate-45 shrink-0" />
        <div className="min-w-0">
          <div className="text-[11px] font-bold text-[#2481cc]">رسالة مثبتة</div>
          <div className="truncate text-xs opacity-90">{pinnedMessage.text}</div>
        </div>
      </div>

      <button
        onClick={() => pinMessage(pinnedMessage.id, false)}
        className="p-1 rounded-full text-[#7f91a4] hover:text-red-400 hover:bg-black/10 transition-colors shrink-0"
        title="إلغاء التثبيت"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
