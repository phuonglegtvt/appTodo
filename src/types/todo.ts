export type Priority = 'high' | 'medium' | 'low';
export type SmartView = 'today' | 'upcoming' | 'all' | 'done';
export type Recurrence = 'none' | 'weekly' | 'monthly' | 'yearly';

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  is_done: boolean;
  due_date: string | null; // 'YYYY-MM-DD'
  priority: Priority;
  tags: string[];
  recurrence: Recurrence;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Dữ liệu để tạo việc mới (server tự sinh id/user_id/timestamps). */
export interface NewTodo {
  title: string;
  notes?: string | null;
  due_date?: string | null;
  priority?: Priority;
  tags?: string[];
  recurrence?: Recurrence;
}

/** Các trường được phép sửa. */
export type TodoUpdate = Partial<
  Pick<
    Todo,
    'title' | 'notes' | 'is_done' | 'due_date' | 'priority' | 'tags' | 'recurrence' | 'sort_order'
  >
>;
