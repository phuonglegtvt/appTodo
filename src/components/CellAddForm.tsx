import { useState } from 'react';

interface Props {
  onAdd: (title: string) => void;
}

/** Nút "+ thêm việc" nhỏ trong ô lịch; bấm để hiện ô nhập, Enter để thêm. */
export function CellAddForm({ onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd(t);
    setTitle('');
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-auto self-start px-1 text-[10px] text-text-muted transition hover:text-primary dark:text-text-muted-dark dark:hover:text-primary-dark"
      >
        + thêm việc
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-auto">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title.trim() === '' && setOpen(false)}
        placeholder="Việc mới…"
        aria-label="Thêm việc"
        className="w-full rounded border border-border bg-surface px-1.5 py-0.5 text-[12px] text-text outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark dark:text-text-dark"
      />
    </form>
  );
}
