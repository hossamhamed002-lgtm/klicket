import React, { useEffect, useRef, useState } from 'react';
import { Plus, UserPlus, User, FileText, Receipt } from 'lucide-react';

interface QuickActionItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const DEFAULT_ACTIONS: QuickActionItem[] = [
  { id: 'new-parent', label: 'ولي امر جديد', icon: <UserPlus className="w-8 h-8 text-[#4f7dd8]" /> },
  { id: 'new-student', label: 'طالب جديد', icon: <User className="w-8 h-8 text-[#4f7dd8]" /> },
  { id: 'new-form', label: 'نموذج جديد', icon: <FileText className="w-8 h-8 text-[#e0b322]" /> },
  { id: 'new-invoice', label: 'فاتورة جديدة', icon: <Receipt className="w-8 h-8 text-[#ef6b58]" /> },
];

interface FloatingQuickActionsProps {
  onActionClick?: (actionId: string) => void;
}

export const FloatingQuickActions: React.FC<FloatingQuickActionsProps> = ({ onActionClick }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  return (
    <div ref={containerRef} className="fixed bottom-8 left-8 z-40" dir="rtl">
      {open && (
        <div className="absolute bottom-0 left-24 w-[420px] max-w-[calc(100vw-7rem)] bg-white border border-gray-200 rounded-xl shadow-2xl p-8">
          <div className="space-y-8">
            {DEFAULT_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  onActionClick?.(action.id);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between text-right hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
              >
                {action.icon}
                <span className="text-[44px] leading-none font-semibold text-[#4c4c56]">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-28 h-28 rounded-full bg-gradient-to-br from-[#6f2eea] to-[#8a42ff] text-white shadow-lg shadow-purple-500/30 flex items-center justify-center hover:scale-105 transition-transform"
        aria-label="إظهار قائمة الإجراءات"
      >
        <Plus className="w-14 h-14" />
      </button>
    </div>
  );
};
