import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  title?: string;
  'aria-label'?: string;
  'aria-pressed'?: boolean;
  onClick?: () => void;
};

/**
 * Hit target that is not a native `<button>`. Android / Telegram WebView paints a
 * two-tone gloss over `<button>` even with `appearance: none`.
 */
export function FlatHit({
  children,
  className,
  style,
  disabled,
  title,
  onClick,
  'aria-label': ariaLabel,
  'aria-pressed': ariaPressed,
}: Props) {
  const activate = () => {
    if (disabled) return;
    onClick?.();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    activate();
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      title={title}
      className={['tma-flat', className].filter(Boolean).join(' ')}
      style={{
        ...style,
        backgroundImage: 'none',
        boxShadow: 'none',
      }}
      onClick={activate}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
