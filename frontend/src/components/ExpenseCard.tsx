import { useState } from 'react';
import type { Expense } from '../types';
import { CATEGORY_META } from '../types';
import CategoryBadge from './CategoryBadge';

interface Props {
  expense: Expense;
  onDelete: (id: string) => Promise<void>;
}

export default function ExpenseCard({ expense, onDelete }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const meta = CATEGORY_META[expense.category];

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    await onDelete(expense.id);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('lt-LT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div
      className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border ${meta.border} ${meta.bg}
                  transition-all duration-200 hover:shadow-sm group animate-slide-up`}
    >
      {/* Category icon */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-xl sm:text-2xl">
          {meta.emoji}
        </div>
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <CategoryBadge category={expense.category} size="sm" />
        </div>
        {expense.note && (
          <p className="text-sm text-stone-600 truncate mt-0.5">{expense.note}</p>
        )}
        <p className="text-xs text-stone-400 mt-1">{formatDate(expense.date)}</p>
      </div>

      {/* Amount */}
      <div className="flex-shrink-0 flex flex-col items-end gap-2">
        <span className="text-lg sm:text-xl font-bold text-stone-900">
          {expense.amount.toFixed(2)} €
        </span>

        {/* Delete */}
        {confirmDelete ? (
          <div className="flex gap-1.5">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs bg-red-500 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {deleting ? '...' : 'Taip'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs bg-white text-stone-600 px-2.5 py-1 rounded-lg font-medium hover:bg-stone-50 border border-stone-200 transition-colors"
            >
              Ne
            </button>
          </div>
        ) : (
          <button
            onClick={handleDelete}
            className="text-stone-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Ištrinti"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
