export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => Promise<void>;
}) {
  return (
    <div className="rounded-[28px] border border-rose/40 bg-rose/10 p-5">
      <p className="text-sm font-semibold text-cream">에러 메시지</p>
      <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-cream/75">{message}</pre>
      {onRetry ? (
        <button
          type="button"
          onClick={() => void onRetry()}
          className="mt-4 rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold text-cream"
        >
          다시 시도
        </button>
      ) : null}
    </div>
  );
}
