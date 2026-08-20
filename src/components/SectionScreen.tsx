import type { ReactNode } from 'react';
import { CompactHeader } from './CompactHeader';

interface Props {
  title: string;
  backTo: string;
  children?: ReactNode;
  contentPaddingBottom?: string;
  right?: ReactNode;
  centerTitle?: boolean;
  headerClassName?: string;
}

/** Full-screen shell with a compact back + title row. */
export function SectionScreen({
  title,
  backTo,
  children,
  contentPaddingBottom,
  right,
  centerTitle,
  headerClassName,
}: Props) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <CompactHeader
        title={title}
        backTo={backTo}
        right={right}
        centerTitle={centerTitle}
        className={headerClassName}
      />

      <div
        className="flex-1 scrollable px-5"
        style={{
          paddingBottom:
            contentPaddingBottom ?? 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
        }}
      >
        {children ?? (
          <p className="text-center text-[13px] font-500 pt-8" style={{ color: '#6B6360' }}>
            Раздел находится в разработке
          </p>
        )}
      </div>
    </div>
  );
}
