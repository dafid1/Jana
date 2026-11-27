import React, { useState, useRef } from 'react';
import { X, Camera, Image as ImageIcon, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { compressImageFile } from '../../utils/telegramHelpers';

interface NewStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const makeStoryTemplateDataUrl = (c1: string, c2: string, accent: string, shape: 'waves' | 'orbs' | 'grid') => {
  const deco =
    shape === 'waves'
      ? `<path d="M0 440 Q 180 370 360 430 T 720 400 L 720 640 L 0 640 Z" fill="${accent}" fill-opacity="0.24"/><path d="M0 500 Q 200 440 420 510 T 720 470 L 720 640 L 0 640 Z" fill="#ffffff" fill-opacity="0.12"/>`
      : shape === 'orbs'
      ? `<circle cx="560" cy="180" r="190" fill="${accent}" fill-opacity="0.28"/><circle cx="140" cy="520" r="220" fill="#ffffff" fill-opacity="0.14"/>`
      : `<rect x="80" y="140" width="560" height="360" rx="48" fill="${accent}" fill-opacity="0.18" stroke="#ffffff" stroke-opacity="0.2" stroke-width="4"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 640"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="720" height="640" fill="url(#g)"/>${deco}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const STORY_TEMPLATES = [
  makeStoryTemplateDataUrl('#1e3a8a', '#3390ec', '#38bdf8', 'waves'),
  makeStoryTemplateDataUrl('#6d28d9', '#ec4899', '#fbbf24', 'orbs'),
  makeStoryTemplateDataUrl('#065f46', '#0d9488', '#34d399', 'grid'),
];

export const NewStoryModal: React.FC<NewStoryModalProps> = ({ isOpen, onClose }) => {
  const { theme } = useAuth();
  const { addStory } = useChat();

  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const compressed = await compressImageFile(file, 900, 0.78);
      setImageUrl(compressed);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePublish = () => {
    const finalUrl = imageUrl || STORY_TEMPLATES[0];
    addStory(finalUrl, caption.trim());
    setImageUrl('');
    setCaption('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-xs select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border text-right transition-all max-h-[92vh] overflow-y-auto tg-sheet-up ${
          theme === 'light'
            ? 'bg-white border-gray-200 text-gray-900'
            : 'bg-[#17212b] border-white/[0.08] text-white'
        }`}
      >
        <div className="sm:hidden flex justify-center -mt-2 mb-3">
          <div className="w-10 h-1 rounded-full bg-slate-400/40" />
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#3390ec]" />
            <span>نشر قصة جديدة</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#7f91a4] hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFile}
          accept="image/*"
          className="hidden"
        />

        {/* Image Preview Box */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-52 rounded-2xl border-2 border-dashed border-[#3390ec]/40 hover:border-[#3390ec] cursor-pointer flex flex-col items-center justify-center overflow-hidden mb-4 bg-black/10 relative transition-colors"
        >
          {imageUrl ? (
            <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-[#7f91a4]">
              <ImageIcon className="w-10 h-10 text-[#3390ec]" />
              <span className="text-xs font-medium">اضغط لاختيار صورة من جهازك</span>
            </div>
          )}
        </div>

        {/* Or Quick Pick Local Artistic Gradients */}
        <div className="mb-4">
          <span className="text-[11px] text-[#7f91a4] block mb-1.5">أو اختر خلفية جاهزة للقصة:</span>
          <div className="grid grid-cols-3 gap-2">
            {STORY_TEMPLATES.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`قالب ${i + 1}`}
                onClick={() => setImageUrl(url)}
                className={`h-16 w-full object-cover rounded-xl cursor-pointer border-2 transition-transform hover:scale-105 ${
                  imageUrl === url ? 'border-[#3390ec]' : 'border-transparent'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Caption */}
        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1.5 opacity-80">نص توضيحي للقصة</label>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="اكتب تعليقاً على القصة..."
            className={`w-full px-3.5 py-2.5 text-xs rounded-xl outline-hidden border ${
              theme === 'light'
                ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#3390ec]'
                : 'bg-[#242f3d] border-white/[0.08] text-white focus:border-[#3390ec]'
            }`}
          />
        </div>

        <button
          type="button"
          onClick={handlePublish}
          className="w-full py-3 rounded-xl bg-[#3390ec] hover:bg-[#2a7fd4] text-white font-bold text-xs shadow-md transition-all hover:scale-[1.01] flex items-center justify-center gap-2 cursor-pointer"
        >
          <Send className="w-4 h-4 ml-0.5" />
          <span>مشاركة القصة الآن</span>
        </button>
      </div>
    </div>
  );
};
