import { useState } from 'react';
import { parseVndAmount } from '../lib/parseNumber';

// Ô nhập số tiền VND: gõ tự do ("3.000.000", "3000000"), rời ô thì định dạng
// lại có dấu chấm nghìn. Giá trị không đọc được → onChange(null) để form cha
// báo lỗi, KHÔNG tự coi là 0.

interface Props {
  value: number | null;
  onChange: (v: number | null) => void;
  id?: string;
  className: string;
}

const fmt = (v: number | null) => (v === null ? '' : v.toLocaleString('vi-VN'));

export function MoneyInput({ value, onChange, id, className }: Props) {
  const [text, setText] = useState(fmt(value));
  // Đồng bộ khi giá trị bị đổi từ bên ngoài (bấm nút gợi ý 1tr/3tr/…) — so
  // sánh trong lúc render thay vì useEffect để không vẽ hai lần.
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    if (parseVndAmount(text) !== value) setText(fmt(value));
  }

  return (
    <input
      id={id}
      inputMode="numeric"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseVndAmount(e.target.value);
        setLast(v);
        onChange(v);
      }}
      onBlur={() => setText(fmt(parseVndAmount(text)))}
      className={className}
    />
  );
}
