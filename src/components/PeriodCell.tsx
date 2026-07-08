interface Props {
  label: string;
  doneCount: number;
  totalCount: number;
  tooltipLines: string[];
  onSelect: () => void;
}

/**
 * 1 ô trong lưới. Hover (desktop, CSS `group-hover` thuần) hiện tooltip xem
 * trước; bấm/chạm luôn gọi onSelect để đi xuống tầng con — trên thiết bị cảm
 * ứng không có hover nên chạm đi thẳng vào tầng con, không cần logic riêng.
 */
export function PeriodCell({ label, doneCount, totalCount, tooltipLines, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex flex-col items-center gap-0.5 rounded-lg border border-border bg-surface px-1 py-1.5 text-center text-xs transition-colors hover:border-primary dark:border-border-dark dark:bg-surface-dark dark:hover:border-primary-dark"
    >
      <span className="font-medium text-text dark:text-text-dark">{label}</span>
      {totalCount > 0 && (
        <span className="text-[10px] text-text-muted dark:text-text-muted-dark">
          {doneCount}/{totalCount}
        </span>
      )}
      {tooltipLines.length > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden w-44 -translate-x-1/2 rounded-lg border border-border bg-surface p-2 text-left text-[11px] shadow-md group-hover:block dark:border-border-dark dark:bg-surface-dark dark:shadow-md-dark">
          {tooltipLines.map((line, i) => (
            <div key={i} className="truncate text-text dark:text-text-dark">
              {line}
            </div>
          ))}
        </div>
      )}
    </button>
  );
}
