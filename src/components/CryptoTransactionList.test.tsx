import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CryptoTransactionList } from './CryptoTransactionList';
import type { Crypto } from '../types/crypto';
import type { CryptoTransaction } from '../types/cryptoTransaction';

function tx(id: string, crypto_id: string, created_at: string): CryptoTransaction {
  return {
    id, user_id: 'u1', crypto_id, side: 'BUY', trade_date: '2026-11-01',
    quantity: 1, price_usd: 1, amount_vnd: 1, note: '',
    before_quantity: null, before_avg_buy_price: null, before_invested_amount: null,
    after_quantity: 1, after_avg_buy_price: 1, after_invested_amount: 1,
    realized_pnl_vnd: null, created_at,
  };
}

describe('CryptoTransactionList — sửa giao dịch', () => {
  const coin = (id: string, symbol: string, quantity: number, avg: number | null, invested: number | null): Crypto => ({
    id, user_id: 'u1', symbol, name: symbol, quantity, avg_buy_price: avg, current_price: null, peak_price: null,
    invested_amount: invested, sort_order: 0, created_at: '', updated_at: '',
  });
  const cryptos = [coin('btc', 'BTC', 1, 100, 2_500_000), coin('eth', 'ETH', 0, null, null)];
  const gd: CryptoTransaction = {
    ...tx('a1', 'btc', '2026-11-26T10:00:00Z'),
    quantity: 1, price_usd: 100, amount_vnd: 2_500_000,
    before_quantity: 0, before_avg_buy_price: null, before_invested_amount: 0,
    after_quantity: 1, after_avg_buy_price: 100, after_invested_amount: 2_500_000,
  };

  it('bấm Sửa mở form có xem trước; đổi coin thì xem trước cả hai coin; Lưu gửi coin mới', async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined);
    render(<CryptoTransactionList transactions={[gd]} cryptos={cryptos} onDelete={vi.fn()} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa' }));
    expect(screen.getByText('Sửa giao dịch BTC')).toBeInTheDocument();

    const oCoin = screen.getByRole('combobox', { name: 'Coin' });
    fireEvent.focus(oCoin);
    fireEvent.change(oCoin, { target: { value: 'eth' } });
    fireEvent.keyDown(oCoin, { key: 'Enter' });
    // BTC về 0; ETH nhận 1 coin giá $100, vốn 2.500.000 đ.
    expect(screen.getByText(/giao dịch được chuyển sang mã mới/)).toBeInTheDocument();
    expect(screen.getAllByText('ETH').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await vi.waitFor(() => expect(onEdit).toHaveBeenCalled());
    const [txId, coinMoi, input] = onEdit.mock.calls[0];
    expect(txId).toBe('a1');
    expect(coinMoi.id).toBe('eth');
    expect(input).toMatchObject({ crypto_id: 'eth', side: 'BUY', quantity: 1, price_usd: 100, amount_vnd: 2_500_000 });
  });
});

describe('CryptoTransactionList — xoá giao dịch', () => {
  it('mọi dòng có nút Xoá; xác nhận rồi mới gọi onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const list = [tx('a1', 'btc', '2026-11-26T10:00:00Z'), tx('a2', 'btc', '2026-11-26T11:00:00Z')];
    render(<CryptoTransactionList transactions={list} cryptos={[]} onDelete={onDelete} onEdit={vi.fn()} />);
    const nut = screen.getAllByRole('button', { name: 'Xoá' });
    expect(nut).toHaveLength(2);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.click(nut[1]);
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(nut[1]);
    await vi.waitFor(() => expect(onDelete).toHaveBeenCalledWith('a2'));
    confirmSpy.mockRestore();
  });
});
