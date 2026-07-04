/**
 * Gán màu ổn định cho một nhãn dựa trên tên (hash đơn giản → bảng màu design).
 * Thuần & tất định: cùng tên luôn ra cùng màu, để chấm nhãn nhất quán giữa các nơi.
 */
const PALETTE = ['#5B57E0', '#12A150', '#EAB308', '#E5484D', '#0EA5E9', '#D946EF'];

export function tagColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
