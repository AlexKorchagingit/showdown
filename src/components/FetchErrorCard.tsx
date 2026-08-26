export function FetchErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-4 px-6 text-center">
      <p className="text-[13px] font-500 leading-relaxed" style={{ color: '#6B6360' }}>
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="px-5 py-2.5 rounded-xl text-[13px] font-700 text-[#0A0908] active:scale-[0.98]"
        style={{
          background: 'linear-gradient(to right, #8C4C27, #D99962)',
          boxShadow: '0 0 16px rgba(217,153,98,0.28)',
        }}
      >
        Повторить загрузку
      </button>
    </div>
  );
}
