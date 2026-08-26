import type { CSSProperties } from 'react';
import { asset } from '../lib/assets';

interface BrandLogoProps {
  className?: string;
  alt?: string;
  style?: CSSProperties;
}

/** Club mark as PNG so desktop browsers/WebViews that choke on VP8X WebP still show it. */
export function BrandLogo({ className, alt = 'Showdown', style }: BrandLogoProps) {
  return (
    <img
      src={asset('/logo-final.png')}
      alt={alt}
      draggable={false}
      className={className}
      style={style}
    />
  );
}
