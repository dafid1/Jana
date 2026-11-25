import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRight,
  Shield,
  Users,
  UserPlus,
  Search,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Phone,
  Hash,
  User,
  FileText,
  Calendar,
  Clock,
  Trash2,
  MessageSquare,
  Calculator,
  KeyRound,
  Save,
  ChevronLeft,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { UserProfile } from '../../types/telegram';
import {
  getAvatarGradient,
  getInitials,
  isUserOnlineByLastSeen,
  formatLastSeenArabic,
} from '../../utils/telegramHelpers';
import { useBackHandler } from '../../utils/androidBackNavigation';

interface AdminAccountsScreenProps {
  isOpen: boolean;
  onClose: () => void;
  initialOpenCreate?: boolean;
}

type AccountFilter = 'all' | 'online' | 'admin' | 'user' | 'withPassword';

export const AdminAccountsScreen: React.FC<AdminAccountsScreenProps> = ({
  isOpen,
  onClose,
  initialOpenCreate = false,
}) => {
  const {
    theme,
    isAdmin,
    allUsers,
    usersMap,
    adminCredentialsMap,
    adminCalculatorPin,
    calculatorPinVersion,
    adminDecoyPin,
    decoyPinVersion,
    currentUser,
    createAccountByAdmin,
    getUserCredentialByAdmin,
    updateUserProfileByAdmin,
    updateUserPasswordByAdmin,
    deleteUserProfileByAdmin,
    updateCalculatorPinByAdmin,
    updateDecoyPinByAdmin,
    disableDecoyPinByAdmin,
  } = useAuth();
  const { startDirectChat } = useChat();

  // Navigation & filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<AccountFilter>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  // Global & per-row password visibility
  const [showAllPasswords, setShowAllPasswords] = useState(true);
  const [perUserPasswordToggle, setPerUserPasswordToggle] = useState<Record<string, boolean>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Selected user password fetch
  const [fetchedPassword, setFetchedPassword] = useState<string | null>(null);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [showDetailPassword, setShowDetailPassword] = useState(true);

  // Edit profile form state
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBio, setEditBio] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Change password form state
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [fallbackOldPassword, setFallbackOldPassword] = useState('');
  const [showNewAccountPassword, setShowNewAccountPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Delete confirmation state
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create account panel state
  const [showCreatePanel, setShowCreatePanel] = useState(initialOpenCreate);
  const [createDisplayName, setCreateDisplayName] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createBio, setCreateBio] = useState('');
  const [showCreatePass, setShowCreatePass] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdBanner, setCreatedBanner] = useState<{
    displayName: string;
    username: string;
    phone?: string;
    password: string;
  } | null>(null);

  // Calculator PIN panel state
  const [showCalcPinPanel, setShowCalcPinPanel] = useState(false);
  const [newCalcPin, setNewCalcPin] = useState('');
  const [isUpdatingCalcPin, setIsUpdatingCalcPin] = useState(false);
  const [calcPinFeedback, setCalcPinFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newDecoyPin, setNewDecoyPin] = useState('');
  const [isUpdatingDecoyPin, setIsUpdatingDecoyPin] = useState(false);
  const [decoyPinFeedback, setDecoyPinFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useBackHandler(isOpen && confirmDeleteUid !== null, () => setConfirmDeleteUid(null), 78);
  useBackHandler(isOpen && showCalcPinPanel, () => setShowCalcPinPanel(false), 77);
  useBackHandler(isOpen && showCreatePanel, () => setShowCreatePanel(false), 76);
  useBackHandler(isOpen && mobileShowDetail, () => setMobileShowDetail(false), 75);

  useEffect(() => {
    if (isOpen) {
      setShowCreatePanel(initialOpenCreate);
    } else {
      setMobileShowDetail(false);
      setConfirmDeleteUid(null);
      setProfileFeedback(null);
      setPasswordFeedback(null);
      setCalcPinFeedback(null);
      setDecoyPinFeedback(null);
      setCreateError('');
    }
  }, [isOpen, initialOpenCreate]);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allUsers.filter((u) => {
      if (filterType === 'online' && !isUserOnlineByLastSeen(u)) return false;
      if (filterType === 'admin' && u.role !== 'admin') return false;
      if (filterType === 'user' && u.role === 'admin') return false;
      if (filterType === 'withPassword' && !adminCredentialsMap[u.uid]) return false;

      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q) ||
        (u.bio || '').toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
      );
    });
  }, [allUsers, filterType, searchTerm, adminCredentialsMap]);

  // Keep a valid selected user on desktop when list updates
  useEffect(() => {
    if (!isOpen) return;
    if (selectedUserId && allUsers.some((u) => u.uid === selectedUserId)) return;
    if (allUsers.length > 0) {
      setSelectedUserId(allUsers[0].uid);
    } else {
      setSelectedUserId(null);
    }
  }, [isOpen, allUsers, selectedUserId]);

  const selectedUser: UserProfile | null = useMemo(
    () => (selectedUserId ? allUsers.find((u) => u.uid === selectedUserId) || null : null),
    [allUsers, selectedUserId]
  );

  const resolvedSelectedPassword = selectedUser
    ? adminCredentialsMap[selectedUser.uid] ?? fetchedPassword
    : null;

  // Populate edit fields & fetch credential when selectedUser changes
  useEffect(() => {
    if (!selectedUser) {
      setEditDisplayName('');
      setEditPhone('');
      setEditBio('');
      setFetchedPassword(null);
      return;
    }

    setEditDisplayName(selectedUser.displayName || '');
    setEditPhone(selectedUser.phone || '');
    setEditBio(selectedUser.bio || '');
    setNewAccountPassword('');
    setFallbackOldPassword('');
    setProfileFeedback(null);
    setPasswordFeedback(null);
    setConfirmDeleteUid(null);
    setShowDetailPassword(showAllPasswords);

    const cached = adminCredentialsMap[selectedUser.uid];
    if (cached) {
      setFetchedPassword(cached);
      setLoadingPassword(false);
      return;
    }

    let cancelled = false;
    setLoadingPassword(true);
    setFetchedPassword(null);

    getUserCredentialByAdmin(selectedUser.uid)
      .then((pwd) => {
        if (!cancelled) setFetchedPassword(pwd);
      })
      .catch(() => {
        if (!cancelled) setFetchedPassword(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingPassword(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedUser?.uid, isAdmin, isOpen, adminCredentialsMap, getUserCredentialByAdmin, showAllPasswords]);

  if (!isOpen || !isAdmin) return null;

  const onlineCount = allUsers.filter((u) => isUserOnlineByLastSeen(u)).length;
  const savedPasswordsCount = allUsers.filter((u) => Boolean(adminCredentialsMap[u.uid])).length;

  const handleCopy = (key: string, value: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const formatDate = (iso?: string): string => {
    if (!iso) return 'غير مسجل';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'غير مسجل';
    return d.toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isRowPasswordVisible = (uid: string): boolean => {
    if (Object.prototype.hasOwnProperty.call(perUserPasswordToggle, uid)) {
      return perUserPasswordToggle[uid];
    }
    return showAllPasswords;
  };

  const toggleRowPassword = (uid: string) => {
    const current = isRowPasswordVisible(uid);
    setPerUserPasswordToggle((prev) => ({ ...prev, [uid]: !current }));
  };

  const handleSelectAccount = (uid: string) => {
    setSelectedUserId(uid);
    setMobileShowDetail(true);
  };

  const handleSaveProfileChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setProfileFeedback(null);
    setIsSavingProfile(true);
    try {
      await updateUserProfileByAdmin(selectedUser.uid, {
        displayName: editDisplayName,
        phone: editPhone,
        bio: editBio,
      });
      setProfileFeedback({ type: 'success', text: 'تم حفظ تحديثات بيانات الحساب بنجاح.' });
    } catch (err: unknown) {
      setProfileFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر حفظ تعديلات الحساب',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangeUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setPasswordFeedback(null);
    setIsUpdatingPassword(true);
    try {
      await updateUserPasswordByAdmin(
        selectedUser.uid,
        newAccountPassword,
        fallbackOldPassword || undefined
      );
      setNewAccountPassword('');
      setFallbackOldPassword('');
      setPasswordFeedback({
        type: 'success',
        text: 'تم تحديث كلمة المرور في السحابة وسجل الإدارة بنجاح.',
      });
    } catch (err: unknown) {
      setPasswordFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر تحديث كلمة المرور',
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreatedBanner(null);
    setIsCreating(true);
    try {
      const created = await createAccountByAdmin({
        username: createUsername,
        displayName: createDisplayName,
        phone: createPhone,
        password: createPassword,
        bio: createBio,
      });
      setCreatedBanner({
        displayName: created.displayName,
        username: created.username,
        phone: created.phone,
        password: createPassword,
      });
      setSelectedUserId(created.uid);
      setCreateDisplayName('');
      setCreateUsername('');
      setCreatePhone('');
      setCreatePassword('');
      setCreateBio('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر إنشاء الحساب';
      setCreateError(
        msg === 'PROVIDER_DISABLED'
          ? 'يرجى تفعيل Email/Password في Firebase Authentication أولاً'
          : msg
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateCalculatorPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCalcPinFeedback(null);
    const sanitized = newCalcPin
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/\D/g, '')
      .slice(0, 12);

    if (sanitized.length < 4 || sanitized.length > 12) {
      setCalcPinFeedback({ type: 'error', text: 'يجب أن يتكون الرمز من 4 إلى 12 رقماً' });
      return;
    }

    setIsUpdatingCalcPin(true);
    try {
      await updateCalculatorPinByAdmin(sanitized);
      setNewCalcPin('');
      setCalcPinFeedback({
        type: 'success',
        text: `تم اعتماد رمز الآلة الحاسبة الجديد (${sanitized}) وتعطيل الرمز السابق لجميع الحسابات.`,
      });
    } catch (err: unknown) {
      setCalcPinFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر تحديث الرمز',
      });
    } finally {
      setIsUpdatingCalcPin(false);
    }
  };

  const handleUpdateDecoyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setDecoyPinFeedback(null);
    const sanitized = newDecoyPin
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/\D/g, '')
      .slice(0, 12);

    if (sanitized.length < 4 || sanitized.length > 12) {
      setDecoyPinFeedback({ type: 'error', text: 'يجب أن يتكون رمز الطوارئ الوهمي من 4 إلى 12 رقماً' });
      return;
    }

    setIsUpdatingDecoyPin(true);
    try {
      await updateDecoyPinByAdmin(sanitized);
      setNewDecoyPin('');
      setDecoyPinFeedback({
        type: 'success',
        text: `تم تفعيل رمز الطوارئ الوهمي (${sanitized}) — عند إدخاله ستفتح واجهة المهام الوهمية.`,
      });
    } catch (err: unknown) {
      setDecoyPinFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر تحديث رمز الطوارئ الوهمي',
      });
    } finally {
      setIsUpdatingDecoyPin(false);
    }
  };

  const handleDisableDecoyPin = async () => {
    setDecoyPinFeedback(null);
    setIsUpdatingDecoyPin(true);
    try {
      await disableDecoyPinByAdmin();
      setNewDecoyPin('');
      setDecoyPinFeedback({
        type: 'success',
        text: 'تم تعطيل رمز الطوارئ الوهمي بنجاح.',
      });
    } catch (err: unknown) {
      setDecoyPinFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر تعطيل الرمز الوهمي',
      });
    } finally {
      setIsUpdatingDecoyPin(false);
    }
  };

  const handleConfirmDelete = async (uid: string) => {
    setIsDeleting(true);
    try {
      await deleteUserProfileByAdmin(uid);
      setConfirmDeleteUid(null);
      if (selectedUserId === uid) {
        setSelectedUserId(null);
        setMobileShowDetail(false);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyAllDetails = (user: UserProfile, pwd: string | null) => {
    const lines = [
      'بيانات حساب JanaX:',
      `الاسم الكامل: ${user.displayName}`,
      `اسم المستخدم: @${user.username}`,
      `رقم الهاتف: ${user.phone || 'غير مضاف'}`,
      `كلمة المرور: ${pwd || 'غير مسجلة بعد'}`,
      `الصلاحية: ${user.role === 'admin' ? 'مدير النظام (Admin)' : 'مستخدم عادي'}`,
      `النبذة: ${user.bio || 'لا توجد'}`,
      `تاريخ الإنشاء: ${formatDate(user.createdAt)}`,
      `معرف الحساب (UID): ${user.uid}`,
    ];
    handleCopy(`all_${user.uid}`, lines.join('\n'));
  };

  const surfaceBg = theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-[#0b1118] text-white';
  const cardBg =
    theme === 'light'
      ? 'bg-white border-slate-200/80 shadow-xs'
      : 'bg-[#111923] border-white/[0.06]';
  const subCardBg =
    theme === 'light'
      ? 'bg-slate-50 border-slate-200/80'
      : 'bg-[#162230] border-white/[0.07]';
  const inputCls =
    theme === 'light'
      ? 'bg-white border-slate-200/80 text-slate-900 placeholder-slate-400 focus:border-[#2481cc]'
      : 'bg-[#1a2533] border-white/[0.07] text-white placeholder-[#7f91a4] focus:border-[#2481cc]';

  const filterTabs: { id: AccountFilter; label: string }[] = [
    { id: 'all', label: `الكل (${allUsers.length})` },
    { id: 'online', label: `متصل (${onlineCount})` },
    { id: 'withPassword', label: `بكلمة مرور (${savedPasswordsCount})` },
    { id: 'admin', label: 'المدراء' },
    { id: 'user', label: 'المستخدمون' },
  ];

  return (
    <div className={`fixed inset-0 z-50 flex flex-col select-none ${surfaceBg}`}>
      {/* Top Admin Header Bar */}
      <header
        className={`shrink-0 border-b px-4 py-3 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md ${
          theme === 'light'
            ? 'bg-white/95 border-slate-200/80'
            : 'bg-[#111923]/95 border-white/[0.06]'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              theme === 'light' ? 'hover:bg-gray-100 text-gray-700' : 'hover:bg-white/10 text-white'
            }`}
            title="العودة إلى المحادثات"
          >
            <ArrowRight className="w-5 h-5" />
          </button>

          <div className="w-10 h-10 rounded-2xl bg-[#2481cc]/15 text-[#2481cc] flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold truncate">شاشة الحسابات المسجلة</h1>
              <span className="px-2 py-0.5 rounded-full bg-[#2481cc]/15 text-[#2481cc] text-[11px] font-bold">
                {allUsers.length} حساب
              </span>
            </div>
            <p className="text-[11px] text-[#7f91a4] truncate">
              عرض تفاصيل جميع الحسابات المسجلة وإدارتها وكلمات المرور
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              const next = !showAllPasswords;
              setShowAllPasswords(next);
              setPerUserPasswordToggle({});
              setShowDetailPassword(next);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
              theme === 'light'
                ? 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-800'
                : 'bg-[#242f3d] border-[#2b3a4a] hover:bg-[#2c394b] text-white'
            }`}
          >
            {showAllPasswords ? (
              <>
                <EyeOff className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">إخفاء كلمات المرور</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">إظهار كل كلمات المرور</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowCalcPinPanel((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
              showCalcPinPanel
                ? 'bg-amber-500 text-slate-950 border-amber-500'
                : theme === 'light'
                ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>رمز الحاسبة:</span>
            <span className="font-mono tracking-wider" dir="ltr">
              {adminCalculatorPin}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreatePanel((prev) => !prev)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>إنشاء حساب جديد</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <div className="flex-1 overflow-hidden flex flex-col max-w-7xl w-full mx-auto px-3 sm:px-5 py-3 gap-3">
        {/* Top Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
          <div className={`p-3 rounded-2xl border flex items-center gap-3 ${cardBg}`}>
            <div className="w-9 h-9 rounded-xl bg-[#2481cc]/15 text-[#2481cc] flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-[#8ea0b5]">إجمالي الحسابات</div>
              <div className="text-base font-extrabold tabular-nums">{allUsers.length}</div>
            </div>
          </div>

          <div className={`p-3 rounded-2xl border flex items-center gap-3 ${cardBg}`}>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-[#8ea0b5]">المتصلون الآن</div>
              <div className="text-base font-extrabold tabular-nums text-emerald-400">{onlineCount}</div>
            </div>
          </div>

          <div className={`p-3 rounded-2xl border flex items-center gap-3 ${cardBg}`}>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
              <KeyRound className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-[#8ea0b5]">كلمات مرور محفوظة</div>
              <div className="text-base font-extrabold tabular-nums text-amber-400">
                {savedPasswordsCount} / {allUsers.length}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCalcPinPanel((prev) => !prev)}
            className={`p-3 rounded-2xl border flex items-center gap-3 text-right transition-colors cursor-pointer ${cardBg}`}
          >
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-[#8ea0b5]">رمز الآلة الحاسبة</div>
              <div className="text-base font-extrabold font-mono tabular-nums tracking-wider" dir="ltr">
                {adminCalculatorPin}
              </div>
            </div>
          </button>
        </div>

        {/* Collapsible Global Calculator PIN Manager */}
        {showCalcPinPanel && (
          <div className={`p-4 rounded-2xl border space-y-4 shrink-0 ${cardBg}`}>
            <form onSubmit={handleUpdateCalculatorPin} className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <Calculator className="w-4 h-4" />
                  <span>تغيير رمز الآلة الحاسبة لجميع الحسابات (الإصدار #{calculatorPinVersion})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCalcPinPanel(false)}
                  className="p-1 rounded-full text-[#7f91a4] hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {calcPinFeedback && (
                <div
                  className={`p-2.5 rounded-xl text-xs border ${
                    calcPinFeedback.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-red-500/15 border-red-500/30 text-red-400'
                  }`}
                >
                  {calcPinFeedback.text}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={newCalcPin}
                  onChange={(e) =>
                    setNewCalcPin(
                      e.target.value
                        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
                        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
                        .replace(/\D/g, '')
                        .slice(0, 12)
                    )
                  }
                  placeholder="الرمز الجديد (4 إلى 12 رقماً)"
                  dir="ltr"
                  className={`flex-1 px-3 py-2 text-xs rounded-xl outline-hidden border font-mono ${inputCls}`}
                />
                <button
                  type="submit"
                  disabled={isUpdatingCalcPin || newCalcPin.length < 4}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {isUpdatingCalcPin ? 'جاري التحديث...' : 'اعتماد الرمز وتعطيل السابق'}
                </button>
              </div>
            </form>

            {/* Decoy / Panic PIN Section */}
            <form
              onSubmit={handleUpdateDecoyPin}
              className="pt-3.5 border-t border-white/[0.07] space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                  <Shield className="w-4 h-4" />
                  <span>رمز الطوارئ الوهمي (Decoy PIN)</span>
                </div>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    adminDecoyPin
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-slate-500/15 text-[#8ea0b5]'
                  }`}
                >
                  {adminDecoyPin
                    ? `مفعّل (${adminDecoyPin}) • الإصدار #${decoyPinVersion}`
                    : 'غير مفعّل'}
                </span>
              </div>

              {decoyPinFeedback && (
                <div
                  className={`p-2.5 rounded-xl text-xs border ${
                    decoyPinFeedback.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-red-500/15 border-red-500/30 text-red-400'
                  }`}
                >
                  {decoyPinFeedback.text}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={newDecoyPin}
                  onChange={(e) =>
                    setNewDecoyPin(
                      e.target.value
                        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
                        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
                        .replace(/\D/g, '')
                        .slice(0, 12)
                    )
                  }
                  placeholder="رمز الطوارئ الوهمي (4 إلى 12 رقماً)"
                  dir="ltr"
                  className={`flex-1 px-3 py-2 text-xs rounded-xl outline-hidden border font-mono ${inputCls}`}
                />
                <button
                  type="submit"
                  disabled={isUpdatingDecoyPin || newDecoyPin.length < 4}
                  className="px-4 py-2 rounded-xl bg-[#2481cc] hover:bg-[#1e6fb1] text-white font-bold text-xs cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {isUpdatingDecoyPin ? 'جاري الحفظ...' : 'اعتماد الرمز الوهمي'}
                </button>
                {adminDecoyPin && (
                  <button
                    type="button"
                    disabled={isUpdatingDecoyPin}
                    onClick={handleDisableDecoyPin}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 font-bold text-xs cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    تعطيل الرمز
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Collapsible Create Account Panel */}
        {showCreatePanel && (
          <form
            onSubmit={handleCreateAccount}
            className={`p-4 rounded-2xl border space-y-3 shrink-0 ${cardBg}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#2481cc]">
                <UserPlus className="w-4 h-4" />
                <span>إنشاء حساب مستخدم جديد وحفظ بياناته</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCreatePanel(false)}
                className="p-1 rounded-full text-[#7f91a4] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs">
                {createError}
              </div>
            )}

            {createdBanner && (
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex flex-wrap items-center justify-between gap-2">
                <span>
                  ✅ تم إنشاء حساب <strong>{createdBanner.displayName}</strong> (@{createdBanner.username})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      'created_creds',
                      `الاسم: ${createdBanner.displayName}\nاسم المستخدم: ${createdBanner.username}${
                        createdBanner.phone ? `\nالهاتف: ${createdBanner.phone}` : ''
                      }\nكلمة المرور: ${createdBanner.password}`
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold cursor-pointer"
                >
                  {copiedField === 'created_creds' ? 'تم النسخ' : 'نسخ بيانات الدخول'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              <input
                type="text"
                required
                value={createDisplayName}
                onChange={(e) => setCreateDisplayName(e.target.value)}
                placeholder="الاسم الكامل"
                className={`px-3 py-2 text-xs rounded-xl outline-hidden border ${inputCls}`}
              />
              <input
                type="text"
                required
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, ''))}
                placeholder="اسم المستخدم (إنجليزي)"
                dir="ltr"
                className={`px-3 py-2 text-xs rounded-xl outline-hidden border font-mono ${inputCls}`}
              />
              <input
                type="tel"
                value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value)}
                placeholder="رقم الهاتف (اختياري)"
                dir="ltr"
                className={`px-3 py-2 text-xs rounded-xl outline-hidden border font-mono ${inputCls}`}
              />
              <div className="relative">
                <input
                  type={showCreatePass ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="كلمة المرور (6+ أحرف)"
                  dir="ltr"
                  className={`w-full pl-8 pr-3 py-2 text-xs rounded-xl outline-hidden border ${inputCls}`}
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePass((p) => !p)}
                  className="absolute left-2.5 top-2 text-[#7f91a4] hover:text-white cursor-pointer"
                >
                  {showCreatePass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                type="submit"
                disabled={isCreating}
                className="px-4 py-2 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                {isCreating ? 'جاري الإنشاء...' : 'حفظ وإنشاء الحساب'}
              </button>
            </div>
          </form>
        )}

        {/* Master-Detail Accounts Workspace */}
        <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
          {/* Accounts List Pane */}
          <section
            className={`w-full lg:w-[440px] shrink-0 flex flex-col rounded-2xl border overflow-hidden ${cardBg} ${
              mobileShowDetail ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Search & Filter Controls */}
            <div className="p-3 border-b border-inherit space-y-2.5 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-[#7f91a4] absolute right-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="بحث بالاسم، @اسم_المستخدم، رقم الهاتف أو UID..."
                  className={`w-full pr-9 pl-3 py-2 text-xs rounded-xl outline-hidden border ${inputCls}`}
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterType(tab.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      filterType === tab.id
                        ? 'bg-[#2481cc] text-white'
                        : theme === 'light'
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        : 'bg-[#242f3d] text-[#7f91a4] hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Accounts List Items */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-xs text-[#7f91a4]">
                  لا توجد حسابات مطابقة لنتائج البحث الحالية
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isSelected = selectedUser?.uid === u.uid;
                  const online = isUserOnlineByLastSeen(u);
                  const savedPwd = adminCredentialsMap[u.uid];
                  const pwdVisible = isRowPasswordVisible(u.uid);

                  return (
                    <div
                      key={u.uid}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectAccount(u.uid)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectAccount(u.uid);
                        }
                      }}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? 'border-[#2481cc] bg-[#2481cc]/10'
                          : theme === 'light'
                          ? 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-100'
                          : 'bg-[#162230]/80 border-white/[0.06] hover:bg-[#1a2838]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <div
                              className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs text-white overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
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
                            {online && (
                              <span
                                className={`absolute bottom-0 left-0 w-3 h-3 rounded-full bg-emerald-500 border-2 ${
                                  theme === 'light' ? 'border-white' : 'border-[#111923]'
                                }`}
                              />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold truncate">{u.displayName}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                  u.role === 'admin'
                                    ? 'bg-[#2481cc]/20 text-[#2481cc]'
                                    : 'bg-emerald-500/15 text-emerald-400'
                                }`}
                              >
                                {u.role === 'admin' ? 'مشرف' : 'مستخدم'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-[#8ea0b5] font-mono mt-0.5" dir="ltr">
                              <span className="truncate">@{u.username}</span>
                              {u.phone && <span className="truncate">• {u.phone}</span>}
                            </div>
                          </div>
                        </div>

                        <ChevronLeft className="w-4 h-4 text-[#8ea0b5] shrink-0" />
                      </div>

                      {/* Password directly displayed on every registered account card */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-[11px] ${
                          theme === 'light'
                            ? 'bg-white border-slate-200/80'
                            : 'bg-[#0b1118] border-white/[0.06]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-[#8ea0b5] shrink-0">كلمة المرور:</span>
                          {savedPwd ? (
                            <span
                              className={`font-mono font-bold truncate ${
                                theme === 'light' ? 'text-amber-700' : 'text-amber-300'
                              }`}
                              dir="ltr"
                            >
                              {pwdVisible ? savedPwd : '••••••••'}
                            </span>
                          ) : (
                            <span className="text-[#8ea0b5] truncate">
                              تُحفظ تلقائياً عند تسجيل الدخول
                            </span>
                          )}
                        </div>

                        {savedPwd && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleRowPassword(u.uid)}
                              className={`p-1 rounded-md cursor-pointer transition-colors ${
                                theme === 'light'
                                  ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
                                  : 'hover:bg-white/10 text-[#8ea0b5] hover:text-white'
                              }`}
                              title={pwdVisible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                            >
                              {pwdVisible ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(`row_pwd_${u.uid}`, savedPwd)}
                              className={`p-1 rounded-md cursor-pointer transition-colors ${
                                theme === 'light'
                                  ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
                                  : 'hover:bg-white/10 text-[#8ea0b5] hover:text-white'
                              }`}
                              title="نسخ كلمة المرور"
                            >
                              {copiedField === `row_pwd_${u.uid}` ? (
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
                })
              )}
            </div>
          </section>

          {/* Account Details & Management Pane */}
          <section
            className={`flex-1 flex flex-col rounded-2xl border overflow-hidden ${cardBg} ${
              mobileShowDetail ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {!selectedUser ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#7f91a4]">
                <Users className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm font-bold">اختر حساباً من القائمة لعرض تفاصيله وإدارته</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {/* Mobile Back to Accounts List */}
                <button
                  type="button"
                  onClick={() => setMobileShowDetail(false)}
                  className="lg:hidden flex items-center gap-1.5 text-xs font-bold text-[#2481cc] cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>العودة لقائمة الحسابات</span>
                </button>

                {/* Hero Summary & Quick Actions */}
                <div className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 ${subCardBg}`}>
                  <div className="flex items-center gap-3.5 min-w-0">
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
                        <span className="absolute bottom-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#1e2a38]" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-extrabold truncate">{selectedUser.displayName}</h2>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            selectedUser.role === 'admin'
                              ? 'bg-[#2481cc]/20 text-[#2481cc]'
                              : 'bg-emerald-500/15 text-emerald-400'
                          }`}
                        >
                          {selectedUser.role === 'admin' ? 'مدير النظام (Admin)' : 'مستخدم عادي'}
                        </span>
                      </div>
                      <div className="text-xs text-[#7f91a4] mt-1">
                        {isUserOnlineByLastSeen(selectedUser)
                          ? 'متصل الآن'
                          : selectedUser.lastSeen
                          ? `غير متصل • آخر ظهور ${formatLastSeenArabic(selectedUser.lastSeen)}`
                          : 'غير متصل'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedUser.uid !== currentUser?.uid && (
                      <button
                        type="button"
                        onClick={async () => {
                          await startDirectChat(selectedUser);
                          onClose();
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white text-xs font-bold cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>مراسلة</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopyAllDetails(selectedUser, resolvedSelectedPassword)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                        theme === 'light'
                          ? 'bg-white border-gray-200 hover:bg-gray-100 text-gray-800'
                          : 'bg-[#17212b] border-[#2b3a4a] hover:bg-[#242f3d] text-white'
                      }`}
                    >
                      {copiedField === `all_${selectedUser.uid}` ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ كل التفاصيل</span>
                        </>
                      )}
                    </button>

                    {selectedUser.uid !== currentUser?.uid && selectedUser.role !== 'admin' && (
                      confirmDeleteUid === selectedUser.uid ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleConfirmDelete(selectedUser.uid)}
                            className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                          >
                            {isDeleting ? 'جاري الحذف...' : 'تأكيد الإزالة'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteUid(null)}
                            className="px-2.5 py-2 rounded-xl bg-white/10 text-xs font-bold cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteUid(selectedUser.uid)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-bold cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>إزالة الحساب</span>
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Full Details & Credentials Card */}
                <div
                  className={`rounded-2xl border divide-y ${
                    theme === 'light'
                      ? 'bg-gray-50 border-gray-200 divide-gray-200'
                      : 'bg-[#1e2a38] border-[#2b3a4a] divide-[#2b3a4a]'
                  }`}
                >
                  <div className="px-4 py-2.5 text-xs font-bold text-[#2481cc]">
                    التفاصيل الكاملة وبيانات الدخول
                  </div>

                  {/* Display Name */}
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
                      onClick={() => handleCopy('detail_name', selectedUser.displayName)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-[#7f91a4] hover:text-white cursor-pointer"
                    >
                      {copiedField === 'detail_name' ? (
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
                      onClick={() => handleCopy('detail_user', selectedUser.username)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-[#7f91a4] hover:text-white cursor-pointer"
                    >
                      {copiedField === 'detail_user' ? (
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
                          {selectedUser.phone || 'غير مضاف'}
                        </div>
                      </div>
                    </div>
                    {selectedUser.phone && (
                      <button
                        type="button"
                        onClick={() => handleCopy('detail_phone', selectedUser.phone || '')}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-[#7f91a4] hover:text-white cursor-pointer"
                      >
                        {copiedField === 'detail_phone' ? (
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
                        <div className="text-[10px] text-[#7f91a4]">كلمة المرور المسجلة</div>
                        {loadingPassword ? (
                          <div className="text-xs text-[#7f91a4]">جاري التحميل...</div>
                        ) : resolvedSelectedPassword ? (
                          <div
                            className={`text-sm font-mono font-bold truncate ${
                              theme === 'light' ? 'text-amber-700' : 'text-amber-300'
                            }`}
                            dir="ltr"
                          >
                            {showDetailPassword ? resolvedSelectedPassword : '••••••••'}
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
                          onClick={() => setShowDetailPassword((p) => !p)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-[#7f91a4] hover:text-white cursor-pointer"
                          title={showDetailPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                        >
                          {showDetailPassword ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy('detail_pwd', resolvedSelectedPassword)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-[#7f91a4] hover:text-white cursor-pointer"
                          title="نسخ كلمة المرور"
                        >
                          {copiedField === 'detail_pwd' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Bio, Dates & UID */}
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-[#2481cc] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10px] text-[#7f91a4]">النبذة التعريفية</div>
                        <div className="break-words">{selectedUser.bio || 'لا توجد نبذة'}</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-[#2481cc] shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[10px] text-[#7f91a4]">تاريخ الإنشاء وطريقة التسجيل</div>
                        <div>{formatDate(selectedUser.createdAt)}</div>
                        <div className="text-[11px] text-[#7f91a4]">
                          {selectedUser.createdBy
                            ? `بواسطة: ${usersMap[selectedUser.createdBy]?.displayName || 'الأدمن'}`
                            : 'تسجيل ذاتي / حساب أساسي'}
                        </div>
                      </div>
                    </div>
                  </div>

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
                      onClick={() => handleCopy('detail_uid', selectedUser.uid)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-[#7f91a4] hover:text-white cursor-pointer"
                    >
                      {copiedField === 'detail_uid' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Management Panels Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {/* Edit Account Details Form */}
                  <form
                    onSubmit={handleSaveProfileChanges}
                    className={`p-4 rounded-2xl border space-y-3 ${subCardBg}`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-[#2481cc]">
                      <Save className="w-4 h-4" />
                      <span>تعديل بيانات الحساب</span>
                    </div>

                    {profileFeedback && (
                      <div
                        className={`p-2.5 rounded-xl text-xs border ${
                          profileFeedback.type === 'success'
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                            : 'bg-red-500/15 border-red-500/30 text-red-400'
                        }`}
                      >
                        {profileFeedback.text}
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-semibold mb-1 opacity-80">
                        الاسم الكامل
                      </label>
                      <input
                        type="text"
                        required
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        className={`w-full px-3 py-2 text-xs rounded-xl outline-hidden border ${inputCls}`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold mb-1 opacity-80">
                        رقم الهاتف
                      </label>
                      <input
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="+966 50 000 0000"
                        dir="ltr"
                        className={`w-full px-3 py-2 text-xs rounded-xl outline-hidden border font-mono ${inputCls}`}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold mb-1 opacity-80">
                        النبذة التعريفية
                      </label>
                      <input
                        type="text"
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        className={`w-full px-3 py-2 text-xs rounded-xl outline-hidden border ${inputCls}`}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="w-full py-2.5 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white font-bold text-xs cursor-pointer disabled:opacity-50"
                    >
                      {isSavingProfile ? 'جاري الحفظ...' : 'حفظ تعديلات البيانات'}
                    </button>
                  </form>

                  {/* Update Account Password Form */}
                  <form
                    onSubmit={handleChangeUserPassword}
                    className={`p-4 rounded-2xl border space-y-3 ${subCardBg}`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                      <KeyRound className="w-4 h-4" />
                      <span>تغيير كلمة مرور الحساب</span>
                    </div>

                    {passwordFeedback && (
                      <div
                        className={`p-2.5 rounded-xl text-xs border ${
                          passwordFeedback.type === 'success'
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                            : 'bg-red-500/15 border-red-500/30 text-red-400'
                        }`}
                      >
                        {passwordFeedback.text}
                      </div>
                    )}

                    {!resolvedSelectedPassword && (
                      <div>
                        <label className="block text-[11px] font-semibold mb-1 opacity-80">
                          كلمة المرور الحالية (مطلوبة للحسابات غير المحفوظة)
                        </label>
                        <input
                          type="text"
                          value={fallbackOldPassword}
                          onChange={(e) => setFallbackOldPassword(e.target.value)}
                          placeholder="أدخل كلمة المرور الحالية للحساب"
                          dir="ltr"
                          className={`w-full px-3 py-2 text-xs rounded-xl outline-hidden border font-mono ${inputCls}`}
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-semibold mb-1 opacity-80">
                        كلمة المرور الجديدة (6 أحرف فأكثر)
                      </label>
                      <div className="relative">
                        <input
                          type={showNewAccountPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={newAccountPassword}
                          onChange={(e) => setNewAccountPassword(e.target.value)}
                          placeholder="••••••"
                          dir="ltr"
                          className={`w-full pl-8 pr-3 py-2 text-xs rounded-xl outline-hidden border font-mono ${inputCls}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewAccountPassword((p) => !p)}
                          className="absolute left-2.5 top-2 text-[#7f91a4] hover:text-white cursor-pointer"
                        >
                          {showNewAccountPassword ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#7f91a4] leading-relaxed">
                      يتم تحديث كلمة المرور مباشرة في نظام المصادقة وتحديثها تلقائياً في سجل الإدارة لتظهر للأدمن فوراً.
                    </p>

                    <button
                      type="submit"
                      disabled={isUpdatingPassword || newAccountPassword.length < 6}
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-50"
                    >
                      {isUpdatingPassword ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
