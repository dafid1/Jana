import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Settings,
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ChatWallpaper } from '../../types/telegram';
import { compressImageFile, getAvatarGradient, getInitials } from '../../utils/telegramHelpers';
import { requestSystemNotificationPermission } from '../../utils/vaultBridge';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    theme,
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

  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'privacy'>('profile');
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border text-right transition-all max-h-[90vh] overflow-y-auto ${
          theme === 'light'
            ? 'bg-white border-slate-200/80 text-slate-900'
            : 'bg-[#111923] border-white/[0.08] text-white'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#2481cc]" />
            <span>إعدادات JanaX</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              theme === 'light'
                ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                : 'text-[#8ea0b5] hover:text-white hover:bg-white/[0.06]'
            }`}
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          className={`flex border-b text-xs font-semibold mb-4 ${
            theme === 'light' ? 'border-slate-200/80' : 'border-white/[0.07]'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2.5 text-center transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'text-[#2481cc] border-b-2 border-[#2481cc]'
                : theme === 'light'
                ? 'text-slate-500 hover:text-slate-800'
                : 'text-[#8ea0b5] hover:text-white'
            }`}
          >
            الملف الشخصي
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`flex-1 py-2.5 text-center transition-colors cursor-pointer ${
              activeTab === 'appearance'
                ? 'text-[#2481cc] border-b-2 border-[#2481cc]'
                : theme === 'light'
                ? 'text-slate-500 hover:text-slate-800'
                : 'text-[#8ea0b5] hover:text-white'
            }`}
          >
            المظهر والخلفيات
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`flex-1 py-2.5 text-center transition-colors cursor-pointer ${
              activeTab === 'privacy'
                ? 'text-[#2481cc] border-b-2 border-[#2481cc]'
                : theme === 'light'
                ? 'text-slate-500 hover:text-slate-800'
                : 'text-[#8ea0b5] hover:text-white'
            }`}
          >
            الخصوصية والأمان
          </button>
        </div>

        {activeTab === 'appearance' ? (
          <div className="space-y-5">
            <div>
              <label className="text-xs font-semibold mb-2 flex items-center gap-1.5 opacity-90">
                <Palette className="w-4 h-4 text-[#2481cc]" />
                <span>خلفية المحادثة</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {wallpapersList.map((wp) => (
                  <button
                    type="button"
                    key={wp.id}
                    onClick={() => setWallpaper(wp.id)}
                    className={`p-3 rounded-2xl border text-right flex items-center gap-2.5 transition-all cursor-pointer ${
                      wallpaper === wp.id
                        ? 'border-[#2481cc] ring-2 ring-[#2481cc]/25 bg-[#2481cc]/10'
                        : theme === 'light'
                        ? 'border-slate-200/80 hover:border-slate-300 hover:bg-slate-50'
                        : 'border-white/[0.07] hover:border-white/20 hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full shrink-0 shadow-xs ${wp.bg}`} />
                    <span className="text-xs font-medium">{wp.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold mb-2 flex items-center gap-1.5 opacity-90">
                <Type className="w-4 h-4 text-[#2481cc]" />
                <span>حجم خط المحادثات</span>
              </label>
              <div className="flex items-center gap-2">
                {(['small', 'medium', 'large'] as const).map((fs) => (
                  <button
                    type="button"
                    key={fs}
                    onClick={() => setFontSize(fs)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                      fontSize === fs
                        ? 'border-[#2481cc] bg-[#2481cc] text-white shadow-xs'
                        : theme === 'light'
                        ? 'border-slate-200/80 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        : 'border-white/[0.07] text-[#8ea0b5] hover:bg-white/[0.04] hover:text-white'
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
        ) : activeTab === 'privacy' ? (
          <div className="space-y-4">
            {/* Auto-lock timeout */}
            <div
              className={`p-3.5 rounded-2xl border space-y-2.5 ${
                theme === 'light'
                  ? 'bg-slate-50 border-slate-200/80'
                  : 'bg-[#162230] border-white/[0.07]'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                <Lock className="w-4 h-4 text-[#2481cc]" />
                <span>القفل التلقائي (العودة للآلة الحاسبة)</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {autoLockOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={savingPrivacy}
                    onClick={() => handlePrivacyChange({ autoLockSeconds: opt.value })}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                      currentAutoLock === opt.value
                        ? 'bg-[#2481cc] border-[#2481cc] text-white'
                        : theme === 'light'
                        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        : 'bg-[#1a2533] border-white/[0.08] text-[#8ea0b5] hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Security & Privacy Toggles */}
            <div
              className={`p-3.5 rounded-2xl border space-y-3.5 ${
                theme === 'light'
                  ? 'bg-slate-50 border-slate-200/80'
                  : 'bg-[#162230] border-white/[0.07]'
              }`}
            >
              {/* FLAG_SECURE */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-[#2481cc] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-bold">حماية الشاشة (منع التصوير)</div>
                    <div className="text-[11px] opacity-70">
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
                  className={`w-10 h-5.5 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                    screenSecurityEnabled ? 'bg-[#2481cc]' : 'bg-gray-500'
                  }`}
                >
                  <div
                    className={`w-4.5 h-4.5 rounded-full bg-white shadow-xs transform transition-transform ${
                      screenSecurityEnabled ? '-translate-x-4.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Hide Last Seen */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
                <div className="flex items-start gap-2.5 min-w-0">
                  <EyeOff className="w-4 h-4 text-[#2481cc] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-bold">إخفاء آخر ظهور والحالة</div>
                    <div className="text-[11px] opacity-70">
                      إخفاء حالة متصل الآن ووقت آخر نشاط عن الآخرين
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={savingPrivacy}
                  onClick={() => handlePrivacyChange({ privacyHideLastSeen: !hideLastSeen })}
                  className={`w-10 h-5.5 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                    hideLastSeen ? 'bg-[#2481cc]' : 'bg-gray-500'
                  }`}
                >
                  <div
                    className={`w-4.5 h-4.5 rounded-full bg-white shadow-xs transform transition-transform ${
                      hideLastSeen ? '-translate-x-4.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Discreet Notifications */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Bell className="w-4 h-4 text-[#2481cc] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-bold">الإشعارات المموهة الآمنة</div>
                    <div className="text-[11px] opacity-70">
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
                  className={`w-10 h-5.5 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer ${
                    discreetNotifications ? 'bg-[#2481cc]' : 'bg-gray-500'
                  }`}
                >
                  <div
                    className={`w-4.5 h-4.5 rounded-full bg-white shadow-xs transform transition-transform ${
                      discreetNotifications ? '-translate-x-4.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

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
                className="w-full py-2 rounded-xl bg-[#2481cc]/15 hover:bg-[#2481cc]/25 text-[#2481cc] text-xs font-bold transition-colors cursor-pointer"
              >
                تفعيل إذن الإشعارات على هذا الجهاز
              </button>
              {notifFeedback && (
                <p className="text-[11px] font-semibold text-center text-[#2481cc]">
                  {notifFeedback}
                </p>
              )}
            </div>

            {/* Blocked Users List */}
            <div
              className={`p-3.5 rounded-2xl border space-y-2.5 ${
                theme === 'light'
                  ? 'bg-slate-50 border-slate-200/80'
                  : 'bg-[#162230] border-white/[0.07]'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-2">
                  <Ban className="w-4 h-4 text-rose-400" />
                  <span>قائمة الحظر</span>
                </span>
                <span className="text-[11px] opacity-70 tabular-nums">{blockedIds.length}</span>
              </div>

              {blockedIds.length === 0 ? (
                <p className="text-[11px] opacity-65">لا يوجد مستخدمون محظورون حالياً</p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {blockedIds.map((uid) => {
                    const u = usersMap[uid];
                    return (
                      <div
                        key={uid}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/15 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold truncate">
                            {u?.displayName || 'مستخدم'}
                          </div>
                          {u?.username && (
                            <div className="text-[10px] opacity-70 font-mono" dir="ltr">
                              @{u.username}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleBlockUser(uid)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-[11px] font-bold cursor-pointer shrink-0"
                        >
                          إلغاء الحظر
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
                className={`w-full px-3.5 py-2.5 text-sm rounded-xl outline-hidden border transition-colors ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-200/80 text-slate-900 focus:bg-white focus:border-[#2481cc]'
                    : 'bg-[#1a2533] border-white/[0.07] text-white focus:border-[#2481cc]'
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
                    ? 'bg-slate-100 border-slate-200/80 text-slate-700'
                    : 'bg-[#162230] border-white/[0.06] text-slate-300'
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
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-200/80 text-slate-900 focus:bg-white focus:border-[#2481cc]'
                    : 'bg-[#1a2533] border-white/[0.07] text-white focus:border-[#2481cc]'
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
                className={`w-full px-3.5 py-2 text-sm rounded-xl outline-hidden border resize-none transition-colors ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-200/80 text-slate-900 focus:bg-white focus:border-[#2481cc]'
                    : 'bg-[#1a2533] border-white/[0.07] text-white focus:border-[#2481cc]'
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
