import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Goal, NewGoal, GoalUpdate } from '../types/goal';

interface UseGoals {
  goals: Goal[];
  loading: boolean;
  error: string | null;
  addGoal: (input: NewGoal) => Promise<void>;
  updateGoal: (id: string, patch: GoalUpdate) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  clearError: () => void;
}

export function useGoals(userId: string): UseGoals {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tải lần đầu.
  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from('goals')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Lỗi tải mục tiêu:', error);
          setError('Không tải được danh sách mục tiêu: ' + error.message);
        } else {
          setGoals((data ?? []) as Goal[]);
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  // Đồng bộ realtime: nghe thay đổi trên bảng goals của user này.
  useEffect(() => {
    const channel = supabase
      .channel('goals-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'goals', filter: `user_id=eq.${userId}` },
        (payload) => {
          setGoals((prev) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as Goal;
              if (prev.some((g) => g.id === row.id)) return prev;
              return [...prev, row];
            }
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as Goal;
              return prev.map((g) => (g.id === row.id ? row : g));
            }
            if (payload.eventType === 'DELETE') {
              const old = payload.old as { id: string };
              return prev.filter((g) => g.id !== old.id);
            }
            return prev;
          });
        },
      )
      .subscribe((status, err) => {
        const s = String(status);
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          console.error('Lỗi kênh đồng bộ realtime (goals):', status, err);
          setError('Mất kết nối đồng bộ thời gian thực — hãy tải lại trang.');
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addGoal = useCallback(
    async (input: NewGoal) => {
      const { error } = await supabase.from('goals').insert({
        user_id: userId,
        horizon: input.horizon,
        period_key: input.period_key,
        title: input.title,
      });
      if (error) {
        console.error('Lỗi thêm mục tiêu:', error);
        setError('Không thêm được mục tiêu: ' + error.message);
      }
    },
    [userId],
  );

  const updateGoal = useCallback(async (id: string, patch: GoalUpdate) => {
    const { error } = await supabase.from('goals').update(patch).eq('id', id);
    if (error) {
      console.error('Lỗi cập nhật mục tiêu:', error);
      setError('Không cập nhật được mục tiêu: ' + error.message);
    }
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) {
      console.error('Lỗi xóa mục tiêu:', error);
      setError('Không xóa được mục tiêu: ' + error.message);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { goals, loading, error, addGoal, updateGoal, deleteGoal, clearError };
}
