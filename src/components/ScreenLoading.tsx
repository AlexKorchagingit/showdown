export function ScreenLoading({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[12rem] items-center justify-center px-5">
      <p className="text-[13px] font-500" style={{ color: '#6B6360' }}>
        {label}
      </p>
    </div>
  );
}
