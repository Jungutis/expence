import type { ExpenseCategory } from '../types';
import { CATEGORY_META } from '../types';

interface Props {
  category: ExpenseCategory;
  size?: 'sm' | 'md' | 'lg';
}

export default function CategoryBadge({ category, size = 'md' }: Props) {
  const meta = CATEGORY_META[category];

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-3 py-1 gap-1.5',
    lg: 'text-base px-4 py-1.5 gap-2',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${meta.bg} ${meta.color} ${meta.border} ${sizeClasses[size]}`}
    >
      <span>{meta.emoji}</span>
      <span>{meta.label}</span>
    </span>
  );
}
