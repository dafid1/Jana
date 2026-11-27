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
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-between py-14 px-6 tg-call-mesh text-white select-none animate-in fade-in duration-200 overflow-hidden">
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />

      {/* Top Call Type Pill */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/25 backdrop-blur-xl border border-white/15 text-white text-xs font-bold shadow-md">
          {incomingCall.isVideo ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
          <span>{incomingCall.isVideo ? 'مكالمة فيديو واردة من JanaX' : 'مكالمة صوتية واردة من JanaX'}</span>
        </div>
        <p className="text-[11px] text-white/75 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
          <span>تشفير تام WebRTC</span>
        </p>
      </div>

      {/* Caller Avatar & Name */}
      <div className="relative z-10 flex flex-col items-center text-center gap-5">
        <div className="relative flex justify-center">
          <div
            className={`w-36 h-36 rounded-full flex items-center justify-center font-bold text-4xl text-white shadow-2xl overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
              incomingCall.callerId
            )} relative z-10 ring-2 ring-white/30`}
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
          <div className="absolute -inset-2 rounded-full border-2 border-white/40 animate-ping opacity-35" />
          <div className="absolute -inset-6 rounded-full border border-white/20 animate-pulse" />
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight drop-shadow-sm">
            {incomingCall.callerName}
          </h2>
          <p className="text-sm text-white/80 mt-1">يتصل بك الآن...</p>
        </div>
      </div>

      {/* Bottom Glassmorphic Accept / Decline Buttons */}
      <div className="relative z-10 flex items-center justify-center gap-14 w-full max-w-xs">
        <button
          type="button"
          onClick={() => declineIncomingCall()}
          className="flex flex-col items-center gap-2 cursor-pointer group"
        >
          <div className="w-16 h-16 rounded-full bg-[#e53935] group-hover:bg-[#d32f2f] text-white flex items-center justify-center shadow-2xl shadow-[#e53935]/40 transition-transform group-hover:scale-105 active:scale-95">
            <PhoneOff className="w-7 h-7" />
          </div>
          <span className="text-xs font-bold text-white/90">رفض</span>
        </button>

        <button
          type="button"
          onClick={() => acceptIncomingCall()}
          className="flex flex-col items-center gap-2 cursor-pointer group"
        >
          <div className="w-16 h-16 rounded-full bg-[#4caf50] group-hover:bg-[#43a047] text-white flex items-center justify-center shadow-2xl shadow-[#4caf50]/40 transition-transform group-hover:scale-105 active:scale-95 animate-bounce">
            {incomingCall.isVideo ? (
              <Video className="w-7 h-7" />
            ) : (
              <Phone className="w-7 h-7" />
            )}
          </div>
          <span className="text-xs font-bold text-white/90">رد</span>
        </button>
      </div>
    </div>
  );
};
