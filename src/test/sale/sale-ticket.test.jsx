import { it, expect, describe } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { SaleTicket } from 'src/sections/sale/sale-ticket';
import { SAMPLE_TICKET, fmtTicketDate } from 'src/sections/sale/print-ticket';

describe('ticket de venta', () => {
  it('muestra la fecha UTC del API en hora de CDMX', () => {
    expect(fmtTicketDate('2026-10-19T18:40:00')).toBe('19/10/2026 12:40');
  });

  it('arma subtotal, descuento, total y el QR', async () => {
    const { container } = render(<SaleTicket ticket={SAMPLE_TICKET} width={58} />);

    expect(screen.getByText('OD-000123')).toBeInTheDocument();
    expect(screen.getByText('$2,600.00')).toBeInTheDocument(); // 3 × 450 + 1 × 1,250
    expect(screen.getByText('−$100.00')).toBeInTheDocument();
    expect(screen.getByText('$2,650.00 MXN')).toBeInTheDocument();
    expect(screen.getByText('Phyllium gardabagusi')).toHaveClass('sci');
    expect(container.querySelector('.od-ticket--58')).not.toBeNull();
    await waitFor(() => expect(container.querySelector('.qr svg')).not.toBeNull());
  });
});
