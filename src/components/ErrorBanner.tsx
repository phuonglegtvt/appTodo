interface Props {
  message: string;
  onClose?: () => void;
}

/** Banner báo lỗi rõ ràng cho người dùng (không nuốt lỗi im lặng). */
export function ErrorBanner({ message, onClose }: Props) {
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
    >
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="font-bold" aria-label="Đóng">
          ×
        </button>
      )}
    </div>
  );
}
