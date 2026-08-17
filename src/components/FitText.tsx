import { useLayoutEffect, useRef, type ReactNode } from 'react';

/** Shrinks a single line of text to the container width without ellipsis. */
export function FitText({
  children,
  className,
  maxPx = 40,
  minPx = 10,
}: {
  children: ReactNode;
  className?: string;
  maxPx?: number;
  minPx?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;

    const fit = () => {
      const box = boxRef.current;
      const text = textRef.current;
      if (!box || !text) return;
      const available = box.clientWidth;
      if (available <= 0) return;
      text.style.fontSize = `${maxPx}px`;
      if (text.scrollWidth <= available) return;

      let lo = minPx;
      let hi = maxPx;
      let best = minPx;
      for (let i = 0; i < 16; i += 1) {
        const mid = (lo + hi) / 2;
        text.style.fontSize = `${mid}px`;
        if (text.scrollWidth <= available) {
          best = mid;
          lo = mid;
        } else {
          hi = mid;
        }
      }
      text.style.fontSize = `${best}px`;
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [children, maxPx, minPx]);

  return (
    <div
      ref={boxRef}
      className="@container w-full overflow-hidden flex justify-center"
      style={{ containerType: 'inline-size' }}
    >
      <p
        ref={textRef}
        className={`font-black leading-none tabular-nums whitespace-nowrap text-center text-[length:min(2.5rem,15cqw)] ${className ?? ''}`}
      >
        {children}
      </p>
    </div>
  );
}
