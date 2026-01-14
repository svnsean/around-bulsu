// Modal/Dialog component - shadcn/ui style
import React from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

export const Modal = ({ open, onClose, children, className }) => {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0"
        onClick={onClose}
      />
      
      {/* Modal content */}
      <div
        className={cn(
          'relative z-50 w-full max-w-lg max-h-[90vh] overflow-auto rounded-xl bg-white shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

export const ModalHeader = ({ className, children, onClose, ...props }) => (
  <div className={cn('flex items-center justify-between p-6 pb-4 border-b border-gray-100', className)} {...props}>
    <div className="flex-1">{children}</div>
    {onClose && (
      <button 
        onClick={onClose}
        className="ml-4 rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <X size={20} />
      </button>
    )}
  </div>
);

export const ModalTitle = ({ className, ...props }) => (
  <h2 className={cn('text-xl font-semibold text-gray-900', className)} {...props} />
);

export const ModalDescription = ({ className, ...props }) => (
  <p className={cn('text-sm text-gray-500 mt-1', className)} {...props} />
);

export const ModalBody = ({ className, ...props }) => (
  <div className={cn('p-6', className)} {...props} />
);

export const ModalFooter = ({ className, ...props }) => (
  <div className={cn('flex items-center justify-end gap-3 p-6 pt-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl', className)} {...props} />
);

export default Modal;
