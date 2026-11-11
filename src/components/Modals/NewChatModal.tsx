import React, { useState } from 'react';
import { X, MessageSquare, Search, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({ isOpen, onClose }) => {
  const { theme, currentUser } = useAuth();
  const { createChat } = useChat();

  const [contactName, setContactName] = useState('');
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim()) return;

    setIsSubmitting(true);
    try {
      const targetUserId = `user_${Date.now()}`;
      await createChat({
        type: 'direct',
        title: contactName.trim(),
        avatarColor: '#2481cc',
        description: `محادثة خاصة مع ${contactName.trim()}`,
        memberIds: [currentUser?.uid || '', targetUserId],
        membersCount: 2,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sampleContacts = [
    { name: 'عمر التميمي', username: '@omar_tech', bio: 'مطور واجهات ومصمم تجارب مستخدم' },
    { name: 'ليلى الأحمد', username: '@layla_ahmed', bio: 'مهندسة برمجيات سحابية' },
    { name: 'خالد السعيد', username: '@khaled_saeed', bio: 'خبير ذكاء اصطناعي وأمن سيبراني' },
    { name: 'فاطمة الزهراء', username: '@fatima_z', bio: 'مديرة منتجات تقنية' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none">
      <div
        className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border text-right transition-all ${
          theme === 'light'
            ? 'bg-white border-gray-200 text-gray-900'
            : 'bg-[#17212b] border-[#2b3a4a] text-white'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#2481cc]" />
            <span>محادثة جديدة</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#7f91a4] hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-semibold mb-1 opacity-80">اسم جهة الاتصال</label>
            <input
              type="text"
              required
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="مثال: صالح الأحمد"
              className={`w-full px-3.5 py-2.5 text-sm rounded-xl outline-hidden border ${
                theme === 'light'
                  ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#2481cc]'
                  : 'bg-[#242f3d] border-[#2b3a4a] text-white focus:border-[#2481cc]'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 opacity-80">
              اسم المستخدم (اختياري)
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@saleh_dev"
              dir="ltr"
              className={`w-full px-3.5 py-2.5 text-sm rounded-xl outline-hidden border font-mono ${
                theme === 'light'
                  ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#2481cc]'
                  : 'bg-[#242f3d] border-[#2b3a4a] text-white focus:border-[#2481cc]'
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white font-bold text-xs shadow-md transition-all hover:scale-[1.01] cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'جاري الإنشاء...' : 'بدء المحادثة'}
          </button>
        </form>

        {/* Suggested Contacts */}
        <div className="border-t border-white/10 pt-3">
          <p className="text-xs font-semibold text-[#7f91a4] mb-2">أو اختر من جهات الاتصال المقترحة:</p>
          <div className="space-y-1.5 max-h-44 overflow-y-auto">
            {sampleContacts.map((c) => (
              <button
                key={c.username}
                onClick={async () => {
                  await createChat({
                    type: 'direct',
                    title: c.name,
                    avatarColor: '#2481cc',
                    description: c.bio,
                    memberIds: [currentUser?.uid || '', c.username],
                    membersCount: 2,
                  });
                  onClose();
                }}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors text-right cursor-pointer"
              >
                <div>
                  <div className="text-xs font-bold leading-tight">{c.name}</div>
                  <div className="text-[11px] text-[#7f91a4] font-mono" dir="ltr">
                    {c.username}
                  </div>
                </div>
                <span className="text-[11px] text-[#2481cc] font-medium">مراسلة</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
