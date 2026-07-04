import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// KHÔNG nuốt lỗi: thiếu cấu hình thì báo ngay, đừng để app chạy nửa vời.
if (!url || !anonKey) {
  throw new Error(
    'Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY. Sao chép .env.example thành .env và điền giá trị.',
  );
}

export const supabase = createClient(url, anonKey);
