import React from 'react';
import { Brain } from 'lucide-react';

const GemyndFlowLogo: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`} {...props}>
        <img 
          src="https://storage.googleapis.com/gemynd-public/projects/acs-therapyhub/ACS-Logo1.svg" 
          alt="ACS TherapyHub" 
          className="h-8"
        />
    </div>
  );
};

export default GemyndFlowLogo;