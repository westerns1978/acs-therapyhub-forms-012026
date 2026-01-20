import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className = '', maxWidth = 'max-w-2xl' }) => {
  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in-up" 
        role="dialog" 
        aria-modal="true" 
        style={{ animationDuration: '0.25s' }}
    >
      <div 
        className={`bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col border border-white/20 dark:border-slate-700 transform transition-all ${className}`}
        onClick={e => e.stopPropagation()}
      >
        {(title || onClose) && (
            <header className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
                {title && <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{title}</h2>}
                <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 transition-all">
                    <X size={20} />
                </button>
            </header>
        )}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;