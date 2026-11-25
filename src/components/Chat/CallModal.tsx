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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 select-none animate-in fade-in duration-200">
      {/* Hidden audio output element for remote WebRTC audio tracks */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 blur-3xl">
        <div className="w-full h-full bg-gradient-to-tr from-[#2481cc] via-[#8c5fd1] to-[#e17076]" />
      </div>

      {/* Top Header: Title, Timer, and Encryption Emojis */}
      <div className="absolute top-5 inset-x-6 flex items-center justify-between text-white z-20">
        <div>
          <h2 className="text-lg font-bold leading-tight">{displayInfo.title}</h2>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium mt-0.5">
            <span
              className={`w-2 h-2 rounded-full ${
                callState.status === 'connected'
                  ? 'bg-emerald-400 animate-pulse'
                  : callState.status === 'ended' || callState.status === 'declined'
                  ? 'bg-rose-400'
                  : 'bg-amber-400 animate-ping'
              }`}
            />
            <span className="tabular-nums">{statusText}</span>
          </div>
        </div>

        {/* Encryption Emojis */}
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-base shadow-lg">
            {CALL_ENCRYPTION_EMOJIS.slice(0, 4).map((emoji, i) => (
              <span key={i} title="مفتاح تشفير المكالمة">
                {emoji}
              </span>
            ))}
          </div>
          <span className="text-[10px] text-white/60 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>تشفير تام WebRTC E2EE</span>
          </span>
        </div>
      </div>

      {/* Main Remote Video or Avatar Centerpiece */}
      <div className="relative w-full max-w-4xl h-[70vh] flex flex-col items-center justify-center z-10 px-4">
        {callState.isVideo ? (
          <div className="relative w-full h-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#111827] flex items-center justify-center">
            {/* Main Stream (Remote by default, Local if swapped) */}
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
                  <VideoOff className="w-10 h-10 text-gray-500" />
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
                  className={`w-28 h-28 rounded-full flex items-center justify-center font-bold text-3xl text-white shadow-2xl overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
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
                <span className="text-xs text-white/70">
                  {callState.status === 'connected'
                    ? 'في انتظار تشغيل الكاميرا من الطرف الآخر...'
                    : statusText}
                </span>
              </div>
            )}

            {/* PiP Preview (clickable to swap view) */}
            <button
              type="button"
              onClick={() => setIsSwapped((prev) => !prev)}
              title="تبديل العرض"
              className="absolute bottom-4 left-4 w-32 sm:w-36 h-44 sm:h-48 rounded-2xl overflow-hidden border-2 border-white/25 shadow-xl bg-black/90 cursor-pointer group"
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
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white text-xs">
                    <VideoOff className="w-6 h-6 text-gray-500 mb-1" />
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
                <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white text-xs font-bold">
                  {getInitials(displayInfo.title)}
                </div>
              )}
              <span className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
                <RefreshCw className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        ) : (
          /* Voice Call Big Avatar with Wave Pulse */
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div
                className={`w-32 h-32 rounded-full flex items-center justify-center font-bold text-4xl text-white shadow-2xl overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                  displayInfo.otherUser?.uid || chat.id
                )} relative z-10`}
              >
                {displayInfo.photoURL ? (
                  <img src={displayInfo.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{getInitials(displayInfo.title)}</span>
                )}
              </div>

              <div className="absolute inset-0 rounded-full border-4 border-[#2481cc] animate-ping opacity-25" />
              <div className="absolute -inset-4 rounded-full border-2 border-sky-400/30 animate-pulse" />
            </div>

            <p className="text-sm text-sky-200/90 font-medium">
              {callState.status === 'calling'
                ? 'جاري إنشاء اتصال WebRTC آمن...'
                : 'جودة الصوت فائقة الدقة (HD Voice)'}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="absolute bottom-8 inset-x-0 flex items-center justify-center gap-4 z-20">
        <div className="flex items-center gap-3 p-3 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl">
          <button
            type="button"
            onClick={toggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer ${
              callState.isMuted
                ? 'bg-red-500 text-white'
                : 'bg-white/15 hover:bg-white/25 text-white'
            }`}
            title={callState.isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
          >
            {callState.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {callState.isVideo && (
            <button
              type="button"
              onClick={toggleCamera}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer ${
                callState.isCameraOff
                  ? 'bg-red-500 text-white'
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
          )}

          <button
            type="button"
            onClick={() => setIsSpeaker((prev) => !prev)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer ${
              !isSpeaker
                ? 'bg-red-500 text-white'
                : 'bg-white/15 hover:bg-white/25 text-white'
            }`}
            title={isSpeaker ? 'كتم مكبر الصوت' : 'تشغيل مكبر الصوت'}
          >
            {isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={endCall}
            className="w-13 h-13 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 cursor-pointer ml-2"
            title="إنهاء المكالمة"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
