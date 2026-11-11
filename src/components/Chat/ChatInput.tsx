import React, { useState, useRef, useEffect } from 'react';
import {
  Paperclip,
  Smile,
  Send,
  Mic,
  X,
  Image as ImageIcon,
  FileText,
  BarChart2,
  Check,
  Edit2,
  Dices,
  EyeOff,
  Bold,
  Code,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { TG_STICKERS, formatDuration } from '../../utils/telegramHelpers';

interface ChatInputProps {
  onOpenPollModal: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onOpenPollModal }) => {
  const { theme } = useAuth();
  const {
    sendMessage,
    replyingTo,
    setReplyingTo,
    editingMessage,
    setEditingMessage,
    editMessageText,
    sendDiceRoll,
  } = useChat();

  const [text, setText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activePickerTab, setActivePickerTab] = useState<'emoji' | 'sticker'>('emoji');
  const [isSpoilerActive, setIsSpoilerActive] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // If editing message is set, pre-fill text
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text);
      textareaRef.current?.focus();
    }
  }, [editingMessage]);

  useEffect(() => {
    if (replyingTo) {
      textareaRef.current?.focus();
    }
  }, [replyingTo]);

  // Voice timer
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setRecordingSeconds(0);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  const handleSendText = async () => {
    if (!text.trim()) return;

    if (editingMessage) {
      await editMessageText(editingMessage.id, text.trim());
      setText('');
      setEditingMessage(null);
      return;
    }

    const msgText = text;
    const spoiler = isSpoilerActive;
    setText('');
    setIsSpoilerActive(false);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendMessage(msgText, 'text', { isSpoiler: spoiler });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  // Image Upload
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      await sendMessage('📷 صورة', 'image', {
        mediaUrl: dataUrl,
        mediaName: file.name,
      });
      setShowAttachMenu(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Document Upload
  const handleDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
      await sendMessage(file.name, 'file', {
        mediaUrl: dataUrl,
        mediaName: file.name,
        mediaSize: sizeMB,
      });
      setShowAttachMenu(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Send Sticker
  const handleSendSticker = async (sticker: (typeof TG_STICKERS)[0]) => {
    setShowEmojiPicker(false);
    await sendMessage(sticker.emoji, 'sticker', {
      mediaUrl: sticker.url,
      mediaName: sticker.name,
    });
  };

  // Finish voice recording
  const handleFinishVoice = async () => {
    const duration = Math.max(recordingSeconds, 1);
    setIsRecording(false);
    await sendMessage('🎤 رسالة صوتية', 'voice', {
      voiceDuration: duration,
    });
  };

  const emojis = [
    '😀', '😂', '😍', '😎', '🥳', '🔥', '❤️', '👍', '🙏', '👏',
    '🎉', '✨', '🤔', '🙌', '💯', '🚀', '☕️', '🌟', '💪', '🤩',
    '😉', '🤝', '😊', '👌', '⚡️', '🍉', '🍕', '🎯', '💡', '🌈',
  ];

  return (
    <div
      className={`relative border-t shrink-0 p-3 select-none transition-colors ${
        theme === 'light' ? 'bg-white border-gray-200' : 'bg-[#17212b] border-[#232e3c]'
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageSelect}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={docInputRef}
        onChange={handleDocSelect}
        accept=".pdf,.doc,.docx,.zip,.txt"
        className="hidden"
      />

      {/* Editing Message Banner */}
      {editingMessage && (
        <div
          className={`flex items-center justify-between p-2 mb-2 rounded-xl border-r-3 border-amber-500 text-xs ${
            theme === 'light' ? 'bg-amber-50' : 'bg-amber-950/30'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <Edit2 className="w-4 h-4 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-amber-500">تعديل الرسالة</div>
              <div className="truncate text-gray-400">{editingMessage.text}</div>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingMessage(null);
              setText('');
            }}
            className="p-1 rounded-full text-[#7f91a4] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quoted Reply Preview Bar */}
      {replyingTo && !editingMessage && (
        <div
          className={`flex items-center justify-between p-2 mb-2 rounded-xl border-r-3 border-[#2481cc] text-xs ${
            theme === 'light' ? 'bg-[#f4f7fb]' : 'bg-[#242f3d]'
          }`}
        >
          <div className="min-w-0 pr-2">
            <div className="font-bold text-[#2481cc]">{replyingTo.senderName}</div>
            <div className="truncate text-gray-400">{replyingTo.text}</div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded-full text-[#7f91a4] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Input Row */}
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        {/* Attachment Button */}
        <div className="relative">
          <button
            onClick={() => {
              setShowAttachMenu(!showAttachMenu);
              setShowEmojiPicker(false);
            }}
            className={`p-2.5 rounded-full transition-colors cursor-pointer ${
              showAttachMenu
                ? 'text-[#2481cc] bg-[#2481cc]/15'
                : theme === 'light'
                ? 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                : 'text-[#7f91a4] hover:text-white hover:bg-[#232e3c]'
            }`}
            title="إرفاق ملف"
          >
            <Paperclip className="w-5 h-5 -rotate-45" />
          </button>

          {/* Attachment Popup Menu */}
          {showAttachMenu && (
            <div
              className={`absolute bottom-13 right-0 rounded-2xl shadow-xl border overflow-hidden p-1.5 flex flex-col gap-1 min-w-[190px] z-50 animate-in fade-in zoom-in-95 duration-150 ${
                theme === 'light'
                  ? 'bg-white border-gray-200 text-gray-800'
                  : 'bg-[#1e2a38] border-[#2b3a4a] text-white'
              }`}
            >
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-xl hover:bg-white/5 transition-colors text-right cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-[#2481cc]/20 text-[#2481cc] flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <span>صورة أو فيديو</span>
              </button>

              <button
                onClick={() => docInputRef.current?.click()}
                className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-xl hover:bg-white/5 transition-colors text-right cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <span>ملف أو مستند</span>
              </button>

              <button
                onClick={() => {
                  setShowAttachMenu(false);
                  onOpenPollModal();
                }}
                className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-xl hover:bg-white/5 transition-colors text-right cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <BarChart2 className="w-4 h-4" />
                </div>
                <span>استطلاع رأي</span>
              </button>

              <button
                onClick={() => {
                  setShowAttachMenu(false);
                  sendDiceRoll('🎲');
                }}
                className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-xl hover:bg-white/5 transition-colors text-right cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Dices className="w-4 h-4" />
                </div>
                <span>رمي نرد عشوائي</span>
              </button>
            </div>
          )}
        </div>

        {/* Recording Visualizer or Text Input */}
        {isRecording ? (
          <div
            className={`flex-1 flex items-center justify-between px-4 py-2.5 rounded-2xl border ${
              theme === 'light'
                ? 'bg-red-50 border-red-200 text-red-600'
                : 'bg-red-950/30 border-red-800/40 text-red-400'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <span className="font-mono text-sm font-bold">
                {formatDuration(recordingSeconds)}
              </span>
              <span className="text-xs font-medium">جاري تسجيل رسالة صوتية...</span>
            </div>

            <button
              onClick={() => setIsRecording(false)}
              className="text-xs font-semibold hover:underline cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        ) : (
          <div
            className={`flex-1 flex items-end rounded-2xl px-3 py-1.5 transition-all ${
              theme === 'light'
                ? 'bg-[#f1f1f1] focus-within:bg-white focus-within:ring-1 focus-within:ring-[#2481cc]'
                : 'bg-[#242f3d] focus-within:bg-[#2c3848] focus-within:ring-1 focus-within:ring-[#2481cc]'
            }`}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder={editingMessage ? 'عدّل الرسالة...' : 'اكتب رسالة...'}
              className={`w-full py-1 text-sm bg-transparent outline-hidden resize-none max-h-32 text-right ${
                theme === 'light'
                  ? 'text-gray-900 placeholder-gray-400'
                  : 'text-white placeholder-[#7f91a4]'
              }`}
            />

            {/* Formatting Tools & Emoji Buttons */}
            <div className="flex items-center gap-0.5 shrink-0">
              {/* Spoiler Toggle Button */}
              <button
                onClick={() => setIsSpoilerActive(!isSpoilerActive)}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  isSpoilerActive
                    ? 'text-amber-400 bg-amber-400/20'
                    : 'text-[#7f91a4] hover:text-white'
                }`}
                title="تأثير نص مخفي (Spoiler)"
              >
                <EyeOff className="w-4 h-4" />
              </button>

              {/* Emoji & Sticker Toggle Button */}
              <button
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker);
                  setShowAttachMenu(false);
                }}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  showEmojiPicker
                    ? 'text-[#2481cc]'
                    : theme === 'light'
                    ? 'text-gray-400 hover:text-gray-700'
                    : 'text-[#7f91a4] hover:text-white'
                }`}
                title="الرموز التعبيرية والملصقات"
              >
                <Smile className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Action Button: Send or Voice Record or Save Edit */}
        {editingMessage ? (
          <button
            onClick={handleSendText}
            className="w-10 h-10 rounded-full bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center shrink-0 shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            title="حفظ التعديل"
          >
            <Check className="w-5 h-5" />
          </button>
        ) : text.trim() ? (
          <button
            onClick={handleSendText}
            className="w-10 h-10 rounded-full bg-[#2481cc] hover:bg-[#2172b5] text-white flex items-center justify-center shrink-0 shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            title="إرسال"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        ) : isRecording ? (
          <button
            onClick={handleFinishVoice}
            className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            title="إرسال التسجيل"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        ) : (
          <button
            onClick={() => setIsRecording(true)}
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
              theme === 'light'
                ? 'text-gray-500 hover:bg-gray-100 hover:text-[#2481cc]'
                : 'text-[#7f91a4] hover:bg-[#242f3d] hover:text-[#2481cc]'
            }`}
            title="تسجيل رسالة صوتية"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Emoji & Telegram Sticker Drawer Popover */}
      {showEmojiPicker && (
        <div
          className={`absolute bottom-16 left-6 right-6 sm:left-auto sm:right-16 sm:w-80 rounded-2xl shadow-2xl border overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 ${
            theme === 'light' ? 'bg-white border-gray-200' : 'bg-[#1e2a38] border-[#2b3a4a]'
          }`}
        >
          {/* Header Tabs */}
          <div className="flex border-b border-white/10 text-xs font-semibold">
            <button
              onClick={() => setActivePickerTab('emoji')}
              className={`flex-1 py-2.5 text-center transition-colors cursor-pointer ${
                activePickerTab === 'emoji'
                  ? 'text-[#2481cc] border-b-2 border-[#2481cc]'
                  : 'text-[#7f91a4] hover:text-white'
              }`}
            >
              الرموز التعبيرية
            </button>
            <button
              onClick={() => setActivePickerTab('sticker')}
              className={`flex-1 py-2.5 text-center transition-colors cursor-pointer ${
                activePickerTab === 'sticker'
                  ? 'text-[#2481cc] border-b-2 border-[#2481cc]'
                  : 'text-[#7f91a4] hover:text-white'
              }`}
            >
              ملصقات تيليجرام
            </button>
          </div>

          {/* Content Area */}
          <div className="p-3 max-h-56 overflow-y-auto">
            {activePickerTab === 'emoji' ? (
              <div className="grid grid-cols-6 gap-2 text-xl text-center">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setText((prev) => prev + emoji)}
                    className="p-1.5 rounded-lg hover:scale-125 transition-transform cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {TG_STICKERS.map((sticker) => (
                  <button
                    key={sticker.id}
                    onClick={() => handleSendSticker(sticker)}
                    className="p-1 rounded-xl hover:bg-white/10 transition-colors flex flex-col items-center gap-1 cursor-pointer"
                  >
                    <img
                      src={sticker.url}
                      alt={sticker.name}
                      className="w-16 h-16 object-cover rounded-lg shadow-xs"
                    />
                    <span className="text-[10px] font-medium truncate w-full text-center opacity-80">
                      {sticker.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
