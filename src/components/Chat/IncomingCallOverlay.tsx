import React from 'react';
import { Phone, PhoneOff, Video, ShieldCheck } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { getAvatarGradient, getInitials } from '../../utils/telegramHelpers';
import { useBackHandler } from '../../utils/androidBackNavigation';

export const IncomingCallOverlay: React.FC = () => {
  const { incomingCall, acceptIncomingCall, declineIncomingCall } = useChat();

  useBackHandler(
    Boolean(incomingCall),
    () => {
      declineIncomingCall();
    },
    92
  );

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg select-none animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#111923]/95 text-white p-6 shadow-2xl text-center space-y-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2481cc]/20 text-sky-300 text-[11px] font-bold">
          {incomingCall.isVideo ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
          <span>{incomingCall.isVideo ? 'مكالمة فيديو واردة' : 'مكالمة صوتية واردة'}</span>
        </div>

        <div className="relative flex justify-center">
          <div className="relative">
            <div
              className={`w-28 h-28 rounded-full flex items-center justify-center font-bold text-3xl text-white shadow-2xl overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                incomingCall.callerId
              )} relative z-10 ring-2 ring-white/20`}
            >
              {incomingCall.callerPhoto ? (
                <img
                  src={incomingCall.callerPhoto}
                  alt={incomingCall.callerName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{getInitials(incomingCall.callerName)}</span>
              )}
            </div>
            <div className="absolute inset-0 rounded-full border-4 border-emerald-400/50 animate-ping opacity-40" />
          </div>
        </div>

        <div>
          <h2 className="text-lg font-extrabold truncate">{incomingCall.callerName}</h2>
          <p className="text-xs text-[#8ea0b5] mt-1 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>اتصال مشفر عبر WebRTC</span>
          </p>
        </div>

        <div className="flex items-center justify-center gap-6 pt-2">
          <button
            type="button"
            onClick={() => declineIncomingCall()}
            className="flex flex-col items-center gap-1.5 cursor-pointer group"
          >
            <div className="w-15 h-15 rounded-full bg-rose-600 group-hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-transform group-hover:scale-105 active:scale-95">
              <PhoneOff className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-rose-300">رفض</span>
          </button>

          <button
            type="button"
            onClick={() => acceptIncomingCall()}
            className="flex flex-col items-center gap-1.5 cursor-pointer group"
          >
            <div className="w-15 h-15 rounded-full bg-emerald-500 group-hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-transform group-hover:scale-105 active:scale-95 animate-bounce">
              {incomingCall.isVideo ? (
                <Video className="w-6 h-6" />
              ) : (
                <Phone className="w-6 h-6" />
              )}
            </div>
            <span className="text-xs font-semibold text-emerald-300">رد</span>
          </button>
        </div>
      </div>
    </div>
  );
};
