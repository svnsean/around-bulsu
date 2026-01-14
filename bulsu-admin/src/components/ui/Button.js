// Button component - shadcn/ui style
import React from 'react';
import { cn } from '../../lib/utils';

const buttonVariants = {
  default: 'bg-maroon-800 text-white hover:bg-maroon-900 shadow-sm',
  destructive: 'bg-red-500 text-white hover:bg-red-600 shadow-sm',
  outline: 'border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300',
  secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
  ghost: 'hover:bg-gray-100',
  link: 'text-maroon-800 underline-offset-4 hover:underline',
  gold: 'bg-gold-400 text-maroon-900 hover:bg-gold-500 shadow-sm font-semibold',
};

const buttonSizes = {
  default: 'h-10 px-4 py-2',
  sm: 'h-8 rounded-md px-3 text-sm',
  lg: 'h-12 rounded-lg px-8 text-lg',
  icon: 'h-10 w-10',
};

export const Button = React.forwardRef(({ 
  className, 
  variant = 'default', 
  size = 'default', 
  children,
  ...props 
}, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-800 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
