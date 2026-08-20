import { useLayoutEffect, useRef, type ReactNode } from 'react';

/** Shrinks a single line to the container width. Never ellipsizes or overflows. */
export function FitText({
  children,
  className,
  maxPx = 40,
}: {
  children: ReactNode;
  className?: string;
  maxPx?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return;

    const fit = () => {
      inner.style.transform = 'scale(1)';
      const available = box.clientWidth;
      const width = inner.scrollWidth;
      if (available <= 0 || width <= 0) return;
      inner.style.transform = `scale(${Math.min(1, available / width)})`;
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [children, maxPx]);

  return (
    <div
      ref={boxRef}
      className="@container mt-2 w-full min-w-0 overflow-hidden flex justify-center items-center h-[2.6rem]"
      style={{ containerType: 'inline-size' }}
    >
      <div
        ref={innerRef}
        className={`font-black leading-none tabular-nums whitespace-nowrap text-center origin-center ${className ?? ''}`}
        style={{ fontSize: maxPx, transformOrigin: 'center center' }}
      >
        {children}
      </div>
    </div>
  );
}
