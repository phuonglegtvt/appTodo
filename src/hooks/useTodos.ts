import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Todo, NewTodo, TodoUpdate } from '../types/todo';

interface UseTodos {
  todos: Todo[];
  loading: boolean;
  error: string | null;
  addTodo: (input: NewTodo) => Promise<void>;
  updateTodo: (id: string, patch: TodoUpdate) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  reorderTodos: (ordered: Todo[]) => Promise<void>;
  clearError: () => void;
}

export function useTodos(userId: string): UseTodos {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tải lần đầu.
  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from('todos')
      .select('*')
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Lỗi tải việc:', error);
          setError('Không tải được danh sách việc: ' + error.message);
        } else {
          setTodos((data ?? []) as Todo[]);
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  // Đồng bộ realtime: nghe thay đổi trên bảng todos của user này.
  useEffect(() => {
    const channel = supabase
      .channel('todos-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todos', filter: `user_id=eq.${userId}` },
        (payload) => {
          setTodos((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as Todo;
              if (prev.some((t) => t.id === row.id)) return prev;
              return [...prev, row];
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as Todo;
              return prev.map((t) => (t.id === row.id ? row : t));
            }
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { id: string };
              return prev.filter((t) => t.id !== old.id);
            }
            return prev;
          });
        },
      )
      .subscribe((status, err) => {
        // Không nuốt lỗi im lặng: CRUD dựa vào echo realtime để cập nhật UI, nên nếu
        // kênh rớt phải báo cho người dùng, không để họ thao tác mà "không thấy gì".
        const s = String(status);
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          console.error('Lỗi kênh đồng bộ realtime:', status, err);
          setError('Mất kết nối đồng bộ thời gian thực — hãy tải lại trang.');
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addTodo = useCallback(
    async (input: NewTodo) => {
      const maxOrder = todos.reduce((m, t) => Math.max(m, t.sort_order), 0);
      const { error } = await supabase.from('todos').insert({
        user_id: userId,
        title: input.title,
        notes: input.notes ?? null,
        due_date: input.due_date ?? null,
        priority: input.priority ?? 'medium',
        tags: input.tags ?? [],
        sort_order: maxOrder + 1,
      });
      if (error) {
        console.error('Lỗi thêm việc:', error);
        setError('Không thêm được việc: ' + error.message);
      }
    },
    [todos, userId],
  );

  const updateTodo = useCallback(async (id: string, patch: TodoUpdate) => {
    const { error } = await supabase.from('todos').update(patch).eq('id', id);
    if (error) {
      console.error('Lỗi cập nhật việc:', error);
      setError('Không cập nhật được việc: ' + error.message);
    }
  }, []);

  const deleteTodo = useCallback(async (id: string) => {
    const { error } = await supabase.from('todos').delete().eq('id', id);
    if (error) {
      console.error('Lỗi xóa việc:', error);
      setError('Không xóa được việc: ' + error.message);
    }
  }, []);

  // Cập nhật lạc quan thứ tự, rồi lưu sort_order mới lên server. Gán luôn sort_order
  // mới vào state để UI giữ đúng thứ tự ngay (nếu không, sortByOrder ở tầng trên đọc
  // sort_order cũ và kéo danh sách nhảy về chỗ cũ cho tới khi echo realtime về).
  const reorderTodos = useCallback(async (ordered: Todo[]) => {
    setTodos(ordered.map((t, index) => ({ ...t, sort_order: index + 1 })));
    const updates = ordered.map((t, index) =>
      supabase.from('todos').update({ sort_order: index + 1 }).eq('id', t.id),
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error('Lỗi lưu thứ tự:', failed.error);
      setError('Không lưu được thứ tự mới: ' + failed.error.message);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { todos, loading, error, addTodo, updateTodo, deleteTodo, reorderTodos, clearError };
}
