import React, { useState, useRef, useEffect } from 'react';
import { X, Settings, Check, Palette, Type, Camera, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ChatWallpaper } from '../../types/telegram';
import { compressImageFile, getAvatarGradient, getInitials } from '../../utils/telegramHelpers';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    theme,
    userProfile,
    updateUserProfile,
    wallpaper,
    setWallpaper,
    fontSize,
    setFontSize,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'appearance'>('profile');
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && userProfile) {
      setDisplayName(userProfile.displayName || '');
      setBio(userProfile.bio || '');
      setPhone(userProfile.phone || '');
      setPhotoURL(userProfile.photoURL || '');
    }
  }, [isOpen, userProfile]);

  if (!isOpen) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const compressed = await compressImageFile(file, 280, 0.8);
      setPhotoURL(compressed);
    } catch (err) {
      console.error('Failed to compress profile image:', err);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUserProfile({
      displayName: displayName.trim() || userProfile?.displayName,
      bio: bio.trim(),
      phone: phone.trim(),
      photoURL: photoURL.trim(),
    });
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 800);
  };

  const wallpapersList: { id: ChatWallpaper; label: string; bg: string }[] = [
    { id: 'classic', label: 'كلاسيكي (Doodle)', bg: 'bg-[#2b5278]' },
    { id: 'night', label: 'سماء ليلية', bg: 'bg-[#090d13]' },
    { id: 'emerald', label: 'غابة الزمرد', bg: 'bg-[#091e17]' },
    { id: 'purple', label: 'ليلة بنفسجية', bg: 'bg-[#1b1028]' },
    { id: 'desert', label: 'رمال ذهبية', bg: 'bg-[#241607]' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none">
      <div
        className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border text-right transition-all max-h-[90vh] overflow-y-auto ${
          theme === 'light'
            ? 'bg-white border-gray-200 text-gray-900'
            : 'bg-[#17212b] border-[#2b3a4a] text-white'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#2481cc]" />
            <span>إعدادات JanaX</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#7f91a4] hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 text-xs font-semibold mb-4">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'text-[#2481cc] border-b-2 border-[#2481cc]'
                : 'text-[#7f91a4] hover:text-white'
            }`}
          >
            الملف الشخصي
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
              activeTab === 'appearance'
                ? 'text-[#2481cc] border-b-2 border-[#2481cc]'
                : 'text-[#7f91a4] hover:text-white'
            }`}
          >
            المظهر والخلفيات
          </button>
        </div>

        {activeTab === 'appearance' ? (
          <div className="space-y-5">
            <div>
              <label className="text-xs font-semibold mb-2 block flex items-center gap-1.5 opacity-90">
                <Palette className="w-4 h-4 text-[#2481cc]" />
                <span>خلفية المحادثة</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {wallpapersList.map((wp) => (
                  <button
                    key={wp.id}
                    onClick={() => setWallpaper(wp.id)}
                    className={`p-3 rounded-2xl border text-right flex items-center gap-2.5 transition-all cursor-pointer ${
                      wallpaper === wp.id
                        ? 'border-[#2481cc] ring-2 ring-[#2481cc]/30 bg-[#2481cc]/10'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full shrink-0 shadow-xs ${wp.bg}`} />
                    <span className="text-xs font-medium">{wp.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold mb-2 block flex items-center gap-1.5 opacity-90">
                <Type className="w-4 h-4 text-[#2481cc]" />
                <span>حجم خط المحادثات</span>
              </label>
              <div className="flex items-center gap-2">
                {(['small', 'medium', 'large'] as const).map((fs) => (
                  <button
                    key={fs}
                    onClick={() => setFontSize(fs)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                      fontSize === fs
                        ? 'border-[#2481cc] bg-[#2481cc] text-white shadow-xs'
                        : 'border-white/10 text-[#7f91a4] hover:text-white'
                    }`}
                  >
                    {fs === 'small' ? 'صغير' : fs === 'medium' ? 'متوسط' : 'كبير'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 mt-2 rounded-xl bg-[#2481cc] text-white font-bold text-xs shadow-md transition-all hover:scale-[1.01] cursor-pointer"
            >
              حفظ وتطبيق المظهر
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Interactive Profile Photo Picker */}
            <div className="flex flex-col items-center gap-2 pb-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <div className="relative group">
                <div
                  onClick={() => avatarInputRef.current?.click()}
                  className={`w-24 h-24 rounded-full flex items-center justify-center font-bold text-2xl text-white shadow-lg overflow-hidden cursor-pointer bg-gradient-to-tr ${getAvatarGradient(
                    userProfile?.uid || ''
                  )}`}
                >
                  {photoURL ? (
                    <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span>{getInitials(displayName || userProfile?.displayName)}</span>
                  )}
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>
                {photoURL && (
                  <button
                    type="button"
                    onClick={() => setPhotoURL('')}
                    className="absolute -bottom-1 -left-1 p-1.5 rounded-full bg-red-600 text-white shadow-md hover:bg-red-700 cursor-pointer"
                    title="حذف الصورة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="text-xs font-semibold text-[#2481cc] hover:underline cursor-pointer"
              >
                {isUploading ? 'جاري معالجة الصورة...' : 'تغيير صورة البروفايل من الجهاز'}
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 opacity-80">الاسم الظاهر</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl outline-hidden border ${
                  theme === 'light'
                    ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#2481cc]'
                    : 'bg-[#242f3d] border-[#2b3a4a] text-white focus:border-[#2481cc]'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 opacity-80">اسم المستخدم</label>
              <input
                type="text"
                disabled
                value={`@${userProfile?.username || ''}`}
                dir="ltr"
                className={`w-full px-3.5 py-2 text-sm rounded-xl outline-hidden border font-mono opacity-60 cursor-not-allowed ${
                  theme === 'light'
                    ? 'bg-gray-100 border-gray-200 text-gray-700'
                    : 'bg-[#1e2a38] border-[#2b3a4a] text-gray-300'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 opacity-80">رقم الهاتف</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
                placeholder="+966 50 123 4567"
                className={`w-full px-3.5 py-2 text-sm rounded-xl outline-hidden border ${
                  theme === 'light'
                    ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#2481cc]'
                    : 'bg-[#242f3d] border-[#2b3a4a] text-white focus:border-[#2481cc]'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 opacity-80">
                النبذة التعريفية (Bio)
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="اكتب نبذة عنك..."
                className={`w-full px-3.5 py-2 text-sm rounded-xl outline-hidden border resize-none ${
                  theme === 'light'
                    ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#2481cc]'
                    : 'bg-[#242f3d] border-[#2b3a4a] text-white focus:border-[#2481cc]'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={isUploading}
              className="w-full py-2.5 mt-2 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>تم حفظ التعديلات في السحابة!</span>
                </>
              ) : (
                <span>حفظ التعديلات</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
