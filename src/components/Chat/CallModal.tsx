import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Volume2,
  VolumeX,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import {
  formatDuration,
  CALL_ENCRYPTION_EMOJIS,
  getAvatarGradient,
  getInitials,
} from '../../utils/telegramHelpers';

export const CallModal: React.FC = () => {
  const { callState, endCall, toggleMute, toggleCamera, getChatDisplayInfo } = useChat();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [isSwapped, setIsSwapped] = useState(false);

  const hasRemoteVideoTrack = Boolean(
    callState.remoteStream && callState.remoteStream.getVideoTracks().length > 0
  );
  const hasLocalVideoTrack = Boolean(
    callState.localStream && callState.localStream.getVideoTracks().length > 0
  );

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject =
        !callState.isCameraOff && callState.localStream ? callState.localStream : null;
    }
  }, [callState.localStream, callState.isCameraOff, isSwapped]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = callState.remoteStream || null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = callState.remoteStream || null;
      remoteAudioRef.current.muted = !isSpeaker;
      if (callState.remoteStream) {
        remoteAudioRef.current.play().catch(() => {});
      }
    }
  }, [callState.remoteStream, isSpeaker, isSwapped]);

  if (!callState.isActive || !callState.chat) return null;

  const chat = callState.chat;
  const displayInfo = getChatDisplayInfo(chat);

  const statusText =
    callState.status === 'calling'
      ? 'جاري الاتصال...'
      : callState.status === 'ringing'
      ? 'يرن...'
      : callState.status === 'declined'
      ? 'تم رفض المكالمة'
      : callState.status === 'ended'
      ? 'تم إنهاء المكالمة'
      : `متصل • ${formatDuration(callState.duration)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center tg-call-mesh select-none animate-in fade-in duration-200 overflow-hidden">
      {/* Hidden audio output element for remote WebRTC audio tracks */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Subtle Ambient Vignette */}
      <div className="absolute inset-0 bg-black/25 pointer-events-none" />

      {/* Top Header: Title, Timer, and Encryption Emojis */}
      <div className="absolute top-6 inset-x-5 sm:inset-x-8 flex items-start justify-between text-white z-20">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold leading-tight tracking-tight drop-shadow-sm">
            {displayInfo.title}
          </h2>
          <div className="flex items-center gap-2 text-xs text-white/90 font-medium mt-1">
            <span
              className={`w-2 h-2 rounded-full ${
                callState.status === 'connected'
                  ? 'bg-emerald-300 animate-pulse'
                  : callState.status === 'ended' || callState.status === 'declined'
                  ? 'bg-rose-400'
                  : 'bg-white animate-ping'
              }`}
            />
            <span className="tabular-nums">{statusText}</span>
          </div>
        </div>

        {/* Telegram Call Encryption Emojis Pill */}
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/25 backdrop-blur-xl border border-white/15 text-base shadow-lg">
            {CALL_ENCRYPTION_EMOJIS.slice(0, 4).map((emoji, i) => (
              <span key={i} title="مفتاح تشفير المكالمة">
                {emoji}
              </span>
            ))}
          </div>
          <span className="text-[10px] text-white/75 mt-1.5 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-300" />
            <span>مكالمة مشفرة</span>
          </span>
        </div>
      </div>

      {/* Main Remote Video or Avatar Centerpiece */}
      <div className="relative w-full max-w-4xl h-[68vh] flex flex-col items-center justify-center z-10 px-4">
        {callState.isVideo ? (
          <div className="relative w-full h-full rounded-3xl overflow-hidden border border-white/15 shadow-2xl bg-[#0e1621]/90 flex items-center justify-center">
            {isSwapped ? (
              !callState.isCameraOff && hasLocalVideoTrack ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-white/70 gap-2">
                  <VideoOff className="w-10 h-10 text-gray-400" />
                  <span className="text-xs">الكاميرا مغلقة</span>
                </div>
              )
            ) : hasRemoteVideoTrack ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 text-center p-6">
                <div
                  className={`w-28 h-28 rounded-full flex items-center justify-center font-bold text-3xl text-white shadow-2xl overflow-hidden ring-2 ring-white/25 bg-gradient-to-tr ${getAvatarGradient(
                    displayInfo.otherUser?.uid || chat.id
                  )}`}
                >
                  {displayInfo.photoURL ? (
                    <img
                      src={displayInfo.photoURL}
                      alt={displayInfo.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{getInitials(displayInfo.title)}</span>
                  )}
                </div>
                <span className="text-xs text-white/80">
                  {callState.status === 'connected'
                    ? 'في انتظار تشغيل الكاميرا من الطرف الآخر...'
                    : statusText}
                </span>
              </div>
            )}

            {/* PiP Preview */}
            <button
              type="button"
              onClick={() => setIsSwapped((prev) => !prev)}
              title="تبديل العرض"
              className="absolute bottom-4 left-4 w-30 sm:w-36 h-42 sm:h-48 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl bg-black/90 cursor-pointer group"
            >
              {!isSwapped ? (
                !callState.isCameraOff && hasLocalVideoTrack ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover -scale-x-100"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#17212b] text-white text-xs">
                    <VideoOff className="w-6 h-6 text-gray-400 mb-1" />
                    <span>الكاميرا مغلقة</span>
                  </div>
                )
              ) : hasRemoteVideoTrack ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#17212b] text-white text-xs font-bold">
                  {getInitials(displayInfo.title)}
                </div>
              )}
              <span className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white/85 opacity-0 group-hover:opacity-100 transition-opacity">
                <RefreshCw className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-7">
              <div
                className={`w-36 h-36 rounded-full flex items-center justify-center font-bold text-4xl text-white shadow-2xl ring-2 ring-white/25 overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                  displayInfo.otherUser?.uid || chat.id
                )} relative z-10`}
              >
                {displayInfo.photoURL ? (
                  <img src={displayInfo.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{getInitials(displayInfo.title)}</span>
                )}
              </div>

              <div className="absolute -inset-2 rounded-full border-2 border-white/40 animate-ping opacity-30" />
              <div className="absolute -inset-6 rounded-full border border-white/20 animate-pulse" />
            </div>

            <p className="text-xs text-white/80 font-medium px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md">
              {callState.status === 'calling'
                ? 'جاري تبادل المفاتيح وتأسيس الاتصال...'
                : 'اتصال صوتي فائق الجودة (WebRTC)'}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Telegram Glassmorphic Call Action Bar */}
      <div className="absolute bottom-8 inset-x-0 flex items-center justify-center z-20 px-4">
        <div className="flex items-center gap-4 sm:gap-5 px-5 py-3 rounded-full bg-black/30 backdrop-blur-2xl border border-white/15 shadow-2xl">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setIsSpeaker((prev) => !prev)}
              className={`w-13 h-13 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                isSpeaker
                  ? 'bg-white text-[#17212b]'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
              title={isSpeaker ? 'إلغاء مكبر الصوت' : 'تشغيل مكبر الصوت'}
            >
              {isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <span className="text-[10px] text-white/75 font-medium">مكبر</span>
          </div>

          {callState.isVideo && (
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={toggleCamera}
                className={`w-13 h-13 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                  callState.isCameraOff
                    ? 'bg-white text-[#17212b]'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
                title={callState.isCameraOff ? 'تشغيل الكاميرا' : 'إيقاف الكاميرا'}
              >
                {callState.isCameraOff ? (
                  <VideoOff className="w-5 h-5" />
                ) : (
                  <Video className="w-5 h-5" />
                )}
              </button>
              <span className="text-[10px] text-white/75 font-medium">فيديو</span>
            </div>
          )}

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={toggleMute}
              className={`w-13 h-13 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                callState.isMuted
                  ? 'bg-white text-[#17212b]'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
              title={callState.isMuted ? 'إلغاء الكتم' : 'كتم'}
            >
              {callState.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <span className="text-[10px] text-white/75 font-medium">كتم</span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={endCall}
              className="w-14 h-14 rounded-full bg-[#e53935] hover:bg-[#d32f2f] text-white flex items-center justify-center shadow-lg shadow-[#e53935]/40 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="إنهاء المكالمة"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <span className="text-[10px] text-white/75 font-medium">إنهاء</span>
          </div>
        </div>
      </div>
    </div>
  );
};
