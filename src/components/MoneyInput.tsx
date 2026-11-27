import { useState } from 'react';
import { parseVndAmount } from '../lib/parseNumber';
import { dinhDangSoTien, nhapTien } from '../lib/moneyTyping';

// Ô nhập số tiền VND, tự chèn dấu phẩy hàng nghìn ngay khi gõ (8000 → 8,000)
// — xem src/lib/moneyTyping.ts. Giá trị không đọc được → onChange(null) để form
// cha báo lỗi, KHÔNG tự coi là 0.

interface Props {
  value: number | null;
  onChange: (v: number | null) => void;
  id?: string;
  className: string;
}

export function MoneyInput({ value, onChange, id, className }: Props) {
  const [text, setText] = useState(dinhDangSoTien(value));
  // Đồng bộ khi giá trị bị đổi từ bên ngoài (bấm nút gợi ý 1tr/3tr/…) — so
  // sánh trong lúc render thay vì useEffect để không vẽ hai lần.
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    if (parseVndAmount(text) !== value) setText(dinhDangSoTien(value));
  }

  return (
    <input
      id={id}
      inputMode="numeric"
      value={text}
      onChange={nhapTien((t) => {
        setText(t);
        const v = parseVndAmount(t);
        setLast(v);
        onChange(v);
      })}
      className={className}
    />
  );
}
