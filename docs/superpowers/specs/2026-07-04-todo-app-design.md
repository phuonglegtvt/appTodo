# Thiết kế: Ứng dụng Todo cá nhân (đồng bộ nhiều thiết bị)

- **Ngày:** 2026-07-04
- **Trạng thái:** Đã duyệt (brainstorming)
- **Tác giả:** phuonglegtvt92@gmail.com + Claude

## 1. Mục tiêu & bối cảnh

Xây một web app quản lý công việc (todo) cho **một người dùng cá nhân**, nhưng
**đồng bộ được trên nhiều thiết bị** (máy tính + điện thoại). Đây là dự án học
lập trình, nên ưu tiên **stack dễ học, hiện đại, ít phải tự vận hành server**.

### Tiêu chí thành công
- Thêm/sửa/xóa/hoàn thành việc mượt mà, dữ liệu không mất.
- Đăng nhập trên máy khác vẫn thấy đúng dữ liệu của mình (đồng bộ realtime).
- Chạy tốt cả trên màn hình điện thoại lẫn máy tính.
- Code chia thành các phần nhỏ, rõ trách nhiệm, dễ đọc và dễ mở rộng.

## 2. Kiến trúc

```
[Trình duyệt: React + Vite + TypeScript + Tailwind]
        │  (thư viện @supabase/supabase-js)
        ▼
[Supabase]
   ├─ Auth: Google OAuth + Email magic link
   ├─ Postgres: bảng `todos` (+ Row Level Security)
   └─ Realtime: đẩy thay đổi tới mọi thiết bị đang mở app
```

- **Frontend:** React + Vite + TypeScript, style bằng **Tailwind CSS**.
- **Backend-as-a-Service:** **Supabase** — không cần tự viết/vận hành server.
- **Không có backend tự viết ở Phase 1.** Mọi truy cập dữ liệu đi thẳng từ
  trình duyệt tới Supabase, được bảo vệ bằng Row Level Security (RLS).

### Vì sao chọn stack này
- Vite + React: khởi động nhanh, tài liệu nhiều, dễ học.
- Tailwind: làm dark mode + responsive nhanh, không phải quản lý file CSS rối.
- Supabase: cho sẵn Auth (Google + magic link), Postgres và Realtime — vừa khít
  nhu cầu "cá nhân, đồng bộ nhiều thiết bị" mà không cần dựng server riêng.

## 3. Xác thực (Authentication)

Hai cách đăng nhập, đều do Supabase Auth lo:
1. **Google OAuth** — bấm "Đăng nhập với Google".
2. **Email magic link** — nhập email, bấm link trong hộp thư để vào (không mật khẩu).

Chưa đăng nhập → hiển thị trang đăng nhập. Đã đăng nhập → vào app chính.
Mỗi việc gắn với `user_id`; RLS đảm bảo người này không đọc/ghi được việc của người khác.

## 4. Chức năng Phase 1

| Nhóm | Chi tiết |
|------|----------|
| Cơ bản (CRUD) | Thêm, sửa, xóa việc; đánh dấu hoàn thành / bỏ hoàn thành |
| Hạn chót | Đặt `due_date`; hiển thị và sắp xếp theo ngày; đánh dấu việc quá hạn |
| Ưu tiên | `high` / `medium` / `low`, thể hiện bằng màu |
| Nhãn | Gắn nhiều tag cho một việc; lọc theo tag |
| Tìm & lọc | Tìm theo từ khóa trong tiêu đề; lọc theo trạng thái / tag / ưu tiên |
| Kéo-thả | Sắp xếp lại thứ tự việc bằng chuột (cập nhật `sort_order`) |
| Smart views | Hôm nay / Sắp tới / Tất cả / Đã xong (lọc theo `due_date` + `is_done`) |
| Trải nghiệm | Dark mode (nhớ lựa chọn), responsive, đồng bộ realtime giữa thiết bị |

### Ngoài phạm vi Phase 1 (để dành Phase 2)
Nhập bằng ngôn ngữ tự nhiên, việc con (subtask), lặp lại định kỳ, nhắc nhở/thông
báo, Pomodoro, habit tracker, tính năng AI, cộng tác nhiều người. Cố tình loại
khỏi bản đầu để giữ dự án học vừa sức (YAGNI).

## 5. Mô hình dữ liệu — bảng `todos`

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid (PK) | mặc định `gen_random_uuid()` |
| user_id | uuid | tham chiếu `auth.users`, dùng cho RLS |
| title | text (not null) | nội dung việc |
| notes | text | ghi chú, tùy chọn |
| is_done | boolean | mặc định `false` |
| due_date | date | tùy chọn |
| priority | text | `'high'` \| `'medium'` \| `'low'`, mặc định `'medium'` |
| tags | text[] | mảng nhãn, mặc định `{}` |
| sort_order | numeric | phục vụ kéo-thả; mặc định theo thời điểm tạo |
| created_at | timestamptz | mặc định `now()` |
| updated_at | timestamptz | cập nhật khi sửa |

**Row Level Security:** bật RLS; policy `user_id = auth.uid()` cho mọi thao tác
(select/insert/update/delete).

## 6. Cấu trúc dự án

Theo mẫu **type-based (flat)** — chuẩn cộng đồng cho app một domain (todos) và
phù hợp dự án học. Không dùng feature-based ở Phase 1 (xem mục 6.1).

```
appTodo/
├── index.html                # Điểm vào Vite (nạp /src/main.tsx)
├── package.json              # Phụ thuộc + scripts dev/build/test/lint
├── vite.config.ts            # Cấu hình Vite (plugin React) + khối test Vitest (jsdom)
├── tsconfig.json             # TypeScript cho src (strict: true)
├── tsconfig.node.json        # TS cho file config chạy ở Node (vite.config.ts)
├── tailwind.config.js        # content paths + darkMode: 'class' (bắt buộc cho dark mode)
├── postcss.config.js         # Tailwind chạy qua PostCSS
├── eslint.config.js          # Lint (backing cho `npm run lint`)
├── .env.example              # Mẫu biến môi trường Supabase (chỉ anon key)
├── .gitignore
├── CLAUDE.md                 # Quy ước làm việc cho Claude Code trong repo
├── prd.md                    # Product Requirements Document
├── README.md                 # Cách cài đặt & chạy
├── public/                   # Tài nguyên tĩnh (favicon...)
├── src/
│   ├── main.tsx              # Bootstrap React (createRoot) + import index.css
│   ├── App.tsx               # Root: auth-gate (LoginPage vs AppPage)
│   ├── index.css             # @tailwind base/components/utilities
│   ├── components/           # TodoItem, TodoList, TodoForm, FilterBar, SearchBar, PriorityBadge, ThemeToggle
│   ├── pages/                # LoginPage, AppPage
│   ├── hooks/                # useTodos (CRUD + realtime), useAuth, useTheme
│   ├── lib/                  # supabaseClient.ts (điểm truy cập Supabase duy nhất),
│   │                         # todoFilters.ts (LOGIC THUẦN: lọc/sắp xếp/smart-view — test được),
│   │                         # database.types.ts (kiểu DB sinh từ schema, tùy chọn)
│   ├── types/                # todo.ts (Todo, Priority, SmartView)
│   └── test/                 # setup.ts (cấu hình Vitest / jest-dom)
├── supabase/                 # schema.sql: tạo bảng todos + policy RLS
└── docs/superpowers/specs/   # Nơi lưu spec thiết kế
```

Nguyên tắc: mỗi component/hook một trách nhiệm rõ ràng, giao tiếp qua props/return
value rõ ràng, test được độc lập. File phình to là dấu hiệu cần tách nhỏ. Logic
thuần (lọc/sắp xếp/smart-view) tách ra `lib/todoFilters.ts` để unit test không cần render UI.

### 6.1 Cố ý KHÔNG thêm ở Phase 1 (tránh over-engineering)
`src/features/` (feature-based), thư viện state toàn cục (Redux/Zustand),
React Router, lớp `services/` tách khỏi `hooks/`, Atomic Design, barrel `index.ts`,
CI/Docker/Storybook/e2e. App một domain + Realtime + `useState`/hook là đủ; chỉ
cân nhắc khi Phase 2 thực sự phình lớn.

## 7. Quy trình thiết kế giao diện (Claude Design)

Giao diện sẽ được dựng bằng **Claude Design** (claude.design) rồi bàn giao cho
Claude Code hiện thực:
1. Dùng Claude Design mô tả app → sinh design system + mockup các màn hình.
2. Xuất ra HTML/CSS hoặc design tokens (màu, khoảng cách, kiểu chữ).
3. Claude Code dựng lại bằng React + Tailwind bám theo design tokens đó.

Lưu ý: Claude Code (terminal) không tự kết nối vào claude.design; bước 1–2 do
người dùng thao tác trên claude.design, sau đó đưa kết quả vào repo. Nếu chưa có
thiết kế từ Claude Design, Claude Code dựng một giao diện Tailwind sạch, tối giản
làm mặc định để thay thế sau.

## 8. Xử lý lỗi & kiểm thử

- **Lỗi phải hiện rõ**, không "nuốt lỗi im lặng": mất mạng, đăng nhập thất bại,
  lưu thất bại đều báo cho người dùng và log ra console.
- **Kiểm thử (Vitest):** logic lọc/sắp xếp/smart-view, và ánh xạ dữ liệu Todo.
- Ưu tiên viết test cho phần logic thuần trước khi ghép UI.

## 9. Rủi ro & lưu ý
- Khóa Supabase `anon` để lộ ở frontend là **bình thường** — an toàn nhờ RLS.
  Không bao giờ đưa `service_role` key vào frontend.
- Cần bật Realtime cho bảng `todos` trong Supabase.
