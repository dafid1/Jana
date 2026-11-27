import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowRight,
  Check,
  Palette,
  Type,
  Camera,
  Trash2,
  ShieldCheck,
  Lock,
  EyeOff,
  Bell,
  Ban,
  User,
  ChevronLeft,
  Moon,
  Sun,
  AtSign,
  Phone,
  Info,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ChatWallpaper } from '../../types/telegram';
import { compressImageFile, getAvatarGradient, getInitials } from '../../utils/telegramHelpers';
import { requestSystemNotificationPermission } from '../../utils/vaultBridge';
import { useBackHandler } from '../../utils/androidBackNavigation';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsSection = 'root' | 'profile' | 'appearance' | 'privacy';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    theme,
    toggleTheme,
    userProfile,
    usersMap,
    updateUserProfile,
    updatePrivacySettings,
    toggleBlockUser,
    wallpaper,
    setWallpaper,
    fontSize,
    setFontSize,
  } = useAuth();

  const [section, setSection] = useState<SettingsSection>('root');
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && userProfile) {
      setDisplayName(userProfile.displayName || '');
      setBio(userProfile.bio || '');
      setPhone(userProfile.phone || '');
      setPhotoURL(userProfile.photoURL || '');
      setNotifFeedback(null);
      setIsSaved(false);
    }
    if (!isOpen) {
      setSection('root');
    }
  }, [isOpen, userProfile]);

  useBackHandler(
    isOpen && section !== 'root',
    () => setSection('root'),
    74
  );

  if (!isOpen) return null;

  const isLight = theme === 'light';

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const compressed = await compressImageFile(file, 280, 0.8);
      setPhotoURL(compressed);
      await updateUserProfile({ photoURL: compressed });
    } catch (err) {
      console.error('Failed to compress profile image:', err);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmitProfile = async (e: React.FormEvent) => {
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
      setSection('root');
    }, 650);
  };

  const wallpapersList: { id: ChatWallpaper; label: string; bg: string }[] = [
    { id: 'classic', label: 'كلاسيكي (Doodle)', bg: 'bg-[#2b5278]' },
    { id: 'night', label: 'سماء ليلية', bg: 'bg-[#090d13]' },
    { id: 'emerald', label: 'غابة الزمرد', bg: 'bg-[#091e17]' },
    { id: 'purple', label: 'ليلة بنفسجية', bg: 'bg-[#1b1028]' },
    { id: 'desert', label: 'رمال ذهبية', bg: 'bg-[#241607]' },
  ];

  const autoLockOptions: { value: number; label: string }[] = [
    { value: 0, label: 'فوراً عند الخروج' },
    { value: 30, label: '30 ثانية' },
    { value: 60, label: 'دقيقة واحدة' },
    { value: 300, label: '5 دقائق' },
    { value: -1, label: 'معطّل' },
  ];

  const currentAutoLock =
    typeof userProfile?.autoLockSeconds === 'number' ? userProfile.autoLockSeconds : 30;
  const screenSecurityEnabled = userProfile?.screenSecurityEnabled !== false;
  const hideLastSeen = Boolean(userProfile?.privacyHideLastSeen);
  const discreetNotifications = userProfile?.discreetNotifications !== false;
  const blockedIds = userProfile?.blockedUserIds || [];

  const handlePrivacyChange = async (
    patch: Parameters<typeof updatePrivacySettings>[0]
  ) => {
    setSavingPrivacy(true);
    try {
      await updatePrivacySettings(patch);
    } finally {
      setSavingPrivacy(false);
    }
  };

  const sectionTitle =
    section === 'profile'
      ? 'تعديل الملف الشخصي'
      : section === 'appearance'
      ? 'إعدادات المظهر والمحادثات'
      : section === 'privacy'
      ? 'الخصوصية والأمان'
      : 'الإعدادات';

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col select-none tg-slide-in ${
        isLight ? 'bg-[#f0f2f5] text-slate-900' : 'bg-[#0e1621] text-white'
      }`}
    >
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarUpload}
        className="hidden"
      />

      {/* Telegram Full-Screen Top App Bar */}
      <header
        className={`h-14 px-2 sm:px-4 flex items-center justify-between gap-2 border-b shrink-0 ${
          isLight
            ? 'bg-[#3390ec] border-[#287cd1] text-white'
            : 'bg-[#17212b] border-[#0e1621] text-white'
        }`}
      >
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (section !== 'root') {
                setSection('root');
              } else {
                onClose();
              }
            }}
            aria-label={section !== 'root' ? 'رجوع' : 'إغلاق الإعدادات'}
            className="min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold truncate">{sectionTitle}</h2>
        </div>

        {section === 'root' && (
          <button
            type="button"
            onClick={() => setSection('profile')}
            className="px-3 py-1.5 rounded-full text-xs font-bold hover:bg-white/15 transition-colors cursor-pointer"
          >
            تعديل
          </button>
        )}
      </header>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full pb-12">
          {section === 'root' && (
            <>
              {/* Telegram Collapsible-Style Profile Banner */}
              <div
                className={`px-5 py-6 flex items-center gap-4 border-b relative ${
                  isLight
                    ? 'bg-[#3390ec] text-white border-[#287cd1]'
                    : 'bg-[#17212b] text-white border-[#0e1621]'
                }`}
              >
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className={`w-18 h-18 rounded-full flex items-center justify-center font-bold text-2xl text-white shadow-lg ring-2 ring-white/25 overflow-hidden cursor-pointer bg-gradient-to-tr ${getAvatarGradient(
                      userProfile?.uid || ''
                    )}`}
                    title="تغيير صورة البروفايل"
                  >
                    {photoURL ? (
                      <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span>{getInitials(displayName || userProfile?.displayName)}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className={`absolute -bottom-1 -left-1 w-8 h-8 rounded-full flex items-center justify-center shadow-md cursor-pointer border-2 ${
                      isLight
                        ? 'bg-white text-[#3390ec] border-[#3390ec]'
                        : 'bg-[#3390ec] text-white border-[#17212b]'
                    }`}
                    title="تعيين صورة جديدة"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-extrabold truncate">
                    {userProfile?.displayName || 'مستخدم JanaX'}
                  </h3>
                  <p className="text-xs text-white/80 mt-0.5">
                    {isUploading ? 'جاري تحديث الصورة...' : 'متصل الآن'}
                  </p>
                </div>
              </div>

              {/* Account Info Block */}
              <section
                className={`mt-3 border-y divide-y ${
                  isLight
                    ? 'bg-white border-slate-200/80 divide-slate-100'
                    : 'bg-[#17212b] border-white/[0.05] divide-white/[0.05]'
                }`}
              >
                <div className="px-5 py-2.5 text-xs font-bold text-[#3390ec]">الحساب</div>

                <button
                  type="button"
                  onClick={() => setSection('profile')}
                  className={`w-full px-5 py-3 flex items-center gap-4 text-right transition-colors cursor-pointer ${
                    isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <Phone className="w-5 h-5 text-[#7f91a4] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium font-mono" dir="ltr">
                      {userProfile?.phone || 'غير مضاف'}
                    </div>
                    <div className="text-xs text-[#7f91a4] mt-0.5">اضغط لتغيير رقم الهاتف</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSection('profile')}
                  className={`w-full px-5 py-3 flex items-center gap-4 text-right transition-colors cursor-pointer ${
                    isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <AtSign className="w-5 h-5 text-[#7f91a4] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium font-mono text-[#3390ec]" dir="ltr">
                      @{userProfile?.username || 'user'}
                    </div>
                    <div className="text-xs text-[#7f91a4] mt-0.5">اسم المستخدم</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSection('profile')}
                  className={`w-full px-5 py-3 flex items-center gap-4 text-right transition-colors cursor-pointer ${
                    isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <Info className="w-5 h-5 text-[#7f91a4] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {userProfile?.bio || 'أضف بضع كلمات عنك...'}
                    </div>
                    <div className="text-xs text-[#7f91a4] mt-0.5">النبذة التعريفية</div>
                  </div>
                </button>
              </section>

              {/* Settings Categories Block */}
              <section
                className={`mt-3 border-y divide-y ${
                  isLight
                    ? 'bg-white border-slate-200/80 divide-slate-100'
                    : 'bg-[#17212b] border-white/[0.05] divide-white/[0.05]'
                }`}
              >
                <div className="px-5 py-2.5 text-xs font-bold text-[#3390ec]">الإعدادات</div>

                <button
                  type="button"
                  onClick={() => setSection('profile')}
                  className={`w-full px-5 py-3.5 flex items-center justify-between gap-3 text-right transition-colors cursor-pointer ${
                    isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <User className="w-5 h-5 text-[#3390ec]" />
                    <div>
                      <div className="text-sm font-medium">الملف الشخصي وصورة الحساب</div>
                      <div className="text-xs text-[#7f91a4]">الاسم، الهاتف، والنبذة التعريفية</div>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-[#7f91a4]" />
                </button>

                <button
                  type="button"
                  onClick={() => setSection('appearance')}
                  className={`w-full px-5 py-3.5 flex items-center justify-between gap-3 text-right transition-colors cursor-pointer ${
                    isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <Palette className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="text-sm font-medium">إعدادات المحادثات والمظهر</div>
                      <div className="text-xs text-[#7f91a4]">الخلفيات، الوضع الليلي، وحجم الخط</div>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-[#7f91a4]" />
                </button>

                <button
                  type="button"
                  onClick={() => setSection('privacy')}
                  className={`w-full px-5 py-3.5 flex items-center justify-between gap-3 text-right transition-colors cursor-pointer ${
                    isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <Lock className="w-5 h-5 text-amber-400" />
                    <div>
                      <div className="text-sm font-medium">الخصوصية والأمان وقفل الحاسبة</div>
                      <div className="text-xs text-[#7f91a4]">
                        القفل التلقائي، منع التصوير، وقائمة الحظر ({blockedIds.length})
                      </div>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-[#7f91a4]" />
                </button>

                {/* Quick Dark Mode Toggle */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`w-full px-5 py-3.5 flex items-center justify-between gap-3 text-right transition-colors cursor-pointer ${
                    isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {theme === 'dark' ? (
                      <Moon className="w-5 h-5 text-sky-400" />
                    ) : (
                      <Sun className="w-5 h-5 text-amber-500" />
                    )}
                    <span className="text-sm font-medium">الوضع الليلي</span>
                  </div>
                  <div
                    className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
                      theme === 'dark' ? 'bg-[#3390ec]' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                        theme === 'dark' ? '-translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </button>
              </section>
            </>
          )}

          {section === 'profile' && (
            <form
              onSubmit={handleSubmitProfile}
              className={`mt-3 border-y p-5 space-y-4 ${
                isLight
                  ? 'bg-white border-slate-200/80'
                  : 'bg-[#17212b] border-white/[0.05]'
              }`}
            >
              <div className="flex flex-col items-center gap-2 pb-2">
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
                  className="text-xs font-semibold text-[#3390ec] hover:underline cursor-pointer"
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
                  className={`w-full px-3.5 py-2.5 text-sm rounded-xl outline-hidden border transition-colors ${
                    isLight
                      ? 'bg-slate-50 border-slate-200/80 text-slate-900 focus:bg-white focus:border-[#3390ec]'
                      : 'bg-[#242f3d] border-white/[0.07] text-white focus:border-[#3390ec]'
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
                    isLight
                      ? 'bg-slate-100 border-slate-200/80 text-slate-700'
                      : 'bg-[#1b2733] border-white/[0.06] text-slate-300'
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
                  className={`w-full px-3.5 py-2 text-sm rounded-xl outline-hidden border transition-colors ${
                    isLight
                      ? 'bg-slate-50 border-slate-200/80 text-slate-900 focus:bg-white focus:border-[#3390ec]'
                      : 'bg-[#242f3d] border-white/[0.07] text-white focus:border-[#3390ec]'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 opacity-80">
                  النبذة التعريفية (Bio)
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="اكتب نبذة عنك..."
                  className={`w-full px-3.5 py-2 text-sm rounded-xl outline-hidden border resize-none transition-colors ${
                    isLight
                      ? 'bg-slate-50 border-slate-200/80 text-slate-900 focus:bg-white focus:border-[#3390ec]'
                      : 'bg-[#242f3d] border-white/[0.07] text-white focus:border-[#3390ec]'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={isUploading}
                className="w-full py-3 rounded-xl bg-[#3390ec] hover:bg-[#2a7fd4] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaved ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>تم حفظ التعديلات!</span>
                  </>
                ) : (
                  <span>حفظ التغييرات</span>
                )}
              </button>
            </form>
          )}

          {section === 'appearance' && (
            <div className="space-y-3 mt-3">
              <section
                className={`border-y p-5 space-y-4 ${
                  isLight
                    ? 'bg-white border-slate-200/80'
                    : 'bg-[#17212b] border-white/[0.05]'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-[#3390ec]">
                  <Sparkles className="w-4 h-4" />
                  <span>خلفية المحادثة</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {wallpapersList.map((wp) => (
                    <button
                      type="button"
                      key={wp.id}
                      onClick={() => setWallpaper(wp.id)}
                      className={`p-3 rounded-2xl border text-right flex items-center gap-2.5 transition-all cursor-pointer ${
                        wallpaper === wp.id
                          ? 'border-[#3390ec] ring-2 ring-[#3390ec]/25 bg-[#3390ec]/10'
                          : isLight
                          ? 'border-slate-200/80 hover:border-slate-300 hover:bg-slate-50'
                          : 'border-white/[0.07] hover:border-white/20 hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full shrink-0 shadow-xs ${wp.bg}`} />
                      <span className="text-xs font-medium">{wp.label}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section
                className={`border-y p-5 space-y-3 ${
                  isLight
                    ? 'bg-white border-slate-200/80'
                    : 'bg-[#17212b] border-white/[0.05]'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-[#3390ec]">
                  <Type className="w-4 h-4" />
                  <span>حجم خط الرسائل</span>
                </div>
                <div className="flex items-center gap-2">
                  {(['small', 'medium', 'large'] as const).map((fs) => (
                    <button
                      type="button"
                      key={fs}
                      onClick={() => setFontSize(fs)}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                        fontSize === fs
                          ? 'border-[#3390ec] bg-[#3390ec] text-white shadow-xs'
                          : isLight
                          ? 'border-slate-200/80 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          : 'border-white/[0.07] text-[#8ea0b5] hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      {fs === 'small' ? 'صغير' : fs === 'medium' ? 'متوسط' : 'كبير'}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {section === 'privacy' && (
            <div className="space-y-3 mt-3">
              {/* Auto-lock timeout */}
              <section
                className={`border-y p-5 space-y-3 ${
                  isLight
                    ? 'bg-white border-slate-200/80'
                    : 'bg-[#17212b] border-white/[0.05]'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-[#3390ec]">
                  <Lock className="w-4 h-4" />
                  <span>القفل التلقائي (العودة للآلة الحاسبة)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {autoLockOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={savingPrivacy}
                      onClick={() => handlePrivacyChange({ autoLockSeconds: opt.value })}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        currentAutoLock === opt.value
                          ? 'bg-[#3390ec] border-[#3390ec] text-white'
                          : isLight
                          ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          : 'bg-[#242f3d] border-white/[0.08] text-[#8ea0b5] hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Security & Privacy Toggles */}
              <section
                className={`border-y divide-y ${
                  isLight
                    ? 'bg-white border-slate-200/80 divide-slate-100'
                    : 'bg-[#17212b] border-white/[0.05] divide-white/[0.05]'
                }`}
              >
                <div className="px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <ShieldCheck className="w-5 h-5 text-[#3390ec] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold">حماية الشاشة (منع التصوير)</div>
                      <div className="text-xs text-[#7f91a4] mt-0.5">
                        منع لقطات الشاشة وإخفاء المعاينة في قائمة المهام على أندرويد
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={savingPrivacy}
                    onClick={() =>
                      handlePrivacyChange({ screenSecurityEnabled: !screenSecurityEnabled })
                    }
                    className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                      screenSecurityEnabled ? 'bg-[#3390ec]' : 'bg-gray-500'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                        screenSecurityEnabled ? '-translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <EyeOff className="w-5 h-5 text-[#3390ec] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold">إخفاء آخر ظهور والحالة</div>
                      <div className="text-xs text-[#7f91a4] mt-0.5">
                        إخفاء حالة متصل الآن ووقت آخر نشاط عن الآخرين
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={savingPrivacy}
                    onClick={() => handlePrivacyChange({ privacyHideLastSeen: !hideLastSeen })}
                    className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                      hideLastSeen ? 'bg-[#3390ec]' : 'bg-gray-500'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                        hideLastSeen ? '-translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <Bell className="w-5 h-5 text-[#3390ec] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold">الإشعارات المموهة الآمنة</div>
                      <div className="text-xs text-[#7f91a4] mt-0.5">
                        إظهار الإشعارات بعنوان &quot;حاسبة النظام&quot; دون كشف محتوى الرسالة
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={savingPrivacy}
                    onClick={() =>
                      handlePrivacyChange({ discreetNotifications: !discreetNotifications })
                    }
                    className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                      discreetNotifications ? 'bg-[#3390ec]' : 'bg-gray-500'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                        discreetNotifications ? '-translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="px-5 py-4 space-y-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const granted = await requestSystemNotificationPermission();
                      setNotifFeedback(
                        granted
                          ? 'تم تفعيل إذن الإشعارات بنجاح'
                          : 'يرجى السماح بالإشعارات من إعدادات المتصفح أو النظام'
                      );
                    }}
                    className="w-full py-2.5 rounded-xl bg-[#3390ec]/15 hover:bg-[#3390ec]/25 text-[#3390ec] text-xs font-bold transition-colors cursor-pointer"
                  >
                    تفعيل إذن الإشعارات على هذا الجهاز
                  </button>
                  {notifFeedback && (
                    <p className="text-xs font-semibold text-center text-[#3390ec]">
                      {notifFeedback}
                    </p>
                  )}
                </div>
              </section>

              {/* Blocked Users List */}
              <section
                className={`border-y p-5 space-y-3 ${
                  isLight
                    ? 'bg-white border-slate-200/80'
                    : 'bg-[#17212b] border-white/[0.05]'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-2">
                    <Ban className="w-4 h-4 text-rose-400" />
                    <span>قائمة الحظر</span>
                  </span>
                  <span className="text-xs opacity-70 tabular-nums">{blockedIds.length}</span>
                </div>

                {blockedIds.length === 0 ? (
                  <p className="text-xs text-[#7f91a4]">لا يوجد مستخدمون محظورون حالياً</p>
                ) : (
                  <div className="space-y-2">
                    {blockedIds.map((uid) => {
                      const u = usersMap[uid];
                      return (
                        <div
                          key={uid}
                          className={`flex items-center justify-between gap-2 p-2.5 rounded-xl text-xs ${
                            isLight ? 'bg-slate-50' : 'bg-[#242f3d]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-bold truncate">{u?.displayName || 'مستخدم'}</div>
                            {u?.username && (
                              <div className="text-[11px] opacity-70 font-mono" dir="ltr">
                                @{u.username}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleBlockUser(uid)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold cursor-pointer shrink-0"
                          >
                            إلغاء الحظر
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
