import { useEffect, useState } from 'react';

const STORAGE_KEY = 'apptodo-sidebar-collapsed';

/** Trạng thái thu gọn sidebar (desktop), nhớ qua localStorage. */
export function useSidebarCollapsed(): { collapsed: boolean; toggle: () => void } {
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem(STORAGE_KEY) === '1',
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const toggle = () => setCollapsed((c) => !c);
  return { collapsed, toggle };
}
