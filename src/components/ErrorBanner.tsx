interface Props {
  message: string;
  onClose?: () => void;
}

/** Banner báo lỗi rõ ràng cho người dùng (không nuốt lỗi im lặng). */
export function ErrorBanner({ message, onClose }: Props) {
  return (
    <div
      role="alert"
      style={{ borderLeftColor: '#E5484D' }}
      className="flex items-start justify-between gap-3 rounded-lg border border-l-[3px] border-border bg-surface px-4 py-3 text-sm text-red-800 shadow-soft dark:border-border-dark dark:bg-surface-dark dark:text-red-200 dark:shadow-soft-dark"
    >
      <span className="flex items-start gap-2">
        <span aria-hidden="true">⚠</span>
        {message}
      </span>
      {onClose && (
        <button onClick={onClose} className="font-bold" aria-label="Đóng">
          ×
        </button>
      )}
    </div>
  );
}
