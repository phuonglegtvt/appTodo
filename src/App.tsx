import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { LoginPage } from './pages/LoginPage';
import { AppPage } from './pages/AppPage';

export default function App() {
  const { session, loading } = useAuth();
  // Theme quản lý tập trung ở đây để áp cho cả trang đăng nhập lẫn app.
  const { theme, toggleTheme } = useTheme();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-text-muted dark:bg-bg-dark dark:text-text-muted-dark">
        Đang tải…
      </div>
    );
  }

  return session ? (
    <AppPage
      userId={session.user.id}
      userEmail={session.user.email ?? ''}
      theme={theme}
      toggleTheme={toggleTheme}
    />
  ) : (
    <LoginPage />
  );
}
