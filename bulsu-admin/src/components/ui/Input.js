// Input component - shadcn/ui style
import React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:border-maroon-800 focus-visible:ring-2 focus-visible:ring-maroon-800/20 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[100px] w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:border-maroon-800 focus-visible:ring-2 focus-visible:ring-maroon-800/20 disabled:cursor-not-allowed disabled:opacity-50 resize-y',
        className
      )}
      {...props}
    />
  );
});

Textarea.displayName = 'Textarea';

export default Input;
