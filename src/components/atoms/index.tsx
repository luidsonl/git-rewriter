import { ReactNode } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// ─── Button ────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost';
  size?: 'sm' | 'md';
  children: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        'flex items-center justify-center gap-2 font-medium rounded-md transition-colors',
        variant === 'primary' && 'bg-white text-black hover:bg-neutral-200',
        variant === 'ghost' && 'text-neutral-400 hover:text-white hover:bg-neutral-900',
        size === 'md' && 'px-4 py-2 text-sm',
        size === 'sm' && 'px-2 py-1 text-xs',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

// ─── TextInput ──────────────────────────────────────────────────────────────
interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
}

export function TextInput({ icon, className, ...rest }: TextInputProps) {
  return (
    <div className="relative">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none">
          {icon}
        </span>
      )}
      <input
        className={cn(
          'w-full bg-neutral-900 border border-neutral-800 rounded-md py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors',
          icon ? 'pl-9 pr-4' : 'px-4',
          className
        )}
        {...rest}
      />
    </div>
  );
}

// ─── Avatar ─────────────────────────────────────────────────────────────────
interface AvatarProps {
  name: string;
  size?: 'sm' | 'md';
}

export function Avatar({ name, size = 'md' }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className={cn(
        'rounded-full bg-neutral-800 flex items-center justify-center text-neutral-300 font-medium shrink-0',
        size === 'md' && 'w-8 h-8 text-xs',
        size === 'sm' && 'w-6 h-6 text-[10px]'
      )}
    >
      {initials}
    </div>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────
interface BadgeProps {
  children: ReactNode;
  variant?: 'neutral' | 'mono';
}

export function Badge({ children, variant = 'neutral' }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-block rounded px-1.5 py-0.5 text-xs',
        variant === 'neutral' && 'bg-neutral-800 text-neutral-300',
        variant === 'mono' && 'bg-neutral-900 text-neutral-400 font-mono'
      )}
    >
      {children}
    </span>
  );
}

// ─── PageTitle ───────────────────────────────────────────────────────────────
export function PageTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-2xl font-light text-white mb-6">{children}</h2>;
}
