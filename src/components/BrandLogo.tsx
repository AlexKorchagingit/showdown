import type { CSSProperties } from 'react';
import { asset } from '../lib/assets';

interface BrandLogoProps {
  className?: string;
  alt?: string;
  style?: CSSProperties;
}

/** Prefer the much smaller WebP, with PNG fallback for older WebViews. */
export function BrandLogo({ className, alt = 'Showdown', style }: BrandLogoProps) {
  return (
    <img
      src={asset('/logo-final.webp')}
      alt={alt}
      draggable={false}
      fetchPriority="high"
      onError={(event) => {
        const image = event.currentTarget;
        const fallback = asset('/logo-final.png');
        if (image.src !== new URL(fallback, window.location.href).href) {
          image.src = fallback;
        }
      }}
      className={className}
      style={style}
    />
  );
}
