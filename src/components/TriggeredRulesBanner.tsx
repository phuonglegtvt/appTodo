import { usePriceRules } from '../hooks/usePriceRules';
import { danhGiaQuyTac, moTaQuyTac, type RuleKind } from '../lib/priceRules';
import { formatGiaQuyTac } from '../lib/ruleAssets';
import { formatVnd } from '../lib/portfolioClassMeta';

// Dải báo "quy tắc đã chạm ngưỡng" đặt ở đầu tab Cổ phiếu / Crypto — đúng chỗ
// người dùng bấm "Cập nhật giá". Không có quy tắc nào chạm thì không vẽ gì.
// Lỗi tải quy tắc (VD chưa chạy migration) KHÔNG hiện ở đây — mục "Cảnh báo
// giá" của tab Danh mục đã báo; lặp lại ở mọi tab chỉ thêm ồn.

interface Props {
  userId: string;
  kind: RuleKind;
  /** symbol (viết hoa) → giá hiện tại (đơn vị nguồn) và số đang giữ. */
  gia: Map<string, { gia: number | null; soLuong: number | null }>;
}

export function TriggeredRulesBanner({ userId, kind, gia }: Props) {
  const { rules } = usePriceRules(userId);
  const cham = rules
    .filter((r) => r.asset_kind === kind)
    .map((r) => { const g = gia.get(r.symbol); return danhGiaQuyTac(r, g?.gia ?? null, g?.soLuong ?? null); })
    .filter((e) => e.status === 'CHAM');
  if (cham.length === 0) return null;

  return (
    <div role="alert" className="flex flex-col gap-1 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
      <strong>⚑ {cham.length} quy tắc giá đã chạm ngưỡng:</strong>
      <ul className="flex flex-col gap-0.5">
        {cham.map((e) => (
          <li key={e.rule.id}>
            {moTaQuyTac(e.rule, (v) => formatGiaQuyTac(kind, v), formatVnd)}
            {' '}— giá hiện tại {e.giaHienTai === null ? '?' : formatGiaQuyTac(kind, e.giaHienTai)}
            {e.soLuongBan !== null && ` (= bán ${e.soLuongBan.toLocaleString('vi-VN', { maximumFractionDigits: kind === 'CRYPTO' ? 6 : 0 })} ${kind === 'CRYPTO' ? e.rule.symbol : 'cổ'})`}
            {e.rule.note && ` · ${e.rule.note}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
