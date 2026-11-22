import React, { useMemo, useRef, useState } from 'react';
import { Clock, FolderHeart, Plus, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { StickerItem } from '../../types/telegram';
import { ALL_BUILTIN_STICKERS, STICKER_PACKS } from '../../utils/stickers';

export interface SelectableSticker {
  id: string;
  emoji: string;
  name: string;
  label: string;
  url: string;
  isCustom?: boolean;
}

interface StickerPickerProps {
  onSelectSticker: (sticker: SelectableSticker) => Promise<void> | void;
}

type CategoryKey = 'recent' | 'custom' | string;

export const StickerPicker: React.FC<StickerPickerProps> = ({ onSelectSticker }) => {
  const { theme } = useAuth();
  const { userStickers, saveCustomSticker, deleteCustomSticker } = useChat();

  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>(
    () => STICKER_PACKS[0]?.id || 'greetings'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [brokenImageIds, setBrokenImageIds] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const recentStickers = useMemo<StickerItem[]>(() => {
    return userStickers
      .filter((s) => s.useCount > 0)
      .map((s) => ({
        id: s.id,
        packId: 'recent',
        emoji: s.emoji,
        name: s.name,
        label: s.label,
        url: s.url,
        isCustom: s.isCustom,
      }));
  }, [userStickers]);

  const customStickers = useMemo<StickerItem[]>(() => {
    return userStickers
      .filter((s) => s.isCustom)
      .map((s) => ({
        id: s.id,
        packId: 'custom',
        emoji: s.emoji,
        name: s.name,
        label: s.label,
        url: s.url,
        isCustom: true,
      }));
  }, [userStickers]);

  const searchablePool = useMemo<StickerItem[]>(() => {
    const byId = new Map<string, StickerItem>();
    customStickers.forEach((s) => byId.set(s.id, s));
    ALL_BUILTIN_STICKERS.forEach((s) => {
      if (!byId.has(s.id)) byId.set(s.id, s);
    });
    return Array.from(byId.values());
  }, [customStickers]);

  const visibleStickers = useMemo<StickerItem[]>(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (trimmed) {
      return searchablePool.filter((s) => {
        if (s.label.toLowerCase().includes(trimmed)) return true;
        if (s.name.toLowerCase().includes(trimmed)) return true;
        if (s.emoji.includes(trimmed)) return true;
        if (s.keywords?.some((kw) => kw.toLowerCase().includes(trimmed))) return true;
        return false;
      });
    }

    if (selectedCategory === 'recent') return recentStickers;
    if (selectedCategory === 'custom') return customStickers;
    const pack = STICKER_PACKS.find((p) => p.id === selectedCategory);
    return pack ? pack.stickers : STICKER_PACKS[0]?.stickers || [];
  }, [searchQuery, searchablePool, selectedCategory, recentStickers, customStickers]);

  const handleStickerClick = async (sticker: StickerItem) => {
    if (sendingId) return;
    setErrorMsg(null);
    setSendingId(sticker.id);
    try {
      await onSelectSticker({
        id: sticker.id,
        emoji: sticker.emoji,
        name: sticker.name,
        label: sticker.label,
        url: sticker.url,
        isCustom: sticker.isCustom,
      });
    } catch {
      setErrorMsg('تعذر إرسال الملصق، يرجى المحاولة مرة أخرى');
    } finally {
      setSendingId(null);
    }
  };

  const handleUploadSticker = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setErrorMsg(null);
    setIsUploading(true);
    try {
      await saveCustomSticker(file);
      setSearchQuery('');
      setSelectedCategory('custom');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر حفظ الملصق المخصص'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteCustom = async (e: React.MouseEvent, stickerId: string) => {
    e.stopPropagation();
    if (deletingId) return;
    setErrorMsg(null);
    setDeletingId(stickerId);
    try {
      await deleteCustomSticker(stickerId);
    } catch {
      setErrorMsg('تعذر حذف الملصق');
    } finally {
      setDeletingId(null);
    }
  };

  const activeCategoryTitle = useMemo(() => {
    if (searchQuery.trim()) return `نتائج البحث (${visibleStickers.length})`;
    if (selectedCategory === 'recent') return 'المستخدمة مؤخراً';
    if (selectedCategory === 'custom') return 'ملصقاتي المخصصة';
    return STICKER_PACKS.find((p) => p.id === selectedCategory)?.title || 'الملصقات';
  }, [searchQuery, visibleStickers.length, selectedCategory]);

  return (
    <div className="flex flex-col select-none">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUploadSticker}
        className="hidden"
      />

      {/* Search & Custom Sticker Upload Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <div
          className={`flex-1 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 border transition-colors focus-within:border-[#2481cc] ${
            theme === 'light'
              ? 'bg-gray-100 border-gray-200 text-gray-900'
              : 'bg-[#242f3d] border-[#2b3a4a] text-white'
          }`}
        >
          <Search className="w-3.5 h-3.5 text-[#7f91a4] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن ملصق..."
            aria-label="البحث عن ملصق"
            className="flex-1 min-w-0 bg-transparent text-xs focus:outline-none placeholder:text-[#7f91a4]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-0.5 text-[#7f91a4] hover:text-[#2481cc] transition-colors cursor-pointer"
              aria-label="مسح بحث الملصقات"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={`min-h-[34px] px-2.5 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer disabled:opacity-50 ${
            theme === 'light'
              ? 'bg-[#2481cc]/10 text-[#2481cc] hover:bg-[#2481cc]/20'
              : 'bg-[#2481cc]/20 text-sky-300 hover:bg-[#2481cc]/30'
          }`}
          title="إضافة ملصق مخصص من جهازك"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="whitespace-nowrap">{isUploading ? 'جاري الحفظ...' : 'إضافة'}</span>
        </button>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-rose-500/15 text-rose-400 text-[11px] font-medium flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="p-0.5 hover:opacity-80 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pack Tabs Strip */}
      {!searchQuery.trim() && (
        <div
          className={`flex items-center gap-1 pb-2 mb-2 overflow-x-auto border-b ${
            theme === 'light' ? 'border-gray-100' : 'border-white/10'
          }`}
        >
          <button
            type="button"
            onClick={() => setSelectedCategory('recent')}
            className={`min-h-[36px] min-w-[36px] px-2.5 py-1 rounded-lg text-xs font-medium flex items-center justify-center gap-1 shrink-0 transition-colors cursor-pointer ${
              selectedCategory === 'recent'
                ? 'bg-[#2481cc] text-white shadow-xs'
                : theme === 'light'
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-[#8ea0b5] hover:bg-white/10 hover:text-white'
            }`}
            title="المستخدمة مؤخراً"
            aria-label="الملصقات المستخدمة مؤخراً"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('custom')}
            className={`min-h-[36px] min-w-[36px] px-2.5 py-1 rounded-lg text-xs font-medium flex items-center justify-center gap-1 shrink-0 transition-colors cursor-pointer ${
              selectedCategory === 'custom'
                ? 'bg-[#2481cc] text-white shadow-xs'
                : theme === 'light'
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-[#8ea0b5] hover:bg-white/10 hover:text-white'
            }`}
            title="ملصقاتي المخصصة"
            aria-label="ملصقاتي المخصصة"
          >
            <FolderHeart className="w-3.5 h-3.5" />
          </button>

          {STICKER_PACKS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              onClick={() => setSelectedCategory(pack.id)}
              className={`min-h-[36px] min-w-[36px] px-2.5 py-1 rounded-lg text-sm flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                selectedCategory === pack.id
                  ? 'bg-[#2481cc] text-white shadow-xs'
                  : theme === 'light'
                  ? 'hover:bg-gray-100'
                  : 'hover:bg-white/10'
              }`}
              title={pack.title}
              aria-label={pack.title}
            >
              <span>{pack.icon}</span>
            </button>
          ))}
        </div>
      )}

      {/* Active Pack Header */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <span
          className={`text-[11px] font-semibold ${
            theme === 'light' ? 'text-gray-500' : 'text-[#8ea0b5]'
          }`}
        >
          {activeCategoryTitle}
        </span>
        {selectedCategory === 'custom' && !searchQuery.trim() && customStickers.length > 0 && (
          <span className="text-[11px] tabular-nums text-[#7f91a4]">
            {customStickers.length} ملصق
          </span>
        )}
      </div>

      {/* Stickers Grid */}
      <div className="max-h-52 overflow-y-auto pr-0.5">
        {visibleStickers.length === 0 ? (
          <div className="py-6 px-3 text-center flex flex-col items-center justify-center gap-2">
            <p
              className={`text-xs ${
                theme === 'light' ? 'text-gray-500' : 'text-[#8ea0b5]'
              }`}
            >
              {searchQuery.trim()
                ? 'لا توجد ملصقات مطابقة لبحثك'
                : selectedCategory === 'recent'
                ? 'لم ترسل أي ملصق بعد، ستظهر ملصقاتك الأخيرة هنا'
                : 'لا توجد ملصقات مخصصة بعد'}
            </p>
            {selectedCategory === 'custom' && !searchQuery.trim() && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-[#2481cc] hover:bg-[#1e6fb1] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                + رفع أول ملصق مخصص
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {visibleStickers.map((sticker) => {
              const isSending = sendingId === sticker.id;
              const isBroken = brokenImageIds[sticker.id];
              return (
                <div key={sticker.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => handleStickerClick(sticker)}
                    disabled={Boolean(sendingId)}
                    aria-label={`إرسال ملصق ${sticker.label}`}
                    className={`w-full p-1.5 rounded-xl flex flex-col items-center gap-1 transition-all duration-150 cursor-pointer disabled:opacity-60 ${
                      theme === 'light'
                        ? 'hover:bg-gray-100 active:scale-95'
                        : 'hover:bg-white/10 active:scale-95'
                    }`}
                  >
                    <div className="relative w-16 h-16 flex items-center justify-center">
                      {isBroken ? (
                        <div
                          className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${
                            theme === 'light' ? 'bg-gray-100' : 'bg-[#242f3d]'
                          }`}
                        >
                          {sticker.emoji || '🎨'}
                        </div>
                      ) : (
                        <img
                          src={sticker.url}
                          alt={sticker.label}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenImageIds((prev) => ({ ...prev, [sticker.id]: true }))
                          }
                          className={`w-16 h-16 ${
                            sticker.isCustom ? 'object-cover rounded-xl shadow-xs' : 'object-contain'
                          } transition-transform duration-150 group-hover:scale-105`}
                        />
                      )}

                      {isSending && (
                        <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>

                    <span
                      className={`text-[10px] font-medium truncate w-full text-center ${
                        theme === 'light' ? 'text-gray-600' : 'text-gray-300'
                      }`}
                    >
                      {sticker.label}
                    </span>
                  </button>

                  {sticker.isCustom && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteCustom(e, sticker.id)}
                      disabled={deletingId === sticker.id}
                      title="حذف الملصق"
                      aria-label={`حذف ملصق ${sticker.label}`}
                      className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/65 hover:bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
