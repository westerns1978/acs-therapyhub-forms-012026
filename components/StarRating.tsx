
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

interface StarRatingProps {
  id: string;
  label: React.ReactNode;
  value: number | null;
  onChange: (value: number) => void;
  error?: string;
  required?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({ id, label, value, onChange, error, required = true }) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  return (
    <div className="mb-8 group">
      <label htmlFor={id} className="flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-3 px-1 group-focus-within:text-primary transition-colors">
        {label}
        {required && <span className="text-red-500 ml-1.5 opacity-50">*</span>}
      </label>
      <div className="flex items-center gap-2 text-amber-500">
        {[1, 2, 3, 4, 5].map((starValue) => (
          <motion.button
            key={starValue}
            type="button"
            onMouseEnter={() => setHoverValue(starValue)}
            onMouseLeave={() => setHoverValue(null)}
            onClick={() => onChange(starValue)}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            className="p-1 rounded-xl focus:outline-none focus:ring-4 focus:ring-amber-500/10 transition-all"
          >
            <Star
              size={32}
              className="transition-colors duration-200"
              fill={(hoverValue || value || 0) >= starValue ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={1.5}
            />
          </motion.button>
        ))}
        {value !== 0 && value !== null && (
          <span className="ml-4 text-sm font-black text-slate-400 uppercase tracking-widest">{value} / 5</span>
        )}
      </div>
      {error && <p className="mt-2 text-[10px] font-black text-red-500 uppercase tracking-widest ml-1">{error}</p>}
    </div>
  );
};
