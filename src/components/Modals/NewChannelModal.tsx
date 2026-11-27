import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Camera, Check, Megaphone, Globe } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { compressImageFile } from '../../utils/telegramHelpers';

interface NewChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewChannelModal: React.FC<NewChannelModalProps> = ({ isOpen, onClose }) => {
  const { theme, currentUser } = useAuth();
  const { createChat } = useChat();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setError('');
      requestAnimationFrame(() => titleInputRef.current?.focus());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isLight = theme === 'light';

  const handleChannelPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 260, 0.8);
      setPhotoURL(compressed);
    } catch (err) {
      console.error(err);
    } finally {
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setError('');
    setIsSubmitting(true);
    try {
      await createChat({
        type: 'channel',
        title: title.trim(),
        description: description.trim() || 'قناة JanaX للبث العام ومشاركة المحتوى',
        photoURL: photoURL.trim(),
        avatarColor: '#2AABEE',
        memberIds: [currentUser?.uid || ''],
        membersCount: 1,
      });
      setTitle('');
      setDescription('');
      setPhotoURL('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء القناة');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`absolute inset-0 z-30 flex flex-col select-none animate-in fade-in slide-in-from-left-4 duration-200 ${
        isLight ? 'bg-white text-slate-900' : 'bg-[#111923] text-white'
      }`}
    >
      {/* Telegram Top App Bar */}
      <header
        className={`h-14 px-2 flex items-center gap-1 shrink-0 border-b ${
          isLight
            ? 'bg-white border-slate-200/80'
            : 'bg-[#17212b] border-white/[0.06]'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="رجوع"
          className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition-colors cursor-pointer ${
            isLight
              ? 'text-slate-600 hover:bg-slate-100'
              : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold truncate">قناة جديدة</h2>
      </header>

      <form onSubmit={handleSubmit} className="relative flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto pb-24">
          {error && (
            <div className="mx-4 mt-3 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Telegram Channel Photo + Name Row */}
          <div className="px-5 py-6 flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleChannelPhotoUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 rounded-full bg-[#2481cc] hover:bg-[#1e6fb1] text-white flex items-center justify-center shrink-0 overflow-hidden cursor-pointer shadow-md transition-colors"
              title="اختيار صورة القناة"
            >
              {photoURL ? (
                <img src={photoURL} alt="Channel" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-7 h-7" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <input
                ref={titleInputRef}
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="اسم القناة"
                className={`w-full py-2 text-base font-medium bg-transparent border-b-2 outline-none transition-colors ${
                  isLight
                    ? 'border-slate-200 focus:border-[#2481cc] text-slate-900 placeholder:text-slate-400'
                    : 'border-white/[0.12] focus:border-[#2481cc] text-white placeholder:text-[#7f91a4]'
                }`}
              />
            </div>
          </div>

          {/* Description Input */}
          <div className="px-5 pb-3">
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="الوصف"
              className={`w-full py-2 text-sm bg-transparent border-b outline-none resize-none transition-colors ${
                isLight
                  ? 'border-slate-200 focus:border-[#2481cc] text-slate-900 placeholder:text-slate-400'
                  : 'border-white/[0.08] focus:border-[#2481cc] text-white placeholder:text-[#7f91a4]'
              }`}
            />
            <p className="text-xs text-[#7f91a4] mt-2 leading-relaxed">
              يمكنك كتابة وصف اختياري لقناتك. القنوات هي أداة لبث الرسائل إلى أعداد غير محدودة من
              المشتركين.
            </p>
          </div>

          {/* Section Divider */}
          <div
            className={`mt-4 px-4 py-2 text-xs font-semibold border-y ${
              isLight
                ? 'bg-slate-100/80 border-slate-200/70 text-slate-500'
                : 'bg-[#0b1118]/70 border-white/[0.04] text-[#7f91a4]'
            }`}
          >
            خصائص القناة
          </div>

          {/* Telegram-style Channel Properties */}
          <div className="px-5 py-4 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-full bg-[#2481cc]/12 text-[#2481cc] flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold">قناة عامة برابط مشاركة</div>
                <p className="text-xs text-[#7f91a4] mt-0.5 leading-relaxed">
                  يتم إنشاء رابط دعوة مخصص للقناة تلقائياً لتتمكن من مشاركته وانضمام المشتركين.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-full bg-[#2481cc]/12 text-[#2481cc] flex items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold">بث حصري للمشرفين</div>
                <p className="text-xs text-[#7f91a4] mt-0.5 leading-relaxed">
                  فقط مالك القناة والمشرفون المخولون يمكنهم النشر في القناة، مع دعم التفاعلات
                  والاستطلاعات.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Telegram Floating Confirm Checkmark FAB */}
        <button
          type="submit"
          disabled={isSubmitting || !title.trim()}
          aria-label="إنشاء القناة"
          className="absolute bottom-5 left-5 w-14 h-14 rounded-full bg-[#2481cc] hover:bg-[#1e6fb1] text-white shadow-xl shadow-[#2481cc]/35 flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Check className="w-6 h-6 stroke-[2.5]" />
          )}
        </button>
      </form>
    </div>
  );
};
