// Tính lại "dây chuyền" giao dịch khi SỬA một giao dịch đã ghi — dùng chung cho
// sổ cổ phiếu và sổ crypto (hàm thuần, có test).
//
// Bối cảnh: mỗi giao dịch lưu trạng thái tài sản TRƯỚC/SAU nó, và các giao dịch
// của một tài sản nối nhau theo thứ tự ghi: SAU của giao dịch này = TRƯỚC của
// giao dịch kế tiếp. Dòng tài sản (stocks / cryptos) = SAU của giao dịch cuối.
//
// Sửa giao dịch X:
// - Cùng tài sản: tính lại X với số mới, rồi mọi giao dịch sau X.
// - ĐỔI sang tài sản khác (nhập nhầm mã):
//     · tài sản cũ: bỏ X ra, các giao dịch sau X tính lại từ TRƯỚC của X;
//     · tài sản mới: chèn X vào đúng vị trí theo thời điểm ghi, tính lại X và
//       mọi giao dịch sau nó.
// Kế hoạch trả về đủ để DB ghi nguyên tử VÀ kiểm tra tài sản chưa bị đổi
// (`expected`) — nếu đã đổi thì DB từ chối, không ghi đè.

/** Một giao dịch đã ghi, ở dạng chung: `H` = số liệu tài sản, `I` = dữ liệu nhập. */
export interface ChainEntry<H, I> {
  id: string;
  created_at: string;
  /** YYYY-MM-DD — chỉ để báo lỗi dễ hiểu. */
  trade_date: string;
  input: I;
  before: H;
  after: H;
}

export interface ChainOps<H, I> {
  /** Áp một giao dịch; ném lỗi tiếng Việt nếu không hợp lệ. */
  apply: (h: H, i: I) => { after: H; realized: number | null };
  /** Hai trạng thái có "bằng nhau" không (có dung sai số thực). */
  same: (a: H, b: H) => boolean;
  /** Mô tả ngắn để báo lỗi, ví dụ "bán 60 cổ". */
  describe: (i: I) => string;
}

export interface Recalc<H> {
  id: string;
  before: H;
  after: H;
  realized: number | null;
}

export interface AssetPlan<H> {
  /** Các giao dịch cần ghi lại TRƯỚC/SAU, theo thứ tự ghi. */
  updates: Recalc<H>[];
  /** Tài sản PHẢI đang có số này thì mới được ghi (chống ghi đè). */
  expected: H;
  /** Số liệu tài sản sau khi sửa. */
  final: H;
}

export interface EditPlan<H> {
  /** Tài sản gốc của giao dịch. Khi không đổi tài sản, `updates[0]` là chính X. */
  source: AssetPlan<H>;
  /** Tài sản mới khi đổi mã (`updates[0]` là X); null nếu không đổi. */
  target: AssetPlan<H> | null;
}

function theoThuTuGhi<T extends { created_at: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
}

const viDate = (iso: string) => iso.split('-').reverse().join('/');

const LOI_SUA_TAY =
  'đã được sửa tay ở bảng giữa các giao dịch phía sau, nên không tính lại tự động được '
  + '(sẽ xoá mất phần sửa tay). Hoàn tác các giao dịch sau rồi ghi lại, hoặc sửa số liệu ở bảng.';

/** Dây chuyền từ vị trí `from` trở đi có liền mạch không (SAU[j-1] = TRƯỚC[j]). */
function kiemTraLienMach<H, I>(ops: ChainOps<H, I>, chain: ChainEntry<H, I>[], from: number, ten: string): void {
  for (let j = Math.max(from, 1); j < chain.length; j++) {
    if (!ops.same(chain[j].before, chain[j - 1].after)) {
      throw new Error(`${ten} ${LOI_SUA_TAY}`);
    }
  }
}

/** Áp lần lượt các giao dịch, bắt đầu từ `start`. Phần tử có `input` khác dùng `override`. */
function chayLai<H, I>(
  ops: ChainOps<H, I>, start: H, entries: { e: ChainEntry<H, I>; input: I; laX: boolean }[],
): { updates: Recalc<H>[]; final: H } {
  const updates: Recalc<H>[] = [];
  let state = start;
  for (const { e, input, laX } of entries) {
    let r: { after: H; realized: number | null };
    try {
      r = ops.apply(state, input);
    } catch (err) {
      if (laX) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Sau thay đổi này, giao dịch ${ops.describe(input)} ngày ${viDate(e.trade_date)} phía sau không còn hợp lệ: ${msg}`);
    }
    updates.push({ id: e.id, before: state, after: r.after, realized: r.realized });
    state = r.after;
  }
  return { updates, final: state };
}

/**
 * Lập kế hoạch sửa giao dịch `editId` (thuộc `source`) thành `input`.
 * `move` có mặt khi đổi sang tài sản khác: dây chuyền của tài sản mới + số
 * liệu hiện tại của nó (dùng khi X sẽ là giao dịch mới nhất của tài sản đó).
 */
export function planEdit<H, I>(
  ops: ChainOps<H, I>,
  source: ChainEntry<H, I>[],
  editId: string,
  input: I,
  move?: { chain: ChainEntry<H, I>[]; current: H },
): EditPlan<H> {
  const src = theoThuTuGhi(source);
  const k = src.findIndex((t) => t.id === editId);
  if (k < 0) throw new Error('Không tìm thấy giao dịch cần sửa.');
  const x = src[k];
  kiemTraLienMach(ops, src, k + 1, move ? 'Mã cũ' : 'Mã này');

  if (!move) {
    const { updates, final } = chayLai(ops, x.before, [
      { e: x, input, laX: true },
      ...src.slice(k + 1).map((e) => ({ e, input: e.input, laX: false })),
    ]);
    return { source: { updates, expected: src[src.length - 1].after, final }, target: null };
  }

  // Tài sản cũ: rút X ra, phần sau nối thẳng vào TRƯỚC của X.
  const sau = src.slice(k + 1);
  const cu = chayLai(ops, x.before, sau.map((e) => ({ e, input: e.input, laX: false })));
  const sourcePlan: AssetPlan<H> = { updates: cu.updates, expected: src[src.length - 1].after, final: cu.final };

  // Tài sản mới: chèn X theo thời điểm ghi.
  const dst = theoThuTuGhi(move.chain);
  if (dst.some((e) => e.id === editId)) throw new Error('Giao dịch đã thuộc mã này rồi.');
  const p = dst.filter((e) => e.created_at < x.created_at).length;
  let base: H;
  let expected: H;
  if (p === dst.length) {
    // X sẽ là giao dịch mới nhất của tài sản mới ⇒ áp lên số liệu ĐANG CÓ, như ghi mới.
    base = move.current;
    expected = move.current;
  } else {
    kiemTraLienMach(ops, dst, p, 'Mã mới');
    base = p === 0 ? dst[0].before : dst[p - 1].after;
    expected = dst[dst.length - 1].after;
  }
  const moi = chayLai(ops, base, [
    { e: x, input, laX: true },
    ...dst.slice(p).map((e) => ({ e, input: e.input, laX: false })),
  ]);
  return { source: sourcePlan, target: { updates: moi.updates, expected, final: moi.final } };
}

/**
 * Lập kế hoạch XOÁ giao dịch `deleteId`: các giao dịch ghi sau nó của cùng tài
 * sản được tính lại từ TRƯỚC của nó (như thể nó chưa từng được ghi). Xoá giao
 * dịch mới nhất = hoàn tác: tài sản trở về TRƯỚC của giao dịch đó.
 */
export function planDelete<H, I>(ops: ChainOps<H, I>, chain: ChainEntry<H, I>[], deleteId: string): AssetPlan<H> {
  const list = theoThuTuGhi(chain);
  const k = list.findIndex((t) => t.id === deleteId);
  if (k < 0) throw new Error('Không tìm thấy giao dịch cần xoá.');
  kiemTraLienMach(ops, list, k + 1, 'Mã này');
  const { updates, final } = chayLai(ops, list[k].before,
    list.slice(k + 1).map((e) => ({ e, input: e.input, laX: false })));
  return { updates, expected: list[list.length - 1].after, final };
}
