import React, { useEffect, useState } from 'react';
import { X, Download, ZoomIn, ZoomOut, RotateCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { saveImageToGallery } from '../../utils/gallerySaver';

export const MediaViewerModal: React.FC = () => {
  const { activeMediaUrl, setActiveMediaUrl } = useChat();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setSaveFeedback(null);
  }, [activeMediaUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveMediaUrl(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveMediaUrl]);

  if (!activeMediaUrl) return null;

  const handleSaveToGallery = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveFeedback(null);
    try {
      const target = await saveImageToGallery(activeMediaUrl, `JanaX_${Date.now()}`);
      setSaveFeedback({
        text: target === 'gallery' ? 'تم حفظ الصورة في المعرض' : 'تم تنزيل الصورة وحفظها',
        type: 'success',
      });
    } catch (err) {
      setSaveFeedback({
        text: err instanceof Error ? err.message : 'تعذر حفظ الصورة في المعرض',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveFeedback(null), 2800);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md select-none animate-in fade-in duration-150"
      onClick={() => {
        if (zoom === 1) setActiveMediaUrl(null);
      }}
    >
      {/* Telegram Top Toolbar */}
      <div
        className="absolute top-0 inset-x-0 px-4 py-3 bg-gradient-to-b from-black/80 via-black/45 to-transparent flex items-center justify-between text-white z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveMediaUrl(null)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="text-xs font-semibold opacity-90 hidden sm:block">عرض الصورة</div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))))}
            disabled={zoom <= 1}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 transition-colors text-white cursor-pointer"
            title="تصغير"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            onClick={() => setZoom((z) => Math.min(3, Number((z + 0.5).toFixed(1))))}
            disabled={zoom >= 3}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40 transition-colors text-white cursor-pointer"
            title="تكبير"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white cursor-pointer"
            title="تدوير"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleSaveToGallery}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#2481cc] hover:bg-[#2172b5] disabled:opacity-60 transition-colors text-white text-xs font-semibold shadow-md cursor-pointer"
            title="حفظ في المعرض"
          >
            {isSaving ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>حفظ في المعرض</span>
          </button>
        </div>
      </div>

      {/* Main Image */}
      <div
        className="w-full h-full flex items-center justify-center p-4 overflow-hidden"
        onClick={(e) => {
          e.stopPropagation();
          if (zoom === 1) setActiveMediaUrl(null);
        }}
      >
        <img
          src={activeMediaUrl}
          alt="Enlarged Media"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setZoom((z) => (z > 1 ? 1 : 2));
          }}
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
          }}
          className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl transition-transform duration-200 cursor-zoom-in"
        />
      </div>

      {/* Telegram-style Save to Gallery Toast */}
      {saveFeedback && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#1e2a38]/95 border border-white/15 text-white text-xs font-semibold shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {saveFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{saveFeedback.text}</span>
        </div>
      )}
    </div>
  );
};
