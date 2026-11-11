import React, { useState } from 'react';
import { X, Users, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

interface NewGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewGroupModal: React.FC<NewGroupModalProps> = ({ isOpen, onClose }) => {
  const { theme, currentUser, userProfile } = useAuth();
  const { createChat } = useChat();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await createChat({
        type: 'group',
        title: title.trim(),
        description: description.trim() || 'مجموعة جديدة في تيليجرام',
        photoURL: photoURL.trim(),
        avatarColor: '#41a76c',
        memberIds: [currentUser?.uid || ''],
        membersCount: 1,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <Users className="w-5 h-5 text-[#2481cc]" />
            <span>مجموعة جديدة</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#7f91a4] hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold mb-1 opacity-80">اسم المجموعة</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: نقاشات التقنية والتصميم"
              className={`w-full px-3.5 py-2.5 text-sm rounded-xl outline-hidden border ${
                theme === 'light'
                  ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#2481cc]'
                  : 'bg-[#242f3d] border-[#2b3a4a] text-white focus:border-[#2481cc]'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 opacity-80">
              الوصف (اختياري)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف مختصر لموضوع المجموعة وقواعدها..."
              className={`w-full px-3.5 py-2 text-sm rounded-xl outline-hidden border resize-none ${
                theme === 'light'
                  ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#2481cc]'
                  : 'bg-[#242f3d] border-[#2b3a4a] text-white focus:border-[#2481cc]'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 opacity-80">
              رابط صورة للمجموعة (اختياري)
            </label>
            <input
              type="url"
              value={photoURL}
              onChange={(e) => setPhotoURL(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              dir="ltr"
              className={`w-full px-3.5 py-2 text-xs rounded-xl outline-hidden border font-mono ${
                theme === 'light'
                  ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#2481cc]'
                  : 'bg-[#242f3d] border-[#2b3a4a] text-white focus:border-[#2481cc]'
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 mt-2 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white font-bold text-xs shadow-md transition-all hover:scale-[1.01] cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء المجموعة'}
          </button>
        </form>
      </div>
    </div>
  );
};
