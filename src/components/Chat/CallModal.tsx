import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Share2,
  ShieldCheck,
  Maximize2,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import {
  formatDuration,
  CALL_ENCRYPTION_EMOJIS,
  getAvatarGradient,
  getInitials,
} from '../../utils/telegramHelpers';

export const CallModal: React.FC = () => {
  const { callState, endCall, toggleMute, toggleCamera } = useChat();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isSpeaker, setIsSpeaker] = useState(true);

  // Attempt local camera when video is enabled
  useEffect(() => {
    if (callState.isActive && callState.isVideo && !callState.isCameraOff) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: true, audio: false })
          .then((stream) => {
            setLocalStream(stream);
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
          })
          .catch(() => {
            // Camera not available, fallback silently
          });
      }
    } else {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
        setLocalStream(null);
      }
    }

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [callState.isActive, callState.isVideo, callState.isCameraOff]);

  if (!callState.isActive || !callState.chat) return null;

  const chat = callState.chat;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 select-none animate-in fade-in duration-200">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 blur-3xl">
        <div className="w-full h-full bg-gradient-to-tr from-[#2481cc] via-[#8c5fd1] to-[#e17076]" />
      </div>

      {/* Top Header: Title, Timer, and Encryption Emojis */}
      <div className="absolute top-5 inset-x-6 flex items-center justify-between text-white z-20">
        <div>
          <h2 className="text-lg font-bold leading-tight">{chat.title}</h2>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {callState.status === 'calling'
                ? 'جاري الاتصال...'
                : `متصل • ${formatDuration(callState.duration)}`}
            </span>
          </div>
        </div>

        {/* Telegram Signature 4 Encryption Emojis */}
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
            <span>تشفير تام E2EE</span>
          </span>
        </div>
      </div>

      {/* Main Remote Video or Avatar Centerpiece */}
      <div className="relative w-full max-w-4xl h-[70vh] flex flex-col items-center justify-center z-10 px-4">
        {callState.isVideo ? (
          <div className="relative w-full h-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#111827] flex items-center justify-center">
            {/* Remote Simulated Video Feed */}
            <img
              src={
                chat.photoURL ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80'
              }
              alt="Remote Video"
              className="w-full h-full object-cover"
            />

            {/* PiP Local Video Preview */}
            <div className="absolute bottom-4 left-4 w-36 h-48 rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl bg-black">
              {!callState.isCameraOff && localStream ? (
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
              )}
            </div>
          </div>
        ) : (
          /* Voice Call Big Avatar with Wave Pulse */
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div
                className={`w-32 h-32 rounded-full flex items-center justify-center font-bold text-4xl text-white shadow-2xl overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                  chat.id
                )} relative z-10`}
              >
                {chat.photoURL ? (
                  <img src={chat.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{getInitials(chat.title)}</span>
                )}
              </div>

              {/* Telegram Calling Ripple Rings */}
              <div className="absolute inset-0 rounded-full border-4 border-[#2481cc] animate-ping opacity-25" />
              <div className="absolute -inset-4 rounded-full border-2 border-sky-400/30 animate-pulse" />
            </div>

            <p className="text-sm text-sky-200/90 font-medium">
              {callState.status === 'calling'
                ? 'جاري إنشاء اتصال آمن...'
                : 'جودة الصوت فائقة الدقة (HD Voice)'}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="absolute bottom-8 inset-x-0 flex items-center justify-center gap-4 z-20">
        <div className="flex items-center gap-3 p-3 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl">
          {/* Mute Mic Button */}
          <button
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

          {/* Toggle Camera Button */}
          <button
            onClick={toggleCamera}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer ${
              callState.isCameraOff
                ? 'bg-red-500 text-white'
                : 'bg-white/15 hover:bg-white/25 text-white'
            }`}
            title={callState.isCameraOff ? 'تشغيل الكاميرا' : 'إيقاف الكاميرا'}
          >
            {callState.isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {/* Speaker Button */}
          <button
            onClick={() => setIsSpeaker(!isSpeaker)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer ${
              !isSpeaker
                ? 'bg-red-500 text-white'
                : 'bg-white/15 hover:bg-white/25 text-white'
            }`}
            title="مكبر الصوت"
          >
            {isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* End Call Button */}
          <button
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
