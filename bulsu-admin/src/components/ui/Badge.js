// Badge component - shadcn/ui style
import React from 'react';
import { cn } from '../../lib/utils';

const badgeVariants = {
  default: 'bg-maroon-800 text-white',
  secondary: 'bg-gray-100 text-gray-900',
  destructive: 'bg-red-100 text-red-700',
  outline: 'border-2 border-gray-200 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  gold: 'bg-gold-400 text-maroon-900',
};

export const Badge = React.forwardRef(({ 
  className, 
  variant = 'default',
  ...props 
}, ref) => {
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  );
});

Badge.displayName = 'Badge';

export default Badge;
