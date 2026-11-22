import React, { useState } from 'react';
import { X, MessageSquare, Search, Shield, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { getAvatarGradient, getInitials } from '../../utils/telegramHelpers';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdminUsers?: () => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  onClose,
  onOpenAdminUsers,
}) => {
  const { theme, currentUser, allUsers, isAdmin } = useAuth();
  const { startDirectChat } = useChat();

  const [queryText, setQueryText] = useState('');
  const [startingUid, setStartingUid] = useState<string | null>(null);

  if (!isOpen) return null;

  const otherUsers = allUsers.filter((u) => u.uid !== currentUser?.uid);
  const filteredUsers = otherUsers.filter((u) => {
    if (!queryText.trim()) return true;
    const q = queryText.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.bio || '').toLowerCase().includes(q)
    );
  });

  const handleSelectUser = async (userId: string) => {
    const target = otherUsers.find((u) => u.uid === userId);
    if (!target) return;
    setStartingUid(userId);
    try {
      await startDirectChat(target);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setStartingUid(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none">
      <div
        className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border text-right transition-all max-h-[85vh] flex flex-col ${
          theme === 'light'
            ? 'bg-white border-gray-200 text-gray-900'
            : 'bg-[#17212b] border-[#2b3a4a] text-white'
        }`}
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-base font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#2481cc]" />
            <span>محادثة خاصة جديدة</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#7f91a4] hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Registered Users */}
        <div className="relative mb-4 shrink-0">
          <Search className="w-4 h-4 text-[#7f91a4] absolute right-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="ابحث بالاسم أو اسم المستخدم..."
            className={`w-full pr-10 pl-3.5 py-2.5 text-xs rounded-xl outline-hidden border ${
              theme === 'light'
                ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#2481cc]'
                : 'bg-[#242f3d] border-[#2b3a4a] text-white focus:border-[#2481cc]'
            }`}
          />
        </div>

        {/* Real Registered Users List */}
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-8 px-4">
              <p className="text-xs font-semibold mb-1.5">
                {otherUsers.length === 0
                  ? 'لا توجد حسابات أخرى مسجلة بعد'
                  : 'لم يتم العثور على مستخدم بهذا الاسم'}
              </p>
              <p className="text-[11px] text-[#7f91a4] leading-relaxed">
                {isAdmin
                  ? 'يمكنك إنشاء حسابات جديدة للمستخدمين من لوحة الأدمن ليتمكنوا من المراسلة.'
                  : 'يقوم الأدمن بإنشاء الحسابات الجديدة لتظهر هنا تلقائياً.'}
              </p>
              {isAdmin && onOpenAdminUsers && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenAdminUsers();
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white text-xs font-bold cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>إنشاء حسابات جديدة</span>
                </button>
              )}
            </div>
          ) : (
            filteredUsers.map((user) => (
              <button
                key={user.uid}
                disabled={startingUid === user.uid}
                onClick={() => handleSelectUser(user.uid)}
                className={`w-full flex items-center justify-between p-2.5 rounded-2xl transition-colors text-right cursor-pointer disabled:opacity-50 ${
                  theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs text-white overflow-hidden bg-gradient-to-tr ${getAvatarGradient(
                        user.uid
                      )}`}
                    >
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{getInitials(user.displayName)}</span>
                      )}
                    </div>
                    {user.isOnline && (
                      <div className="absolute bottom-0 left-0 w-3 h-3 bg-emerald-500 border-2 border-[#17212b] rounded-full" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold truncate">{user.displayName}</span>
                      {user.role === 'admin' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-[#2481cc]/20 text-[#2481cc] text-[10px] font-bold">
                          <Shield className="w-2.5 h-2.5" />
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#7f91a4] font-mono truncate" dir="ltr">
                      {user.phone && user.username.startsWith('p_')
                        ? user.phone
                        : `@${user.username}`}
                    </div>
                  </div>
                </div>

                <span className="text-[11px] text-[#2481cc] font-bold shrink-0 px-2">
                  {startingUid === user.uid ? 'جاري الفتح...' : 'مراسلة'}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
