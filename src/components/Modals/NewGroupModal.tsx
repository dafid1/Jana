import React, { useState, useRef, useEffect } from 'react';
import { X, Users, Link2, Check, Search, Camera } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import {
  compressImageFile,
  getAvatarGradient,
  getInitials,
} from '../../utils/telegramHelpers';

interface NewGroupModalProps {
  isOpen: boolean;
  initialTab?: 'create' | 'join';
  onClose: () => void;
}

export const NewGroupModal: React.FC<NewGroupModalProps> = ({
  isOpen,
  initialTab = 'create',
  onClose,
}) => {
  const { theme, currentUser, allUsers } = useAuth();
  const { createGroup, joinGroupByInvite } = useChat();

  const [tab, setTab] = useState<'create' | 'join'>(initialTab);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [inviteInput, setInviteInput] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setError('');
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const otherUsers = allUsers.filter((u) => u.uid !== currentUser?.uid);
  const filteredUsers = otherUsers.filter((u) => {
    if (!memberSearch.trim()) return true;
    const q = memberSearch.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
    );
  });

  const toggleMember = (uid: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleGroupPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 260, 0.8);
      setPhotoURL(compressed);
    } catch (err) {
      console.error(err);
    } finally {
      e.target.value = '';
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError('');
    setIsSubmitting(true);
    try {
      await createGroup({
        title: title.trim(),
        description: description.trim() || 'مجموعة جديدة في JanaX',
        photoURL: photoURL.trim(),
        memberIds: selectedUserIds,
      });
      setTitle('');
      setDescription('');
      setPhotoURL('');
      setSelectedUserIds([]);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء المجموعة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinByInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteInput.trim()) return;
    setError('');
    setIsSubmitting(true);
    try {
      await joinGroupByInvite(inviteInput);
      setInviteInput('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الانضمام للمجموعة');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none">
      <div
        className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border text-right transition-all max-h-[90vh] flex flex-col ${
          theme === 'light'
            ? 'bg-white border-gray-200 text-gray-900'
            : 'bg-[#17212b] border-[#2b3a4a] text-white'
        }`}
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h2 className="text-base font-bold flex items-center gap-2">
            {tab === 'create' ? (
              <Users className="w-5 h-5 text-[#2481cc]" />
            ) : (
              <Link2 className="w-5 h-5 text-[#2481cc]" />
            )}
            <span>{tab === 'create' ? 'إنشاء مجموعة جديدة' : 'انضمام لمجموعة برابط'}</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#7f91a4] hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="flex border-b border-white/10 text-xs font-semibold mb-4 shrink-0">
          <button
            type="button"
            onClick={() => {
              setTab('create');
              setError('');
            }}
            className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
              tab === 'create'
                ? 'text-[#2481cc] border-b-2 border-[#2481cc]'
                : 'text-[#7f91a4] hover:text-white'
            }`}
          >
            إنشاء مجموعة
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('join');
              setError('');
            }}
            className={`flex-1 py-2 text-center transition-colors cursor-pointer ${
              tab === 'join'
                ? 'text-[#2481cc] border-b-2 border-[#2481cc]'
                : 'text-[#7f91a4] hover:text-white'
            }`}
          >
            انضمام برابط دعوة
          </button>
        </div>

        {error && (
          <div className="p-2.5 mb-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs shrink-0">
            {error}
          </div>
        )}

        {tab === 'create' ? (
          <form onSubmit={handleCreateGroup} className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            {/* Avatar + Group Title */}
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleGroupPhotoUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-14 h-14 rounded-full bg-[#2481cc]/20 border border-dashed border-[#2481cc] flex items-center justify-center shrink-0 overflow-hidden cursor-pointer hover:bg-[#2481cc]/30 transition-colors"
                title="صورة المجموعة"
              >
                {photoURL ? (
                  <img src={photoURL} alt="Group" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-5 h-5 text-[#2481cc]" />
                )}
              </button>

              <div className="flex-1">
                <label className="block text-xs font-semibold mb-1 opacity-80">اسم المجموعة</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: فريق العمل"
                  className={`w-full px-3.5 py-2 text-sm rounded-xl outline-hidden border ${
                    theme === 'light'
                      ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#2481cc]'
                      : 'bg-[#242f3d] border-[#2b3a4a] text-white focus:border-[#2481cc]'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 opacity-80">
                الوصف (اختياري)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="وصف مختصر للمجموعة..."
                className={`w-full px-3.5 py-2 text-xs rounded-xl outline-hidden border ${
                  theme === 'light'
                    ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#2481cc]'
                    : 'bg-[#242f3d] border-[#2b3a4a] text-white focus:border-[#2481cc]'
                }`}
              />
            </div>

            {/* Select Members to Add Directly */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold opacity-80">
                  إضافة أعضاء ({selectedUserIds.length} محدد)
                </label>
                <span className="text-[10px] text-[#7f91a4]">
                  سيتم توليد رابط دعوة تلقائياً أيضاً
                </span>
              </div>

              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-[#7f91a4] absolute right-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="بحث عن أعضاء لإضافتهم..."
                  className={`w-full pr-8 pl-3 py-2 text-xs rounded-xl outline-hidden border ${
                    theme === 'light'
                      ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#2481cc]'
                      : 'bg-[#242f3d] border-[#2b3a4a] text-white focus:border-[#2481cc]'
                  }`}
                />
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1 rounded-2xl border border-white/10 p-1.5">
                {filteredUsers.length === 0 ? (
                  <p className="text-center py-4 text-[11px] text-[#7f91a4]">
                    لا يوجد مستخدمون آخرون لإضافتهم حالياً
                  </p>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelected = selectedUserIds.includes(u.uid);
                    return (
                      <button
                        type="button"
                        key={u.uid}
                        onClick={() => toggleMember(u.uid)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl transition-colors text-right cursor-pointer ${
                          isSelected
                            ? 'bg-[#2481cc]/20 border border-[#2481cc]/40'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] text-white overflow-hidden shrink-0 bg-gradient-to-tr ${getAvatarGradient(
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
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{u.displayName}</div>
                            <div className="text-[10px] text-[#7f91a4] font-mono" dir="ltr">
                              @{u.username}
                            </div>
                          </div>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                            isSelected
                              ? 'bg-[#2481cc] border-[#2481cc] text-white'
                              : 'border-[#7f91a4]/40'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="w-full py-2.5 mt-2 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء المجموعة وإنشاء رابط الدعوة'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoinByInvite} className="space-y-4">
            <p className="text-xs text-[#7f91a4] leading-relaxed">
              الصق رابط الدعوة للمجموعة أو أدخل رمز الدعوة (مثال:{' '}
              <span className="font-mono text-[#2481cc]" dir="ltr">
                JNX-XXXX1234
              </span>
              ) للانضمام فوراً.
            </p>

            <div>
              <label className="block text-xs font-semibold mb-1.5 opacity-80">
                رابط أو رمز الدعوة
              </label>
              <input
                type="text"
                required
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                placeholder="https://.../?join=JNX-XXXX أو JNX-XXXX"
                dir="ltr"
                className={`w-full px-3.5 py-2.5 text-xs rounded-xl outline-hidden border font-mono ${
                  theme === 'light'
                    ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#2481cc]'
                    : 'bg-[#242f3d] border-[#2b3a4a] text-white focus:border-[#2481cc]'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !inviteInput.trim()}
              className="w-full py-2.5 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'جاري الانضمام...' : 'الانضمام للمجموعة الآن'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
