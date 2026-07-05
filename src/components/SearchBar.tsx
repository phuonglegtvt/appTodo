/** Ô tìm kiếm việc theo tiêu đề — có icon kính lúp, bám mockup top bar. */
export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5 transition-colors duration-150 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30 dark:border-border-dark dark:bg-surface-2dark dark:focus-within:border-primary-dark dark:focus-within:ring-primary-dark/30">
      <span className="text-sm text-text-muted dark:text-text-muted-dark">⌕</span>
      <input
        type="search"
        placeholder="Tìm kiếm việc..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-muted dark:text-text-dark dark:placeholder:text-text-muted-dark"
      />
    </div>
  );
}
