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
      <div className="surface-card w-full max-w-sm p-8 shadow-lg dark:shadow-lg-dark">
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
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 font-medium transition-colors duration-150 hover:bg-surface-2 active:scale-95 dark:border-border-dark dark:hover:bg-surface-2dark"
        >
          Đăng nhập với Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-text-muted dark:text-text-muted-dark">
          <span className="h-px flex-1 bg-border dark:bg-border-dark" />
          hoặc dùng email
          <span className="h-px flex-1 bg-border dark:bg-border-dark" />
        </div>

        {sent ? (
          <p className="rounded-lg bg-primary-soft px-4 py-3 text-center text-sm text-primary dark:bg-primary-soft-dark dark:text-primary-dark">
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
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-surface-2dark dark:focus:border-primary-dark dark:focus:ring-primary-dark/30"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary px-4 py-2.5 font-medium text-white shadow-soft transition duration-150 hover:shadow-md active:scale-95 disabled:opacity-50 dark:bg-primary-dark dark:shadow-soft-dark dark:hover:shadow-md-dark"
            >
              {busy ? 'Đang gửi…' : 'Gửi link đăng nhập'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
