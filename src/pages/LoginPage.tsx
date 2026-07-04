import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ErrorBanner } from '../components/ErrorBanner';

/**
 * Màn hình đăng nhập: Google OAuth + magic link qua email.
 * Style theo design system (docs/design): card căn giữa trên nền app, tông primary tím.
 * Logic auth giữ nguyên theo plan — không nuốt lỗi im lặng (console.error + ErrorBanner).
 */
export function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      console.error('Lỗi đăng nhập Google:', error);
      setError('Không đăng nhập được bằng Google: ' + error.message);
    }
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) {
      console.error('Lỗi gửi magic link:', error);
      setError('Không gửi được link đăng nhập: ' + error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6 font-sans text-text dark:bg-bg-dark dark:text-text-dark">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-sm dark:border-border-dark dark:bg-surface-dark">
        {/* Logo + tiêu đề */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-lg font-bold text-white">
            ✓
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold">Việc của tôi</h1>
            <p className="mt-1 text-sm text-text-muted dark:text-text-muted-dark">
              Đăng nhập để đồng bộ việc trên mọi thiết bị
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} onClose={() => setError(null)} />
          </div>
        )}

        <button
          onClick={signInWithGoogle}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 font-medium transition-colors hover:bg-surface-2 dark:border-border-dark dark:hover:bg-surface-2dark"
        >
          Đăng nhập với Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-text-muted dark:text-text-muted-dark">
          <span className="h-px flex-1 bg-border dark:bg-border-dark" />
          hoặc dùng email
          <span className="h-px flex-1 bg-border dark:bg-border-dark" />
        </div>

        {sent ? (
          <p className="rounded-md bg-primary-soft px-4 py-3 text-center text-sm text-primary dark:bg-primary-soft-dark dark:text-primary-dark">
            Đã gửi link đăng nhập tới <strong>{email}</strong>. Kiểm tra hộp thư nhé.
          </p>
        ) : (
          <form onSubmit={signInWithEmail} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="email@cua-ban.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary dark:border-border-dark dark:bg-surface-2dark"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-primary px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Đang gửi…' : 'Gửi link đăng nhập'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
