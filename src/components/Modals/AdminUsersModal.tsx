import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  UserPlus,
  Copy,
  Check,
  Trash2,
  Eye,
  EyeOff,
  Users,
  ArrowRight,
  Phone,
  User,
  Lock,
  Calendar,
  Hash,
  FileText,
  Clock,
  Search,
  ChevronLeft,
  Calculator,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '../../types/telegram';
import {
  getAvatarGradient,
  getInitials,
  isUserOnlineByLastSeen,
  formatLastSeenArabic,
} from '../../utils/telegramHelpers';

interface AdminUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRegisteredAccounts?: () => void;
}

export const AdminUsersModal: React.FC<AdminUsersModalProps> = ({
  isOpen,
  onClose,
  onOpenRegisteredAccounts,
}) => {
  const {
    theme,
    isAdmin,
    allUsers,
    usersMap,
    adminCredentialsMap,
    currentUser,
    createAccountByAdmin,
    getUserCredentialByAdmin,
    deleteUserProfileByAdmin,
    adminCalculatorPin,
    calculatorPinVersion,
    updateCalculatorPinByAdmin,
  } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<{
    displayName: string;
    username: string;
    phone?: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Account search & full details view state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedPassword, setSelectedPassword] = useState<string | null>(null);
  const [loadingSelectedPassword, setLoadingSelectedPassword] = useState(false);
  const [showSelectedPassword, setShowSelectedPassword] = useState(true);
  const [hiddenListPasswords, setHiddenListPasswords] = useState<Record<string, boolean>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Global Calculator access PIN management state
  const [newCalcPin, setNewCalcPin] = useState('');
  const [showCurrentCalcPin, setShowCurrentCalcPin] = useState(true);
  const [isUpdatingCalcPin, setIsUpdatingCalcPin] = useState(false);
  const [calcPinError, setCalcPinError] = useState('');
  const [calcPinSuccess, setCalcPinSuccess] = useState('');

  const selectedUser: UserProfile | null = selectedUserId
    ? allUsers.find((u) => u.uid === selectedUserId) || null
    : null;

  const resolvedSelectedPassword = selectedUser
    ? adminCredentialsMap[selectedUser.uid] ?? selectedPassword
    : null;

  useEffect(() => {
    if (!isOpen) {
      setSelectedUserId(null);
      setSelectedPassword(null);
      setShowSelectedPassword(true);
      setCalcPinError('');
      setCalcPinSuccess('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!selectedUserId || !isAdmin || !isOpen) {
      setSelectedPassword(null);
      setLoadingSelectedPassword(false);
      setShowSelectedPassword(true);
      return;
    }

    setShowSelectedPassword(true);
    const cachedPwd = adminCredentialsMap[selectedUserId];
    if (cachedPwd) {
      setSelectedPassword(cachedPwd);
      setLoadingSelectedPassword(false);
      return;
    }

    let cancelled = false;
    setLoadingSelectedPassword(true);
    setSelectedPassword(null);

    getUserCredentialByAdmin(selectedUserId)
      .then((pwd) => {
        if (!cancelled) {
          setSelectedPassword(pwd);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedPassword(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSelectedPassword(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedUserId, isAdmin, isOpen, adminCredentialsMap, getUserCredentialByAdmin]);

  if (!isOpen || !isAdmin) return null;

  const handleCopyField = (key: string, value: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const normalizeDigitsInput = (raw: string): string => {
    return raw
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/\D/g, '')
      .slice(0, 12);
  };

  const handleUpdateCalculatorPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCalcPinError('');
    setCalcPinSuccess('');

    const sanitized = normalizeDigitsInput(newCalcPin);
    if (sanitized.length < 4 || sanitized.length > 12) {
      setCalcPinError('يجب أن يتكون رمز الآلة الحاسبة من 4 إلى 12 رقماً');
      return;
    }

    if (sanitized === adminCalculatorPin) {
      setCalcPinError('الرمز الجديد مطابق للرمز الحالي النشط بالفعل');
      return;
    }

    setIsUpdatingCalcPin(true);
    try {
      await updateCalculatorPinByAdmin(sanitized);
      setNewCalcPin('');
      setCalcPinSuccess(
        `تم تحديث رمز الآلة الحاسبة لجميع الحسابات إلى (${sanitized}) وتعطيل الرمز السابق فوراً.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تحديث رمز الآلة الحاسبة';
      setCalcPinError(msg);
    } finally {
      setIsUpdatingCalcPin(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreatedCredentials(null);
    setIsSubmitting(true);

    try {
      const created = await createAccountByAdmin({
        username,
        displayName,
        phone,
        password,
        bio,
      });

      setCreatedCredentials({
        displayName: created.displayName,
        username: created.username,
        phone: created.phone,
        password,
      });

      setDisplayName('');
      setUsername('');
      setPhone('');
      setPassword('');
      setBio('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر إنشاء الحساب';
      if (msg === 'PROVIDER_DISABLED') {
        setError('يرجى تفعيل Email/Password في Firebase Authentication أولاً');
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const text = `بيانات الدخول لتطبيق JanaX:\nالاسم: ${createdCredentials.displayName}\nاسم المستخدم: ${createdCredentials.username}${
      createdCredentials.phone ? `\nرقم الهاتف: ${createdCredentials.phone}` : ''
    }\nكلمة المرور: ${createdCredentials.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCreatedAt = (iso?: string): string => {
    if (!iso) return 'غير معروف';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'غير معروف';
    return d.toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredUsers = allUsers.filter((u) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      u.uid.toLowerCase().includes(q)
    );
  });

  const handleCopyAllSelectedDetails = () => {
    if (!selectedUser) return;
    const lines = [
      `تفاصيل حساب JanaX:`,
      `الاسم الكامل: ${selectedUser.displayName}`,
      `اسم المستخدم: @${selectedUser.username}`,
      `رقم الهاتف: ${selectedUser.phone || 'غير مضاف'}`,
      `كلمة المرور: ${resolvedSelectedPassword || 'تُحفظ تلقائياً عند تسجيل الدخول'}`,
      `الصلاحية: ${selectedUser.role === 'admin' ? 'مدير النظام (Admin)' : 'مستخدم عادي'}`,
      `النبذة: ${selectedUser.bio || 'لا توجد'}`,
      `معرف الحساب (UID): ${selectedUser.uid}`,
      `تاريخ الإنشاء: ${formatCreatedAt(selectedUser.createdAt)}`,
    ];
    handleCopyField('all', lines.join('\n'));
  };

  const cardBg =
    theme === 'light'
      ? 'bg-gray-50 border-gray-200'
      : 'bg-[#1e2a38] border-[#2b3a4a]';

  const inputBg =
    theme === 'light'
      ? 'bg-white border-gray-200 text-gray-900 focus:border-[#2481cc]'
      : 'bg-[#242f3d] border-[#2b3a4a] text-white focus:border-[#2481cc]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none">
      <div
        className={`w-full max-w-lg rounded-3xl p-6 shadow-2xl border text-right transition-all max-h-[90vh] flex flex-col ${
          theme === 'light'
            ? 'bg-white border-gray-200 text-gray-900'
            : 'bg-[#17212b] border-[#2b3a4a] text-white'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          {selectedUser ? (
            <button
              type="button"
              onClick={() => setSelectedUserId(null)}
              className="flex items-center gap-2 text-sm font-bold text-[#2481cc] hover:opacity-85 cursor-pointer"
            >
              <ArrowRight className="w-5 h-5" />
              <span>تفاصيل الحساب الكاملة</span>
            </button>
          ) : (
            <h2 className="text-base font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#2481cc]" />
              <span>لوحة الأدمن • إدارة وإنشاء الحسابات</span>
            </h2>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#7f91a4] hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {selectedUser ? (
          /* Full Account Details Panel */
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Profile Hero Card */}
            <div className={`p-4 rounded-2xl border flex items-center gap-3.5 ${cardBg}`}>
              <div className="relative shrink-0">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg text-white overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                    selectedUser.uid
                  )}`}
                >
                  {selectedUser.photoURL ? (
                    <img
                      src={selectedUser.photoURL}
                      alt={selectedUser.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{getInitials(selectedUser.displayName)}</span>
                  )}
                </div>
                {isUserOnlineByLastSeen(selectedUser) && (
                  <div className="absolute bottom-0.5 left-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#1e2a38] rounded-full" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold truncate">{selectedUser.displayName}</h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedUser.role === 'admin'
                        ? 'bg-[#2481cc]/20 text-[#2481cc]'
                        : 'bg-emerald-500/15 text-emerald-400'
                    }`}
                  >
                    {selectedUser.role === 'admin' ? 'مدير النظام (Admin)' : 'مستخدم عادي'}
                  </span>
                </div>
                <div className="text-xs text-[#7f91a4] mt-1 flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isUserOnlineByLastSeen(selectedUser) ? 'bg-emerald-500' : 'bg-[#7f91a4]'
                    }`}
                  />
                  <span>
                    {isUserOnlineByLastSeen(selectedUser)
                      ? 'متصل الآن'
                      : selectedUser.lastSeen
                      ? `غير متصل • آخر ظهور ${formatLastSeenArabic(selectedUser.lastSeen)}`
                      : 'غير متصل'}
                  </span>
                </div>
              </div>
            </div>

            {/* Detailed Attributes */}
            <div className={`rounded-2xl border divide-y ${
              theme === 'light'
                ? 'bg-gray-50 border-gray-200 divide-gray-200'
                : 'bg-[#1e2a38] border-[#2b3a4a] divide-[#2b3a4a]'
            }`}>
              {/* Full Name */}
              <div className="p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <User className="w-4 h-4 text-[#2481cc] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] text-[#7f91a4]">الاسم الكامل</div>
                    <div className="text-xs font-bold truncate">{selectedUser.displayName}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyField('displayName', selectedUser.displayName)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-[#7f91a4] hover:text-white cursor-pointer shrink-0"
                  title="نسخ الاسم"
                >
                  {copiedField === 'displayName' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Username */}
              <div className="p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Hash className="w-4 h-4 text-[#2481cc] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] text-[#7f91a4]">اسم المستخدم</div>
                    <div className="text-xs font-bold font-mono truncate" dir="ltr">
                      @{selectedUser.username}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyField('username', selectedUser.username)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-[#7f91a4] hover:text-white cursor-pointer shrink-0"
                  title="نسخ اسم المستخدم"
                >
                  {copiedField === 'username' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Phone */}
              <div className="p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Phone className="w-4 h-4 text-[#2481cc] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] text-[#7f91a4]">رقم الهاتف</div>
                    <div className="text-xs font-bold font-mono truncate" dir="ltr">
                      {selectedUser.phone ? selectedUser.phone : 'غير مضاف'}
                    </div>
                  </div>
                </div>
                {selectedUser.phone && (
                  <button
                    type="button"
                    onClick={() => handleCopyField('phone', selectedUser.phone || '')}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-[#7f91a4] hover:text-white cursor-pointer shrink-0"
                    title="نسخ رقم الهاتف"
                  >
                    {copiedField === 'phone' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>

              {/* Password */}
              <div className="p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] text-[#7f91a4]">كلمة المرور</div>
                    {loadingSelectedPassword ? (
                      <div className="text-xs text-[#7f91a4]">جاري التحميل...</div>
                    ) : resolvedSelectedPassword ? (
                      <div
                        className={`text-xs font-bold font-mono truncate ${
                          theme === 'light' ? 'text-amber-700' : 'text-amber-300'
                        }`}
                        dir="ltr"
                      >
                        {showSelectedPassword ? resolvedSelectedPassword : '••••••••'}
                      </div>
                    ) : (
                      <div className="text-[11px] text-[#7f91a4]">
                        تُحفظ تلقائياً عند تسجيل الدخول القادم لهذا الحساب
                      </div>
                    )}
                  </div>
                </div>
                {resolvedSelectedPassword && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowSelectedPassword((prev) => !prev)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-[#7f91a4] hover:text-white cursor-pointer"
                      title={showSelectedPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    >
                      {showSelectedPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyField('password', resolvedSelectedPassword)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-[#7f91a4] hover:text-white cursor-pointer"
                      title="نسخ كلمة المرور"
                    >
                      {copiedField === 'password' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Bio */}
              <div className="p-3 flex items-start gap-2.5">
                <FileText className="w-4 h-4 text-[#2481cc] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-[#7f91a4]">النبذة التعريفية</div>
                  <div className="text-xs leading-relaxed break-words">
                    {selectedUser.bio || 'لا توجد نبذة'}
                  </div>
                </div>
              </div>

              {/* Created At & Creator */}
              <div className="p-3 flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-[#2481cc] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-[#7f91a4]">تاريخ الإنشاء وطريقة التسجيل</div>
                  <div className="text-xs font-medium">{formatCreatedAt(selectedUser.createdAt)}</div>
                  <div className="text-[11px] text-[#7f91a4] mt-0.5">
                    {selectedUser.createdBy
                      ? `أُنشئ بواسطة: ${usersMap[selectedUser.createdBy]?.displayName || 'الأدمن'}`
                      : 'تسجيل ذاتي / حساب أساسي'}
                  </div>
                </div>
              </div>

              {/* Last Seen */}
              <div className="p-3 flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-[#2481cc] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-[#7f91a4]">آخر نشاط</div>
                  <div className="text-xs font-medium">
                    {selectedUser.lastSeen ? formatCreatedAt(selectedUser.lastSeen) : 'غير مسجل'}
                  </div>
                </div>
              </div>

              {/* UID */}
              <div className="p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Shield className="w-4 h-4 text-[#7f91a4] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[10px] text-[#7f91a4]">معرف الحساب (UID)</div>
                    <div className="text-[11px] font-mono opacity-85 truncate" dir="ltr">
                      {selectedUser.uid}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyField('uid', selectedUser.uid)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-[#7f91a4] hover:text-white cursor-pointer shrink-0"
                  title="نسخ المعرف"
                >
                  {copiedField === 'uid' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyAllSelectedDetails}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                {copiedField === 'all' ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>تم نسخ جميع التفاصيل</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>نسخ تفاصيل الحساب</span>
                  </>
                )}
              </button>

              {selectedUser.uid !== currentUser?.uid && selectedUser.role !== 'admin' && (
                <button
                  type="button"
                  onClick={async () => {
                    const uidToDelete = selectedUser.uid;
                    setSelectedUserId(null);
                    await deleteUserProfileByAdmin(uidToDelete);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="إزالة من الدليل"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>إزالة</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Accounts Creation & List View */
          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* Global Calculator PIN Management Card */}
            <form
              onSubmit={handleUpdateCalculatorPin}
              className={`p-4 rounded-2xl border space-y-3 ${cardBg}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-[#2481cc] flex items-center gap-1.5">
                  <Calculator className="w-4 h-4" />
                  <span>رمز الدخول في الآلة الحاسبة (لجميع الحسابات)</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#2481cc]/15 text-[#2481cc] text-[10px] font-bold">
                  {calculatorPinVersion > 0 ? `الإصدار #${calculatorPinVersion}` : 'الرمز الافتراضي'}
                </span>
              </div>

              <div
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border ${
                  theme === 'light'
                    ? 'bg-white border-gray-200'
                    : 'bg-[#17212b]/80 border-[#2b3a4a]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-[11px] text-[#7f91a4] shrink-0">الرمز النشط حالياً:</span>
                  <span
                    className={`text-sm font-mono font-bold tracking-widest truncate ${
                      theme === 'light' ? 'text-amber-700' : 'text-amber-300'
                    }`}
                    dir="ltr"
                  >
                    {showCurrentCalcPin ? adminCalculatorPin : '••••'}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowCurrentCalcPin((prev) => !prev)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-[#7f91a4] hover:text-white cursor-pointer"
                    title={showCurrentCalcPin ? 'إخفاء الرمز' : 'إظهار الرمز'}
                  >
                    {showCurrentCalcPin ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyField('calcPin', adminCalculatorPin)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-[#7f91a4] hover:text-white cursor-pointer"
                    title="نسخ رمز الآلة الحاسبة"
                  >
                    {copiedField === 'calcPin' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {calcPinError && (
                <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-xs">
                  {calcPinError}
                </div>
              )}

              {calcPinSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs leading-relaxed">
                  {calcPinSuccess}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={newCalcPin}
                  onChange={(e) => {
                    setNewCalcPin(normalizeDigitsInput(e.target.value));
                    if (calcPinError) setCalcPinError('');
                    if (calcPinSuccess) setCalcPinSuccess('');
                  }}
                  placeholder="أدخل الرمز الجديد (4 إلى 12 رقماً)"
                  dir="ltr"
                  className={`flex-1 px-3 py-2 text-xs rounded-xl outline-hidden border font-mono tracking-wider ${inputBg}`}
                />
                <button
                  type="submit"
                  disabled={isUpdatingCalcPin || newCalcPin.length < 4}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {isUpdatingCalcPin ? 'جاري التحديث...' : 'تغيير الرمز وتعطيل السابق'}
                </button>
              </div>

              <p className="text-[11px] text-[#7f91a4] leading-relaxed">
                عند التحديث، يتم تعطيل الرمز السابق فوراً لجميع الحسابات والأجهزة، ويصبح الرمز الجديد هو المطلوب للدخول من شاشة الآلة الحاسبة.
              </p>
            </form>

            {/* Create New User Form */}
            <form onSubmit={handleCreate} className={`p-4 rounded-2xl border space-y-3 ${cardBg}`}>
              <div className="text-xs font-bold text-[#2481cc] flex items-center gap-1.5 mb-1">
                <UserPlus className="w-4 h-4" />
                <span>إنشاء حساب مستخدم جديد</span>
              </div>

              {error && (
                <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-xs">
                  {error}
                </div>
              )}

              {createdCredentials && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs space-y-1.5">
                  <div className="font-bold flex items-center justify-between">
                    <span>✅ تم إنشاء الحساب بنجاح!</span>
                    <button
                      type="button"
                      onClick={handleCopyCredentials}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'تم النسخ' : 'نسخ البيانات'}</span>
                    </button>
                  </div>
                  <div className="font-mono text-[11px] opacity-90" dir="ltr">
                    Username: {createdCredentials.username} | Password: {createdCredentials.password}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1 opacity-80">
                    الاسم الكامل
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="مثال: سارة علي"
                    className={`w-full px-3 py-2 text-xs rounded-xl outline-hidden border ${inputBg}`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold mb-1 opacity-80">
                    اسم المستخدم (إنجليزي)
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, ''))}
                    placeholder="sara_2026"
                    dir="ltr"
                    className={`w-full px-3 py-2 text-xs rounded-xl outline-hidden border font-mono ${inputBg}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1 opacity-80">
                    رقم الهاتف (اختياري)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+966 50 123 4567"
                    dir="ltr"
                    className={`w-full px-3 py-2 text-xs rounded-xl outline-hidden border font-mono ${inputBg}`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold mb-1 opacity-80">
                    كلمة المرور (6 أحرف فأكثر)
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••"
                      dir="ltr"
                      className={`w-full pl-8 pr-3 py-2 text-xs rounded-xl outline-hidden border ${inputBg}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute left-2.5 top-2 text-[#7f91a4] hover:text-white cursor-pointer"
                    >
                      {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1 opacity-80">
                  الوصف (اختياري)
                </label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="عضو في JanaX"
                  className={`w-full px-3 py-2 text-xs rounded-xl outline-hidden border ${inputBg}`}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب في السحابة'}
              </button>
            </form>

            {/* Registered Users List */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                <h3 className="text-xs font-bold flex items-center gap-1.5 opacity-90">
                  <Users className="w-4 h-4 text-[#2481cc]" />
                  <span>الحسابات المسجلة ({filteredUsers.length})</span>
                </h3>
                {onOpenRegisteredAccounts ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenRegisteredAccounts();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#2481cc]/15 hover:bg-[#2481cc]/25 text-[#2481cc] text-[11px] font-bold cursor-pointer"
                  >
                    فتح شاشة الحسابات الكاملة ↗
                  </button>
                ) : (
                  <span className="text-[10px] text-[#7f91a4]">اضغط على أي حساب لعرض التفاصيل</span>
                )}
              </div>

              {/* Search Accounts */}
              <div className="relative mb-2.5">
                <Search className="w-3.5 h-3.5 text-[#7f91a4] absolute right-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث بالاسم أو اسم المستخدم أو الهاتف..."
                  className={`w-full pr-8 pl-3 py-2 text-xs rounded-xl outline-hidden border ${inputBg}`}
                />
              </div>

              <div className="space-y-2">
                {filteredUsers.map((u) => {
                  const accountPassword = adminCredentialsMap[u.uid];
                  const isHidden = Boolean(hiddenListPasswords[u.uid]);

                  return (
                    <div
                      key={u.uid}
                      onClick={() => setSelectedUserId(u.uid)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedUserId(u.uid);
                        }
                      }}
                      className={`p-2.5 rounded-2xl border transition-colors cursor-pointer space-y-2 ${
                        theme === 'light'
                          ? 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          : 'bg-[#1e2a38]/60 border-[#2b3a4a] hover:bg-[#233242]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                                u.uid
                              )}`}
                            >
                              {u.photoURL ? (
                                <img
                                  src={u.photoURL}
                                  alt={u.displayName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>{getInitials(u.displayName)}</span>
                              )}
                            </div>
                            {isUserOnlineByLastSeen(u) && (
                              <div className="absolute bottom-0 left-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#17212b] rounded-full" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold truncate">{u.displayName}</span>
                              {u.role === 'admin' && (
                                <span className="px-1.5 py-0.2 rounded-full bg-[#2481cc]/20 text-[#2481cc] text-[10px] font-bold">
                                  Admin
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#7f91a4] font-mono truncate" dir="ltr">
                              {u.phone ? u.phone : `@${u.username}`}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {u.uid !== currentUser?.uid && u.role !== 'admin' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteUserProfileByAdmin(u.uid);
                              }}
                              className="p-1.5 rounded-full text-[#7f91a4] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="إزالة من الدليل"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <ChevronLeft className="w-4 h-4 text-[#7f91a4]" />
                        </div>
                      </div>

                      {/* Password bar directly visible on registered account card */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-[11px] ${
                          theme === 'light'
                            ? 'bg-white border border-gray-200'
                            : 'bg-[#17212b]/80 border border-[#2b3a4a]/80'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-[#7f91a4] shrink-0">كلمة المرور:</span>
                          {accountPassword ? (
                            <span
                              className={`font-mono font-bold truncate ${
                                theme === 'light' ? 'text-amber-700' : 'text-amber-300'
                              }`}
                              dir="ltr"
                            >
                              {isHidden ? '••••••••' : accountPassword}
                            </span>
                          ) : (
                            <span className="text-[#7f91a4] truncate">
                              تُحفظ تلقائياً عند تسجيل الدخول
                            </span>
                          )}
                        </div>

                        {accountPassword && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setHiddenListPasswords((prev) => ({
                                  ...prev,
                                  [u.uid]: !prev[u.uid],
                                }))
                              }
                              className="p-1 rounded-md hover:bg-white/10 text-[#7f91a4] hover:text-white cursor-pointer"
                              title={isHidden ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور'}
                            >
                              {isHidden ? (
                                <Eye className="w-3.5 h-3.5" />
                              ) : (
                                <EyeOff className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyField(`pwd_${u.uid}`, accountPassword)}
                              className="p-1 rounded-md hover:bg-white/10 text-[#7f91a4] hover:text-white cursor-pointer"
                              title="نسخ كلمة المرور"
                            >
                              {copiedField === `pwd_${u.uid}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
