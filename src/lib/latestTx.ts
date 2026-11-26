// Dùng chung cho sổ giao dịch crypto và cổ phiếu: chỉ giao dịch MỚI NHẤT (theo
// thời điểm ghi) của mỗi tài sản mới được hoàn tác — hoàn tác trả tài sản về
// trạng thái TRƯỚC giao dịch, mà trạng thái đó chỉ đúng khi không có giao dịch
// nào chồng lên sau. DB cũng chặn lại; đây chỉ là để UI không hiện nút vô dụng.

/** id giao dịch mới nhất của từng tài sản, `assetOf` cho biết giao dịch thuộc tài sản nào. */
export function latestIdsBy<T extends { id: string; created_at: string }>(
  list: T[], assetOf: (t: T) => string,
): Set<string> {
  const moiNhat = new Map<string, T>();
  for (const t of list) {
    const key = assetOf(t);
    const cu = moiNhat.get(key);
    if (!cu || t.created_at > cu.created_at) moiNhat.set(key, t);
  }
  return new Set([...moiNhat.values()].map((t) => t.id));
}
