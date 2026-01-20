import React from 'react';
import { Brain } from 'lucide-react';

const GemyndFlowLogo: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`} {...props}>
        <div className="bg-gradient-to-br from-[#8B1E24] to-[#70181D] p-1.5 rounded-xl shadow-lg shadow-primary/20">
            <Brain className="text-white w-6 h-6" />
        </div>
        <span className="text-xl font-black tracking-tighter text-slate-900 dark:text-white">
            GeMynd<span className="text-primary">Flow</span>
        </span>
    </div>
  );
};

export default GemyndFlowLogo;