import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface StarRatingProps {
  id: string;
  label: React.ReactNode;
  value: number | null;
  onChange: (value: number) => void;
  error?: string;
  required?: boolean;
}

const Star: React.FC<{
  filled: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}> = ({ filled, onMouseEnter, onMouseLeave, onClick }) => (
  <motion.svg
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    onClick={onClick}
    className="w-10 h-10 cursor-pointer"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="1.5"
    whileHover={{ scale: 1.2 }}
    transition={{ type: 'spring', stiffness: 400, damping: 10 }}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
    />
  </motion.svg>
);

export const StarRating: React.FC<StarRatingProps> = ({ id, label, value, onChange, error, required = true }) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  return (
    <div className="mb-6">
      <label htmlFor={id} className="flex items-center text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="mt-2 flex items-center space-x-2 text-amber-500">
        {[1, 2, 3, 4, 5].map((starValue) => (
          <Star
            key={starValue}
            filled={(hoverValue || value || 0) >= starValue}
            onMouseEnter={() => setHoverValue(starValue)}
            onMouseLeave={() => setHoverValue(null)}
            onClick={() => onChange(starValue)}
          />
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-500 font-bold uppercase tracking-tighter">{error}</p>}
    </div>
  );
};
