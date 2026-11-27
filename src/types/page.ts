/**
 * Các tab của app. Trước đây union này được viết lặp ở AppPage.tsx và
 * Sidebar.tsx — thêm một tab phải sửa đúng hai chỗ, và quên một chỗ thì tsc
 * chỉ báo ở chỗ dùng, không báo ở chỗ khai. Gộp về một nguồn.
 */
export type Page = 'todos' | 'plan' | 'stocks' | 'crypto' | 'portfolio' | 'debts' | 'cashflow';
