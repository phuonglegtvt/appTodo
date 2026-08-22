# Bàn giao — Portfolio Rebalancing đợt 1+2: HOÀN TẤT

**Thời điểm:** 2026-08-22 ~22:45 · **branch:** `feat/portfolio-rebalancing` · **HEAD:** `19ca21a`
**Base:** `master` (merge-base `9916cad`) · 31 commit · 33 file · ~10.900 dòng thêm
**Test:** 379/379 · `npm run build` sạch · tree sạch

15/15 task xong, mỗi task qua review riêng, cộng một final whole-branch review và một đợt sửa.

---

## 1. NewPL còn phải làm đúng HAI việc

Mọi thứ khác đã có bằng chứng máy (mục 3). Hai việc này không ai làm thay được:

**1. Bật Exposed schemas.** Supabase Dashboard → Settings → API → Exposed schemas → thêm
`portfolio` → Save. Thiếu bước này thì `supabase.schema('portfolio')` trả
`The schema must be one of the following: public`.

**2. Chạy 3 file migration** trên project thật, đúng thứ tự (SQL Editor → dán → Run):
`2026-08-22-portfolio-core.sql` → `-views.sql` → `-seed.sql`.
Cả ba đã chứng minh chạy được và **chạy lại được** trên Postgres 16 thật. Nếu DB thật báo lỗi khác,
đó là dấu hiệu project thật lệch với giả định của file — **báo lại, đừng tự sửa**.

Sau đó **không cần** chạy "6 truy vấn xác minh" và "kịch bản bút toán kép" của bản checklist cũ —
cả hai đã chứng minh xong (mục 3).

---

## 2. ⚠️ Việc ĐẦU TIÊN của đợt 3 — một lỗ đã biết, cố ý để lại

Final re-review tái lập được: **`NaN` trong `monthly_contribution_vnd` không bị guard nào bắt**
(`NaN < 0` là false trong JS), và `buildActionPlan` trả `status: READY` với `poolVnd: NaN`,
`unallocatedVnd: NaN` — đúng chữ ký lỗi "kế hoạch trông hợp lệ mà sai" mà cả đợt sửa cuối được lập
ra để chặn.

**Vì sao để lại thay vì sửa ngay:**
- Đợt này **không có đường ghi nào**, nên hôm nay không cách nào đặt `NaN` vào cột đó.
- Khả năng chạm tới qua stack thật **chưa được chứng minh**: reviewer tiêm `NaN` thẳng vào
  `mapToSnapshot` bằng JS, không đi qua PostgREST. JSON không có `NaN` nên PostgREST serialize ra
  gì thì chưa ai đo.
- Ca `target_pct = NaN` thì **DB đã chặn** — CHECK `band_hop_le` dùng phép so mà `NaN::numeric` xếp
  lớn hơn mọi số, nên `NaN <= max_pct` false.

**Đợt 3 phải làm cả hai, cùng lúc với việc thêm đường ghi:**
- 2 dòng guard `Number.isFinite` trong `mapToSnapshot` (`monthly_contribution_vnd`, từng `target_pct`)
- CHECK constraint `monthly_contribution_vnd >= 0` trong migration

---

## 3. Đã chứng minh bằng máy — không cần làm lại

| Việc | Bằng chứng |
|---|---|
| Tên cột `portfolioRepo.ts` khớp schema: **40/40 cột, 6/6 relation, 0 sai** | Postgres 16 thật + script tự trích `.select()/.eq()/.order()` từ chính file |
| 11 bảng · 3 enum · RLS đủ 4 policy/bảng (`transactions` 3, không UPDATE) | Chạy thật + đếm policy + thử insert sai hình dạng |
| **RLS chặn thật** — user A không thấy dữ liệu B ở cả 6 bảng lẫn 3 view | `auth.uid()` đọc từ session, `set role authenticated`, đóng vai 2 user |
| 3 view có `security_invoker = true` **và có hiệu lực** | 3 view trả 0 dòng cho user B trong khi superuser thấy dữ liệu |
| Sổ bất biến: UPDATE sửa 0 dòng, DELETE >24h xoá 0 dòng | Chạy dưới role `authenticated` thật |
| 3 file migration **idempotent** | Chạy 3 lần, diff output xác minh = rỗng |
| Bút toán kép đúng dấu; thiếu giá → `NULL` không phải 0 | Luồng 7 bước thật, `sum(cash_delta_vnd)` = đúng 255.800.000đ |
| Bộ test bắt được regression thật | **10 mutation, 8 bị bắt** (gồm `Math.floor`→`Math.round` làm 15 test đỏ) |
| `src/domain/` thuần 100% | grep toàn thư mục: không supabase/react/fetch, không `Date.now()`/`new Date()` |
| Bất biến tiền qua 1.000 ca ngẫu nhiên có seed | `invariants.test.ts`, mọi nhánh bỏ qua đều đếm số ca chạm assert |

---

## 4. Phải chốt TRƯỚC khi vẽ UI đợt 3–4

Hai vấn đề **ngữ nghĩa**, không phải sai số. Chúng sẽ hiện thẳng lên màn hình:

**a. Engine sinh "lệnh BÁN CASH"** (3.111/5.000 ca ngẫu nhiên). Số đúng, nhưng bán tiền mặt là
*giải ngân*, không phải bán tài sản: không có phí giao dịch, nên ngưỡng `minSellAmountVnd`
("không bán vụn để đỡ phí") áp lên nó là sai luật. Đề xuất: tách `SellOrder` thành
`SELL_ASSET` / `DEPLOY_CASH`, hoặc tối thiểu miễn ngưỡng cho CASH và đổi nhãn.

**b. `tickerCandidates` không đếm tiền bán.** Cùng một `ActionPlan` nói "dồn 163,86tr vào Cổ phiếu"
nhưng chỉ gợi ý mã trong ngân sách 23tr. Người dùng đọc hai phần của cùng một kế hoạch sẽ thấy mâu
thuẫn.

**c. `ADJUSTMENT` không sửa GIẢM được.** `CLAUDE.md` và spec §14 hứa "ghi sai thì ghi thêm dòng
`ADJUSTMENT` bù", nhưng `core.sql:72` có `check (amount_vnd >= 0)` và `v_legs` cho `ADJUSTMENT` ra
`+amount` ở cả chân 1 lẫn chân 3 ⇒ chỉ cộng được. Ghi thừa 10tr vào một túi CASH thì không có cách
nào sửa. Chưa nổ vì chưa có đường ghi — sửa ở migration đợt 3.

---

## 5. Bẫy kỹ thuật cho người viết đợt 3+

- **`loadSnapshot` đã DỜI** từ `src/data/buildSnapshot.ts` sang `src/data/portfolioRepo.ts`.
  `import { loadSnapshot } from './data/buildSnapshot'` sẽ gãy.
- **`v_positions`/`v_allocation` KHÔNG trả dòng 0** cho instrument chưa có giao dịch — chúng không
  trả gì cả. `mapToSnapshot` đã tự default 0 cho mọi class; code mới cũng phải nhớ điều này.
- **`service_role` không có `usage` trên schema `portfolio`** (đúng spec — chỉ grant
  `anon, authenticated`). Luồng ghi server-side/edge function sẽ nhận `permission denied for schema`.
  Thêm grant khi thật sự cần, đừng thêm sẵn.
- **`portfolioRepo` chưa từng chạm PostgREST thật.** Chuỗi `.select('… group …')` có cột `group` —
  từ khoá SQL nhạy cảm — chưa được kiểm với API thật. Phương án dự phòng `group:group` đã ghi trong
  `task-15-brief.md`. **Đừng đổi trước khi thấy lỗi thật.** Smoke test luồng này là Definition of
  Done của đợt 4, không phải "hy vọng nó chạy".
- **Số mặc định nhân bản giữa TS và SQL** (`3.000.000`, `DEFAULT_CONFIG` ↔ 8 cột default của
  `settings`, `DEFAULT_CRASH_LEVELS` ↔ `seed.sql`). Hôm nay khớp hết, nhưng không có gì giữ chúng
  khớp — đây là chỗ duy nhất có nguy cơ drift thật.

---

## 6. Ba mâu thuẫn trong spec gốc đã xử lý

1. **§7** vừa nói "không làm gì khi trong band" vừa nói "rebalance khi lệch ≥5đ%" → **band là cổng,
   đ% chỉ nâng mức độ**, 4 trạng thái. Lệnh bán chỉ mở ở `REBALANCE_REQUIRED`.
2. **§4/§5/§21** số trong ba ví dụ không cùng một công thức → `PROPORTIONAL_GAP` là chuẩn; cả ba ví
   dụ ghi nhận là số viết tay.
3. **§25** Crash Reserve ở P0 nhưng Drawdown ở P1 mà P0 phụ thuộc P1 → gộp drawdown vào v1.

**Và một defect trong chính spec, phát hiện lúc làm:** spec mục 4.4 bắt cộng tiền mới `Z` vào Cash
trước khi tính khoảng thiếu. Việc đó làm túi Cash **rò rỉ thường trực ~1 lần Z mỗi tháng** — mô
phỏng 24 tháng từ đúng target cho ra Cash 14,720% thay vì 15,000%, đúng kiểu làm Crash Reserve §8
cạn dần mà chính spec tự cảnh báo. Đã sửa engine + spec mục 4.4/4.5/14. Số chuẩn §21 đổi từ
`1,4tr/1,6tr` thành `1,3tr/1,7tr`.

---

## 7. Món nợ có ghi biên nhận

| Nợ | Đợt trả | Hệ quả trong lúc chờ |
|---|---|---|
| `providers/` giá + tỷ giá | 4 | `prices` rỗng ⇒ tài sản đang giữ vào `missingPriceSymbols` ⇒ kế hoạch bị chặn (đúng thiết kế) |
| `drawdowns` thật | 6 | Crash Reserve chưa bao giờ kích hoạt — thà không đề xuất còn hơn đề xuất trên số 0 giả |
| `incomeReceivedVnd` thật | 3 | tạm 0 |
| `contributionRecordedThisPeriod` thật | 3 | tạm `false` ⇒ luôn có alert `CONTRIBUTION_MISSING` |
| Ghi transaction (INSERT) | 3 | repo đợt này **chỉ đọc** |

---

## 8. Ghi chú trung thực về quá trình

**Mười lỗi phát sinh trong đợt này, không cái nào là lỗi của implementer.** Tất cả đến từ plan
(soạn ở session trước) hoặc từ agent điều phối: số học chạy tay sai, mệnh đề toán học sai, khoanh
sai phạm vi, chép số mà không đo lại, và một lần artifact bàn giao bị cắt cụt vì `grep` một dòng
trên nội dung nhiều dòng.

Cả mười đều do subagent bắt, và bắt được vì mỗi dispatch đều mang một chỉ thị: **tự dẫn lại, nếu
lệch thì báo lại chứ đừng tự sửa bên nào.** Bốn lần implementer/reviewer bác lại điều phối viên và
**cả bốn lần họ đúng**. Nếu chỉ thị đó không có, phần lớn mười lỗi này đã nằm im trong code.

Danh sách đầy đủ 54 ruling (kèm cái giá nếu sai) nằm ở phần cuối phiên làm việc, và trong
`.superpowers/sdd/2026-08-22-portfolio-dot1-2-migration-domain/all-rulings.txt` cho tới khi thư mục
đó bị xoá.
