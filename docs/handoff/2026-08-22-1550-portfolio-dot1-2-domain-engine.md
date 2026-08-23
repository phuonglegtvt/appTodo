# Bàn giao — Portfolio Rebalancing, đợt 1+2 (migration + domain engine)

**Thời điểm:** 2026-08-22 ~15:50
**Repo:** `appTodo` · **branch:** `feat/portfolio-rebalancing` · **HEAD:** `7ae61cd` · **tree sạch**
**Test:** 28 file / **288 pass** · `npm run build` sạch

---

## 1. Việc này là gì

Thêm module **cân bằng danh mục đầu tư** vào app appTodo (tab `portfolio` mới), theo mô hình
Stocks 50% / Crypto 20% / Gold 15% / Cash 15%. App **không** đặt lệnh — chỉ ra đề xuất.

**Quyết định nền tảng đã chốt với NewPL (đừng mở lại):**

1. Làm **trong appTodo**, không dựng app riêng → tái dùng auth, price provider, FX, theme, deploy
   đã có và đã có test. Thư mục `Invesments/` vẫn trống, không dùng.
2. Stack giữ nguyên **React + Vite + Supabase + Cloudflare** (bỏ NestJS/TypeORM/Docker mà spec gốc đề xuất).
3. Schema Postgres riêng **`portfolio`** trong project Supabase hiện có. `public.stocks` / `public.cryptos`
   giữ nguyên, **chỉ đọc**, đóng vai watchlist.
4. **Domain layer thuần TypeScript, 0 dependency** — test không cần mock/DB/mạng.
5. **Dual-weight** (earmarked ⇄ deployed) qua một cột `earmarked_for` — giải bài toán 465tr "staged for DCA".
6. Action Center **2 tầng**: asset class + gợi ý mã cụ thể (dựa `price_threshold` sẵn có).
7. Scope v1 = P0 + drawdown + dividend + CSV. Hoãn v2: TWR/MWR/XIRR, biểu đồ hiệu suất, push notification.

## 2. Ba tài liệu là nguồn chân lý — đọc trước khi làm gì

| File | Vai trò |
|---|---|
| `docs/superpowers/specs/2026-08-22-portfolio-rebalancing-design.md` | **Spec.** 15 mục. DDL đầy đủ (mục 3.3–3.5), 8 module domain (mục 4), 3 mâu thuẫn trong spec gốc (mục 14), 6 vấn đề ẩn (mục 15). |
| `docs/superpowers/plans/2026-08-22-portfolio-dot1-2-migration-domain.md` | **Plan đợt 1+2.** 15 task, ~94 step, code thật từng step. |
| `.superpowers/sdd/2026-08-22-portfolio-dot1-2-migration-domain/progress.md` | **Ledger SDD.** Mọi ruling + tiến độ. **Đọc file này để biết đang ở đâu.** |

Thư mục `.superpowers/sdd/2026-08-22-portfolio-dot1-2-migration-domain/` còn chứa: brief từng task
(`task-N-brief.md`), report của implementer (`task-N-report.md`, `batch-A-report.md`), các file diff review,
và `checklist-cho-NewPL.md`.

## 3. Trạng thái từng task

| Task | Nội dung | Trạng thái |
|---|---|---|
| 4 | `types.ts` + `money.ts` | ✅ **xong, review sạch** · `c0c8950` |
| 5 | `weights.ts` (§17) | ✅ **xong, review sạch** · `90a2afc` |
| 6 | `bands.ts` (§7, 4 trạng thái) | ✅ **xong, review sạch** · `1c0788c` |
| 8 | `tickerCandidates.ts` (lô chẵn) | ✅ **xong, review sạch** · `502a5d4` |
| 10 | `drawdown.ts` (§9) | ✅ **xong, review sạch** · `7aff5a1` |
| 11 | `crashReserve.ts` (§8, episode) | ✅ **xong, review sạch** · `a935e51` |
| — | rename identifier sang tiếng Anh | ✅ `3135f82` (fix round của Batch A) |
| **7** | **`allocate.ts` (§4 + §5)** | 🟡 **CODE XONG, COMMIT RỒI (`72e3d6b`) — NHƯNG CHƯA REVIEW.** Đây là việc đầu tiên phải làm. |
| 9 | `rebalanceSell.ts` (§6 Mode B) | ⬜ chưa làm |
| 12 | `actionPlan.ts` (§18 §19 §20) | ⬜ chưa làm |
| 13 | `invariants.test.ts` (1.000 ca LCG) | ⬜ chưa làm |
| 1 | migration core (11 bảng, RLS) | ⬜ chưa làm — **chờ bước tay của NewPL** |
| 2 | 3 view + kiểm bút toán kép | ⬜ chưa làm — **chờ bước tay** |
| 3 | seed (4 túi tiền, 56 instrument) | ⬜ chưa làm — **chờ bước tay** |
| 14 | `portfolioRepo` + `buildSnapshot` | ⬜ chưa làm |
| 15 | xác minh tên cột repo vs DB | ⬜ chưa làm — **chờ bước tay** |

**Đã có trong `src/domain/`:** `types.ts` `money.ts` `weights.ts` `bands.ts` `tickerCandidates.ts`
`drawdown.ts` `crashReserve.ts` `allocate.ts` + 8 file test tương ứng.

## 4. ⛔ Blocker: một việc CHỈ NewPL làm được

> Supabase Dashboard → **Settings → API → Exposed schemas** → thêm `portfolio` → **Save**

Thiếu bước này thì `supabase.schema('portfolio')` trả `The schema must be one of the following: public`,
và Task 1, 2, 3, 15 đều không xác minh được. Subagent không có credential Supabase → **mọi bước chạy SQL
trong SQL Editor là việc của NewPL**, chi tiết trong
`.superpowers/sdd/2026-08-22-portfolio-dot1-2-migration-domain/checklist-cho-NewPL.md`.

## 5. Việc tiếp theo, theo đúng thứ tự

1. **Review Task 7** (`allocate.ts`). Đây là gate còn treo. Diff: `07f3cfc..72e3d6b`.
   Dùng skill `superpowers:subagent-driven-development`, template `task-reviewer-prompt.md`.
   Brief: `task-7-brief.md`, report: `task-7-report.md`.
   Cần chú ý: implementer đã thay dữ liệu input của test `PRIORITY_WATERFALL overflow` — em đã kiểm
   độc lập bằng số và **đại số của họ đúng** (xem ruling R7 mục 6 dưới).
2. **Task 9** → `rebalanceSell.ts`
3. **Task 12** → `actionPlan.ts` (module phức tạp nhất còn lại)
4. **Task 13** → `invariants.test.ts`
5. **Task 1, 2, 3** — có thể gộp một dispatch (Batch B): cả ba chỉ là viết file `.sql` bằng cách
   transcribe từ spec mục 3.3/3.4/3.5; phần chạy SQL là việc NewPL.
6. **Task 14, 15**
7. Final whole-branch review → `superpowers:finishing-a-development-branch`

**Mỗi dispatch còn lại PHẢI mang 2 thứ này** (nếu không sẽ tái phát lỗi đã sửa):
- Ruling identifier: khối code trong plan dùng biến cục bộ tiếng Việt; **đổi sang tiếng Anh** khi
  hiện thực, **tên export giữ nguyên**, comment + tên test + message lỗi **giữ tiếng Việt**.
  (Ruling này đã ghi vào mục Global Constraints của plan, commit `07f3cfc`.)
- Cảnh báo: các số kỳ vọng trong plan là em chạy tay — nếu implementer thấy số không khớp code thì
  **báo lại, đừng tự sửa bên nào**. Đã bắt được **3 defect** kiểu này (xem mục 6).

## 6. Rulings em đã ra (NewPL đọc và đảo ngược nếu thấy sai)

| # | Ruling | Cost nếu sai |
|---|---|---|
| R1 | Làm tại chỗ trên branch `feat/portfolio-rebalancing`, không tạo worktree riêng | Nếu NewPL sửa app song song có thể chạm nhau |
| R2 | Thứ tự thực thi: domain (4–13) trước, SQL (1–3) sau, nối (14–15) cuối — vì task SQL chờ bước tay | Không có phụ thuộc code nào chạy ngược |
| R3 | Bước chạy SQL giao NewPL; subagent chỉ viết file `.sql` | Schema chưa được chứng minh chạy được tới khi NewPL chạy |
| R4 | Giữ Task 10 (`drawdown.ts`) dù đợt này chưa ai gọi — đợt 6 dùng | ~60 dòng + test nằm không vài đợt |
| R5 | `fetchWatchlist` gán cứng `lotSize = 100` (bảng cũ không có cột này) | Sai bộ lọc "mua nổi" nếu thêm mã lô ≠ 100 |
| R6 | Gộp Task 5,6,8,10,11 thành một dispatch (Batch A) | Diff review lớn hơn |
| **R7** | **Identifier cục bộ phải tiếng Anh** — nhận finding, sửa 4 file, không park. Convention thật của repo (`src/lib/stockCalc.ts`, `cryptoCalc.ts`, `todoFilters.ts`) là identifier tiếng Anh + comment tiếng Việt | Brief và code lệch nhau ở tên biến cục bộ |
| **R8** | **3 defect trong plan của em — sửa TEST, không sửa engine** (chi tiết dưới) | Không có; test sau khi sửa đúng hơn |

### R8 — ba defect trong plan mà subagent bắt được

Cả ba đều là **lỗi em soạn plan**, không phải lỗi implementer, và cả ba đều đúng loại nguy hiểm nhất:
*test sai làm engine tiền trông như đúng*.

1. **`daysBetween` (Task 4).** Em viết `daysBetween('2026-08-01T23:00Z','2026-08-02T01:00Z')` kỳ vọng `0`.
   Hàm cắt về `YYYY-MM-DD` nên đó là **hai ngày lịch khác nhau** → đúng là `1`.
   → Sửa test thành cùng ngày khác giờ.
2. **Crash Reserve cap (Task 11).** Test tên *"reserve 50tr nhưng 5 bậc đòi 100tr → cắt đúng ở 50tr"*
   nhưng **không cấp `history`** ⇒ mốc chụp ảnh tụt về chính 50tr, và 5 bậc đòi 10+15+20+25+30% *của 50tr*
   = đúng 50tr: **không có gì bị cắt.** Test không kiểm được thứ tên nó hứa.
   → Sửa test: cấp history bậc 1 mốc 100tr + ví còn 50tr ⇒ bậc 4 bị cắt còn 15tr, bậc 5 nhận 0.
3. **`PRIORITY_WATERFALL` overflow (Task 7).** Test dùng bộ số §21 với pool 40tr, kỳ vọng tràn sang Cash.
   Nhưng với danh mục §21 thì **không pool nào tràn được**: gap Stocks tăng 0,5đ/1đ pool còn gap Cash
   giảm 0,85đ/1đ pool, nên điều kiện `pool > gapStocks` (cần pool > 60,9tr) và `gapCash > 0`
   (cần pool < 44,8tr) **không bao giờ giao nhau**. Em đã verify độc lập bằng node.
   → Implementer thay bộ số bằng một ca crafted thật sự chạm nhánh overflow (Stocks gap 8tr,
   Cash gap 8,5tr, pool 10tr → 8tr + 2tr). Engine không sửa một dòng.

## 7. Ba mâu thuẫn trong SPEC GỐC đã xử lý (ghi ở mục 14 của spec)

1. **§7** nói cả *"không làm gì khi trong band"* và *"rebalance khi lệch ≥5đ%"* — Cash band 7–20 quanh
   target 15 ⇒ lệch −8đ% mà vẫn trong band. → **Band là cổng, đ% chỉ nâng mức độ**, 4 trạng thái
   `OK / WATCH / OUT_OF_BAND / REBALANCE_REQUIRED`. Lệnh bán chỉ mở ở trạng thái cuối.
2. **§4/§5/§21** — số trong cả ba ví dụ không cùng một công thức. → `PROPORTIONAL_GAP` là chuẩn
   (tối thiểu hoá tổng bình phương độ lệch, đúng mục tiêu 2 của §18); cả ba ví dụ ghi nhận là số viết tay.
3. **§25** — Crash Reserve ở P0 nhưng Drawdown ở P1, mà P0 phụ thuộc P1. → gộp drawdown vào v1.

## 8. Vấn đề spec không nhắc mà thiếu thì app không dùng được

- **Lô chẵn 100 cổ phiếu:** Z = 3tr/tháng **không mua nổi 1 lô của 52/56 mã** watchlist.
  → `tickerCandidates.ts` lọc **hai** điều kiện (dưới ngưỡng **VÀ** mua nổi lô); tiền chưa mua nằm lại
  túi `VND-DCA-STOCKS` (cơ chế dồn tiền, không cần code riêng).
- **Trộn đơn vị:** bảng cũ dùng nghìn đồng / đồng / USD lẫn nhau. → schema mới **VND tuyệt đối**,
  quy đổi chỉ ở `src/providers/` (đợt 4).
- **`security_invoker = true` trên 3 view** — thiếu là **RLS bị vô hiệu, không có triệu chứng**.
- **Sổ giao dịch bất biến** — không có policy UPDATE; chỉ cho DELETE trong 24h.

## 9. Món nợ có ghi biên nhận (đợt sau phải trả)

| Nợ | Trả ở đợt | Hệ quả trong lúc chờ |
|---|---|---|
| `providers/` giá + tỷ giá | 4 | `prices` rỗng ⇒ tài sản đang giữ vào `missingPriceSymbols` ⇒ kế hoạch bị chặn (đúng thiết kế) |
| `drawdowns` thật (benchmark + snapshots) | 6 | Crash Reserve **chưa bao giờ kích hoạt** — an toàn, thà không đề xuất hơn đề xuất trên số 0 giả |
| `incomeReceivedVnd` thật | 3 | tạm 0 |
| `contributionRecordedThisPeriod` thật | 3 | tạm `false` ⇒ luôn có alert `CONTRIBUTION_MISSING` |
| Ghi transaction (INSERT) | 3 | repo đợt này **chỉ đọc** |

## 10. Minor đã defer (final review sẽ triage)

- `bands.ts` `classifyAll` — nhánh `throw` khi thiếu weight chưa có test.
- `crashReserve.ts` dùng được `break` thay `continue` khi đã qua ngưỡng đầu chưa đạt (vô hại ở n=5).
- `crashReserve.ts:55` còn double-space trước comment sau khi rename (cosmetic).
- Plan đếm sai số test ở mục "Định nghĩa Hoàn Thành": money 10→9, Task 5 8→9, Task 6 13→9.
  Tổng dự kiến 155 → thực tế sẽ thấp hơn chút.

## 11. Câu mở session mới

> Đọc `docs/handoff/2026-08-22-1550-portfolio-dot1-2-domain-engine.md` và
> `.superpowers/sdd/2026-08-22-portfolio-dot1-2-migration-domain/progress.md`.
> Tiếp tục thực thi plan `docs/superpowers/plans/2026-08-22-portfolio-dot1-2-migration-domain.md`
> bằng skill `superpowers:subagent-driven-development`, bắt đầu từ **review Task 7** (diff `07f3cfc..72e3d6b`).
