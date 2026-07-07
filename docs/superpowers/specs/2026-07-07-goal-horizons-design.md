# Thiết kế: Mục tiêu & lưới phân tầng thời gian (Phase 2b)

- **Ngày:** 2026-07-07
- **Trạng thái:** Đã duyệt (brainstorming)
- **Tác giả:** phuonglegtvt92@gmail.com + Claude

## 1. Mục tiêu & bối cảnh

Đây là Phase 2b đã định hướng ở `prd.md` mục 6.2 và tiếp nối Phase 2a (việc lặp
cố định ngày, đã merge/deploy). Nhu cầu gốc: app phải cho người dùng **nhìn vào
là biết ngay** mục tiêu dài hạn của mình (5 năm → năm → tháng → tuần → ngày) và
việc cần làm hôm nay bám vào mục tiêu đó ra sao — "mục tiêu dài hạn là kim chỉ
nam cho hành động", theo kiểu chọn cấp độ như Google Calendar: chọn cấp cao gộp
hiển thị toàn bộ nội dung của cấp thấp hơn nằm trong nó.

Yêu cầu ban đầu của phiên brainstorm này còn có phần thứ hai — cải thiện UX của
việc lặp hiện có (khó quan sát việc kỳ này đã xong hay chưa, không có nút "hủy
lặp" tường minh). Phần đó được **tách thành spec riêng, làm sau** (xem mục 8 —
Ngoài phạm vi); tài liệu này chỉ tập trung hệ thống mục tiêu phân tầng.

### Tiêu chí thành công
- Có 1 tab "Kế hoạch" riêng, không đụng tới các smart view hiện có (Hôm
  nay/Sắp tới/Tất cả/Đã xong).
- Chọn 1 trong 5 tầng thời gian (5 Năm/Năm/Tháng/Tuần/Ngày) + điều hướng
  tới/lùi giữa các kỳ (giống nút `‹ ›` của Google Calendar).
- Mỗi kỳ (VD "Tháng 07/2026") có thể có nhiều mục tiêu riêng, tick hoàn thành
  được như một việc.
- Việc (todo) đã có `due_date` tự động "rơi" đúng vào ô ngày/tuần/tháng/năm
  chứa nó, không cần thao tác gắn thủ công.
- Ở tầng 5 Năm/Năm/Tháng/Tuần, xem được lưới các ô con kèm số liệu tổng hợp
  (bao nhiêu việc/mục tiêu đã xong); tầng Ngày hiện thẳng danh sách việc.

## 2. Mô hình dữ liệu

Bảng mới `goals`, phẳng (không lồng cây cha-con giữa các mục tiêu — giữ đúng
quyết định "mô hình phẳng" đã ghi ở `prd.md` 6.2 để vừa sức dự án học). Không
thêm cột nào vào `todos` — việc gộp vào đúng kỳ hoàn toàn dựa trên `due_date`
có sẵn.

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid (PK) | mặc định `gen_random_uuid()` |
| user_id | uuid | tham chiếu `auth.users`, dùng cho RLS |
| horizon | text | `'five_year'` \| `'year'` \| `'month'` \| `'week'` |
| period_key | text not null | định danh kỳ, xem bảng mục 4 |
| title | text not null | nội dung mục tiêu |
| is_done | boolean | mặc định `false` |
| created_at / updated_at | timestamptz | mặc định `now()`, `updated_at` tự cập nhật qua trigger giống `todos` |

Không có `sort_order`: khác với `todos` (có kéo-thả, FR-14), PRD không yêu cầu
sắp xếp tay cho mục tiêu — hiển thị theo `created_at` là đủ, thêm cột chưa
dùng tới là thừa (YAGNI).

Migration (`supabase/schema.sql`, thêm khối mới sau khối Phase 2a):
```sql
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  horizon text not null check (horizon in ('five_year', 'year', 'month', 'week')),
  period_key text not null,
  title text not null,
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

alter table public.goals enable row level security;
create policy "goals_select_own" on public.goals for select using (auth.uid() = user_id);
create policy "goals_insert_own" on public.goals for insert with check (auth.uid() = user_id);
create policy "goals_update_own" on public.goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals_delete_own" on public.goals for delete using (auth.uid() = user_id);

alter publication supabase_realtime add table public.goals;
alter table public.goals replica identity full;
```
Dùng lại `public.set_updated_at()` đã có từ Phase 1. **Lưu ý triển khai:** như
Phase 2a, script này phải tự chạy tay trên Supabase Dashboard (project thật)
trước khi tính năng chạy được ở production.

### Kiểu dữ liệu (`src/types/goal.ts`)
Theo đúng quy ước hiện có ở `src/types/todo.ts` (field snake_case, ánh xạ
thẳng 1-1 với tên cột DB, không có tầng chuyển đổi camelCase):
```ts
export type Horizon = 'five_year' | 'year' | 'month' | 'week';
export interface Goal {
  id: string;
  user_id: string;
  horizon: Horizon;
  period_key: string;
  title: string;
  is_done: boolean;
  created_at: string;
  updated_at: string;
}
export interface NewGoal {
  horizon: Horizon;
  period_key: string;
  title: string;
}
export type GoalUpdate = Partial<Pick<Goal, 'title' | 'is_done'>>;
```

## 3. Kiến trúc & cấu trúc file

Theo đúng quy ước hiện có (component-based, mỗi file một trách nhiệm):

```
src/
├── types/goal.ts              # Goal, Horizon, NewGoal, GoalUpdate
├── lib/
│   └── goalFilters.ts         # logic thuần: tính khoảng ngày, gộp todos/goals
│                               #   vào đúng kỳ, sinh danh sách ô con (test được,
│                               #   không phụ thuộc Supabase/React)
├── hooks/
│   └── useGoals.ts            # CRUD + subscribe realtime bảng goals, cùng
│                               #   khuôn với useTodos.ts hiện có
├── components/
│   ├── PlanPage.tsx            # điều phối: state {horizon, periodKey}, gọi
│   │                           #   goalFilters để lọc todos/goals, truyền
│   │                           #   xuống PeriodGrid/GoalList
│   ├── HorizonSwitcher.tsx     # 5 nút chọn tầng + nút ‹ › chuyển kỳ
│   ├── PeriodGrid.tsx          # vẽ lưới ô con (năm→tháng, tháng→ngày thật
│   │                           #   theo lịch, tuần→7 ngày)
│   ├── PeriodCell.tsx          # 1 ô lưới: số liệu tổng hợp + hover tooltip
│   │                           #   (desktop) / tap-to-drill (mobile)
│   └── GoalList.tsx            # danh sách mục tiêu của kỳ đang chọn: thêm,
│                                #   tick, sửa, xóa (CRUD như TodoItem)
└── pages/AppPage.tsx           # thêm tab điều hướng "Kế hoạch" cạnh
                                 #   Hôm nay/Sắp tới/Tất cả/Đã xong
```

Tầng **Ngày** không dùng `PeriodGrid`/`PeriodCell` — hiện thẳng `TodoList`/
`TodoItem` đã có, lọc theo `due_date` bằng đúng cách các smart view khác đang
làm. Bấm vào 1 việc (kể cả từ trong tooltip) mở `TodoItem` để sửa — không có
luồng sửa việc riêng cho tab Kế hoạch.

## 4. Logic gộp theo khoảng ngày (`src/lib/goalFilters.ts`)

Mỗi kỳ quy về một khoảng ngày `[start, end]`; lọc `todos` theo `due_date` nằm
trong khoảng đó và lọc `goals` theo `horizon` + `period_key` khớp đúng —
không cần cột liên kết mới, không cần tính toán phía Supabase.

| Horizon | `period_key` | Khoảng ngày |
|---|---|---|
| `five_year` | năm đầu khối, VD `'2025'` | `floor(năm/5)*5` → 5 năm liên tiếp (VD 2025–2029); ranh giới toàn cục, không cá nhân hóa |
| `year` | `'2026'` | 01/01 – 31/12 năm đó |
| `month` | `'2026-07'` | ngày 1 – ngày cuối tháng (tính đúng năm nhuận) |
| `week` | `'2026-W27'` | ISO week, Thứ 2 – Chủ nhật |
| `day` | (không có `Goal`, dùng `due_date` trực tiếp) | đúng 1 ngày |

Các hàm thuần cần viết, có unit test (Vitest) trước khi ghép UI — theo đúng
tinh thần TDD của dự án:

```ts
function getPeriodRange(horizon: Horizon, periodKey: string): { start: string; end: string }
function getPeriodKey(horizon: Horizon, date: string): string       // nghịch đảo của getPeriodRange
function getChildPeriods(horizon: Horizon, periodKey: string): string[]
function countTodosInRange(todos: Todo[], start: string, end: string): { done: number; total: number }
function shiftPeriod(horizon: Horizon, periodKey: string, delta: number): string  // cho nút ‹ ›
```

`getChildPeriods`: `five_year` → 5 `year`; `year` → 12 `month`; `month` → các
`week` giao với tháng đó (tuần đầu/cuối tháng có thể giao 2 tháng); `week` → 7
`day`. Ca biên cần test riêng: tháng 2 năm nhuận, tuần ISO giao năm (VD
01/01/2027 thuộc tuần nào), khối 5-năm đúng ranh giới (2025 và 2030 phải khác
khối).

## 5. Hành vi UI theo từng tầng

**Chung mọi tầng:** `HorizonSwitcher` (5 nút) + nút `‹ ›` (dùng
`shiftPeriod`) + nhãn kỳ hiện tại. Dưới đó là `GoalList` của đúng kỳ đang chọn.
Dưới cùng là `PeriodGrid` (trừ tầng Ngày).

- **5 Năm / Năm**: `PeriodGrid` là lưới ô năm/tháng, mỗi ô hiện tên kỳ con +
  số mục tiêu đã tick + số việc đã xong trong khoảng đó (VD "3/5 mục tiêu",
  "12/20 việc"). Hover (desktop) hiện tooltip liệt kê mục tiêu/việc của kỳ con;
  bấm vào ô → chuyển xuống tầng con với `periodKey` tương ứng.
- **Tháng**: `PeriodGrid` vẽ lưới ngày thật theo lịch (7 cột, có ô trống đầu/
  cuối tháng để canh đúng thứ trong tuần — kiểu Google Calendar, đã chốt qua
  mockup). Mỗi ô ngày hiện chấm/số việc trong ngày.
- **Tuần**: lưới 7 ô ngày (1 hàng), hiện việc như trên.
- **Ngày**: không còn là lưới — hiện thẳng danh sách `todos` có `due_date`
  bằng ngày đó, tái dùng `TodoItem`/`TodoList` sẵn có.

**Hover/tap ô ngày** (đã chốt qua visual companion):
- Desktop: hover vào ô ngày → tooltip nổi liệt kê từng việc trong ngày (chỉ
  xem nhanh, không thao tác trong tooltip).
- Mobile (không có hover): chạm vào ô ngày → đi thẳng xuống tầng Ngày, bỏ qua
  tooltip hoàn toàn.

## 6. Xử lý lỗi & đồng bộ realtime

`goals` đi theo đúng khuôn `todos`, không phát sinh cơ chế mới:
- RLS 4 policy `user_id = auth.uid()`, sao chép nguyên mẫu từ `todos`.
- Realtime bật cho `goals` + `replica identity full` (lý do giống `todos`:
  đảm bảo sự kiện DELETE mang đủ cột để lọc theo `user_id`).
- `useGoals` cấu trúc y hệt `useTodos`: lỗi mạng/lưu thất bại phải hiện cho
  người dùng (banner) + log console — không nuốt lỗi im lặng (NFR-1).

## 7. Kế hoạch kiểm thử

- **Unit test (`goalFilters.test.ts`)** — trọng tâm, vì đây là logic thuần
  nhiều ca biên:
  - `getPeriodRange` đúng cho cả 5 horizon; tháng 2 năm nhuận; khối 5-năm
    đúng ranh giới.
  - Tuần ISO: ca biên đầu năm/cuối năm, tuần giao 2 tháng.
  - `getPeriodKey` là nghịch đảo đúng của `getPeriodRange` (round-trip).
  - `getChildPeriods`: năm ra đúng 12 tháng; tháng ra đúng số tuần giao; tuần
    ra đúng 7 ngày.
  - `countTodosInRange`, `shiftPeriod` (tới rồi lùi phải về đúng kỳ ban đầu).
- **Thủ công qua dev server** (bắt buộc trước khi báo "xong", theo CLAUDE.md):
  tạo mục tiêu ở cả 4 tầng, tick hoàn thành, chuyển kỳ qua ranh giới năm
  (Dec→Jan), hover tooltip trên desktop, chạm ô ngày ở viewport mobile để xác
  nhận vào thẳng tầng Ngày.
- Trước khi báo "xong": chạy `npm test` và `npm run build`, xác nhận pass thật.

## 8. Ngoài phạm vi tài liệu này

- **Cải thiện UX việc lặp hiện có** (Phase 2a): làm nổi bật/tách riêng việc
  lặp trong danh sách, thêm nút "hủy lặp" tường minh thay vì cơ chế tự xóa
  việc kỳ kế tiếp. Đây là nhu cầu thật đã nêu trong phiên brainstorm này
  nhưng được tách thành spec riêng, làm sau spec này.
- Gắn việc (`todos`) trực tiếp vào 1 `goal_id` cụ thể (cho việc không có
  `due_date` nhưng vẫn muốn phục vụ 1 mục tiêu dài hạn) — bản đầu chỉ gộp
  theo `due_date`; có thể cân nhắc thêm liên kết thủ công ở phiên bản sau nếu
  nhu cầu phát sinh.
- Cây mục tiêu lồng nhau thật sự (mục tiêu tháng có `parent_id` trỏ tới mục
  tiêu năm...) — giữ mô hình phẳng như `prd.md` đã chọn.
- Nhắc nhở/thông báo đẩy, sinh sẵn nhiều kỳ tương lai theo lịch nền (cron/edge
  function) — ngoài phạm vi Phase 2 nói chung (xem `prd.md` mục 6.3).
