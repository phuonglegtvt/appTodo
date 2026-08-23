// Test render — bắt lỗi runtime mà tsc không thấy được.
// Ca quan trọng nhất: một nhóm chiếm 100% phải vẽ bằng <circle>, không phải
// <path>; cung SVG 360° có điểm đầu trùng điểm cuối nên trình duyệt vẽ ra RỖNG.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AllocationDonut } from './AllocationDonut';

describe('AllocationDonut', () => {
  it('vẽ đủ một lát cho mỗi nhóm, và legend luôn có nhãn chữ', () => {
    const { container } = render(
      <AllocationDonut
        slices={[
          { assetClass: 'STOCKS', valueVnd: 350_000_000 },
          { assetClass: 'CRYPTO', valueVnd: 200_000_000 },
          { assetClass: 'GOLD', valueVnd: 100_000_000 },
        ]}
        totalVnd={650_000_000}
      />,
    );
    expect(container.querySelectorAll('path')).toHaveLength(3);
    // Nhận dạng nhóm không bao giờ chỉ bằng màu — bắt buộc có nhãn chữ.
    expect(screen.getByText('Cổ phiếu')).toBeInTheDocument();
    expect(screen.getByText('Crypto')).toBeInTheDocument();
    expect(screen.getByText('Vàng')).toBeInTheDocument();
  });

  it('không sinh NaN trong bất kỳ path nào', () => {
    const { container } = render(
      <AllocationDonut
        slices={[
          { assetClass: 'STOCKS', valueVnd: 1 },
          { assetClass: 'CRYPTO', valueVnd: 999_999 },
        ]}
        totalVnd={1_000_000}
      />,
    );
    for (const p of container.querySelectorAll('path')) {
      expect(p.getAttribute('d')).not.toMatch(/NaN/);
    }
  });

  it('một nhóm chiếm 100% → vẽ <circle>, KHÔNG dùng <path>', () => {
    const { container } = render(
      <AllocationDonut
        slices={[{ assetClass: 'STOCKS', valueVnd: 500_000_000 }]}
        totalVnd={500_000_000}
      />,
    );
    expect(container.querySelectorAll('path')).toHaveLength(0);
    expect(container.querySelectorAll('circle')).toHaveLength(1);
  });

  it('danh mục rỗng → vẽ vành xám, không trắng trơn và không nổ', () => {
    const { container } = render(
      <AllocationDonut
        slices={[
          { assetClass: 'STOCKS', valueVnd: 0 },
          { assetClass: 'CRYPTO', valueVnd: 0 },
        ]}
        totalVnd={0}
      />,
    );
    expect(container.querySelectorAll('path')).toHaveLength(0);
    expect(container.querySelectorAll('circle')).toHaveLength(1);
    // Legend vẫn liệt kê nhóm, tỷ trọng hiện "—" thay vì "NaN%".
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('có nhãn mô tả cho trình đọc màn hình', () => {
    render(
      <AllocationDonut
        slices={[{ assetClass: 'GOLD', valueVnd: 100_000_000 }]}
        totalVnd={100_000_000}
      />,
    );
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/Vàng/);
  });
});
