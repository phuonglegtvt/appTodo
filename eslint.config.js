// Cấu hình ESLint dạng "flat config" (bắt buộc từ ESLint 9).
//
// Giữ bộ luật ở mức "recommended" của từng plugin: mục tiêu là bắt lỗi thật
// (biến không dùng, hook gọi sai chỗ, thiếu dependency của useEffect), không
// phải áp phong cách — định dạng code đã có TypeScript strict lo phần lớn.
import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    // File build/sinh tự động — lint chúng chỉ ra tiếng ồn.
    // docs/design/ là bản thiết kế thô xuất từ Claude Design, không phải code app.
    ignores: ['dist/**', 'node_modules/**', 'vite.config.js', 'vite.config.d.ts', '.claude/**', 'docs/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // TypeScript đã tự kiểm tra tên chưa khai báo (chính xác hơn, biết cả type).
      'no-undef': 'off',
      // Bản JS của luật này không hiểu type/overload — dùng bản TS thay thế.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Test chạy dưới Vitest với globals (describe/it/expect).
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  },
  {
    files: ['**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
