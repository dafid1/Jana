import React, { useEffect } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

export const MediaViewerModal: React.FC = () => {
  const { activeMediaUrl, setActiveMediaUrl } = useChat();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveMediaUrl(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!activeMediaUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md select-none animate-in fade-in duration-150"
      onClick={() => setActiveMediaUrl(null)}
    >
      {/* Top Toolbar */}
      <div
        className="absolute top-4 inset-x-4 flex items-center justify-between text-white z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs font-medium opacity-80">معاينة الصورة بالحجم الكامل</div>
        <div className="flex items-center gap-2">
          <a
            href={activeMediaUrl}
            download="telegram_image.png"
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-full bg-black/50 hover:bg-white/20 transition-colors text-white"
            title="تحميل"
          >
            <Download className="w-5 h-5" />
          </a>
          <button
            onClick={() => setActiveMediaUrl(null)}
            className="p-2 rounded-full bg-black/50 hover:bg-white/20 transition-colors text-white"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image */}
      <div
        className="max-w-[90vw] max-h-[85vh] flex items-center justify-center p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={activeMediaUrl}
          alt="Enlarged Media"
          className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl transition-transform"
        />
      </div>
    </div>
  );
};
