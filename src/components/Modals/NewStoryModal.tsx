import React, { useState, useRef } from 'react';
import { X, Camera, Image as ImageIcon, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

interface NewStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewStoryModal: React.FC<NewStoryModalProps> = ({ isOpen, onClose }) => {
  const { theme } = useAuth();
  const { addStory } = useChat();

  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const samplePhotos = [
    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
  ];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePublish = () => {
    const finalUrl = imageUrl || samplePhotos[0];
    addStory(finalUrl, caption.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none">
      <div
        className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border text-right transition-all ${
          theme === 'light'
            ? 'bg-white border-gray-200 text-gray-900'
            : 'bg-[#17212b] border-[#2b3a4a] text-white'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#2481cc]" />
            <span>نشر قصة جديدة (Story)</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#7f91a4] hover:text-white hover:bg-white/10"
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
          className="w-full h-56 rounded-2xl border-2 border-dashed border-[#2481cc]/40 hover:border-[#2481cc] cursor-pointer flex flex-col items-center justify-center overflow-hidden mb-4 bg-black/10 relative transition-colors"
        >
          {imageUrl ? (
            <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-[#7f91a4]">
              <ImageIcon className="w-10 h-10 text-[#2481cc]" />
              <span className="text-xs font-medium">اضغط لاختيار صورة من جهازك</span>
            </div>
          )}
        </div>

        {/* Or Quick Pick Samples */}
        <div className="mb-4">
          <span className="text-[11px] text-[#7f91a4] block mb-1.5">أو اختر صورة جاهزة:</span>
          <div className="grid grid-cols-3 gap-2">
            {samplePhotos.map((url, i) => (
              <img
                key={i}
                src={url}
                alt="Sample"
                onClick={() => setImageUrl(url)}
                className={`h-16 w-full object-cover rounded-xl cursor-pointer border-2 transition-transform hover:scale-105 ${
                  imageUrl === url ? 'border-[#2481cc]' : 'border-transparent'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Caption */}
        <div className="mb-4">
          <label className="block text-xs font-semibold mb-1 opacity-80">نص توضيحي للقصة</label>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="اكتب تعليقاً على القصة..."
            className={`w-full px-3.5 py-2.5 text-xs rounded-xl outline-hidden border ${
              theme === 'light'
                ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#2481cc]'
                : 'bg-[#242f3d] border-[#2b3a4a] text-white focus:border-[#2481cc]'
            }`}
          />
        </div>

        <button
          onClick={handlePublish}
          className="w-full py-2.5 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white font-bold text-xs shadow-md transition-all hover:scale-[1.01] flex items-center justify-center gap-2 cursor-pointer"
        >
          <Send className="w-4 h-4 ml-0.5" />
          <span>مشاركة القصة الآن</span>
        </button>
      </div>
    </div>
  );
};
