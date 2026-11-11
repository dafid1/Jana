import React, { useState } from 'react';
import { X, BarChart2, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { PollData, PollOption } from '../../types/telegram';

interface PollModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PollModal: React.FC<PollModalProps> = ({ isOpen, onClose }) => {
  const { theme } = useAuth();
  const { sendMessage } = useChat();

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['نعم، رائع جداً!', 'جيد، لكن يحتاج تحسينات', '']);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [multipleAnswers, setMultipleAnswers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleOptionChange = (index: number, val: string) => {
    const updated = [...options];
    updated[index] = val;
    setOptions(updated);
  };

  const handleAddOption = () => {
    if (options.length < 8) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuestion = question.trim();
    const validOptions = options.map((o) => o.trim()).filter(Boolean);

    if (!cleanQuestion || validOptions.length < 2) return;

    setIsSubmitting(true);
    try {
      const pollOptions: PollOption[] = validOptions.map((text, idx) => ({
        id: `opt_${Date.now()}_${idx}`,
        text,
        votes: [],
      }));

      const pollData: PollData = {
        question: cleanQuestion,
        options: pollOptions,
        isAnonymous,
        multipleAnswers,
        totalVotes: 0,
      };

      await sendMessage(cleanQuestion, 'poll', {
        pollData,
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
            <BarChart2 className="w-5 h-5 text-[#2481cc]" />
            <span>إنشاء استطلاع رأي</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#7f91a4] hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1 opacity-80">سؤال الاستطلاع</label>
            <input
              type="text"
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="اكتب سؤالك هنا..."
              className={`w-full px-3.5 py-2.5 text-sm rounded-xl outline-hidden border ${
                theme === 'light'
                  ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#2481cc]'
                  : 'bg-[#242f3d] border-[#2b3a4a] text-white focus:border-[#2481cc]'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 opacity-80">خيارات التصويت</label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => handleOptionChange(i, e.target.value)}
                    placeholder={`الخيار ${i + 1}`}
                    className={`flex-1 px-3 py-2 text-xs rounded-xl outline-hidden border ${
                      theme === 'light'
                        ? 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#2481cc]'
                        : 'bg-[#242f3d] border-[#2b3a4a] text-white focus:border-[#2481cc]'
                    }`}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(i)}
                      className="p-2 text-[#7f91a4] hover:text-red-400 hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 8 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-2 text-xs text-[#2481cc] font-semibold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة خيار آخر</span>
              </button>
            )}
          </div>

          {/* Settings Switches */}
          <div className="space-y-2 pt-2 border-t border-white/10 text-xs">
            <div className="flex items-center justify-between">
              <span>تصويت مجهول الهوية</span>
              <button
                type="button"
                onClick={() => setIsAnonymous(!isAnonymous)}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                  isAnonymous ? 'bg-[#2481cc]' : 'bg-gray-400'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform ${
                    isAnonymous ? '-translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span>السماح باختيارات متعددة</span>
              <button
                type="button"
                onClick={() => setMultipleAnswers(!multipleAnswers)}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                  multipleAnswers ? 'bg-[#2481cc]' : 'bg-gray-400'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-xs transform transition-transform ${
                    multipleAnswers ? '-translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl bg-[#2481cc] hover:bg-[#2172b5] text-white font-bold text-xs shadow-md transition-all hover:scale-[1.01] cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'جاري النشر...' : 'إرسال الاستطلاع'}
          </button>
        </form>
      </div>
    </div>
  );
};
