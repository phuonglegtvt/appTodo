// Định dạng phần trăm cho hai cột "% so ngưỡng" và "% so đỉnh" — hàm THUẦN.
//
// NewPL chốt 2026-09-13: BỎ dấu trừ. Hai cột này gần như luôn âm (giá đang dưới
// ngưỡng, giá đang dưới đỉnh) nên dấu trừ lặp ở mọi dòng chỉ làm rối mắt; ý
// nghĩa đã có màu sắc chuyển tải.
//
// ⚠️ GIỮ dấu cộng. Sau khi bỏ dấu trừ, dấu '+' là thứ DUY NHẤT trong bản thân
// con số còn phân biệt được "đắt hơn ngưỡng" với "rẻ hơn ngưỡng" — bỏ nốt thì
// 38.7% (rẻ hơn ngưỡng 38.7%) và 144.1% (đắt hơn ngưỡng 144.1%) nhìn như nhau.

/** `-38.7` → `'38.7%'` · `144.1` → `'+144.1%'` · `0` → `'0.0%'` */
export function formatPctBoDauTru(pct: number): string {
  const so = pct.toFixed(1);

  // Xét dấu TRÊN CHUỖI ĐÃ LÀM TRÒN, không xét trên số gốc. `-0.04` làm tròn ra
  // '-0.0' và `0.04` ra '0.0': cả hai hiển thị là 0 nên không được mang dấu.
  // Xét trên số gốc thì `0.04` sẽ hiện '+0.0%' — nói rằng nó trên ngưỡng một
  // chút, trong khi con số hiện ra là đúng 0.
  const khongDau = so.startsWith('-') ? so.slice(1) : so;
  const laSo0 = Number(khongDau) === 0;

  return `${!laSo0 && !so.startsWith('-') ? '+' : ''}${khongDau}%`;
}
