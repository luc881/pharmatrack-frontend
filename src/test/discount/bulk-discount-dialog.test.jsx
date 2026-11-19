import { it, vi, expect, describe } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';

import { DiscountPrice, BulkDiscountDialog } from 'src/sections/discount/bulk-discount-dialog';

vi.mock('src/components/snackbar', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('src/components/label', () => ({ Label: ({ children }) => <span>{children}</span> }));

const ITEMS = [
  { id: 1, name: 'Phyllium hembra', price: 600, compare_at_price: null },
  { id: 2, name: 'Cueva de resina', price: 72, compare_at_price: 80 },
  { id: 3, name: 'Pinza', price: 10, compare_at_price: null },
];

const open = (props = {}) => {
  const onSave = vi.fn(() => Promise.resolve());
  const onDone = vi.fn();
  render(<BulkDiscountDialog open items={ITEMS} onSave={onSave} onDone={onDone} onClose={() => {}} {...props} />);
  return { onSave, onDone, dialog: within(screen.getByRole('dialog')) };
};

describe('Descuento en bloque', () => {
  it('muestra cómo quedan antes de aplicar y aplica el % a cada uno', async () => {
    const { onSave, onDone, dialog } = open();
    fireEvent.change(dialog.getByLabelText('Descuento (%)'), { target: { value: '20' } });

    const row = (name) => within(dialog.getByText(name).closest('tr'));
    expect(row('Phyllium hembra').getByText('$480')).toBeInTheDocument();
    // ya tenía oferta: se parte del precio de antes, sin acumular
    expect(row('Cueva de resina').getByText('$64')).toBeInTheDocument();

    fireEvent.click(dialog.getByRole('button', { name: 'Aplicar −20%' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onSave.mock.calls).toEqual([
      [ITEMS[0], { price: 480, compare_at_price: 600 }],
      [ITEMS[1], { price: 64, compare_at_price: 80 }],
      [ITEMS[2], { price: 8, compare_at_price: 10 }],
    ]);
  });

  it('«Redondear a decenas» deja precios cerrados en la vista previa y al guardar', async () => {
    const { onSave, onDone, dialog } = open({
      items: [{ id: 4, name: 'Musgo', price: 150, compare_at_price: null }],
    });
    fireEvent.change(dialog.getByLabelText('Descuento (%)'), { target: { value: '15' } });
    const row = within(dialog.getByText('Musgo').closest('tr'));
    expect(row.getByText('$128')).toBeInTheDocument();

    fireEvent.click(dialog.getByRole('checkbox', { name: 'Redondear a decenas' }));
    expect(row.getByText('$130')).toBeInTheDocument();

    fireEvent.click(dialog.getByRole('button', { name: 'Aplicar −15%' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onSave.mock.calls[0][1]).toEqual({ price: 130, compare_at_price: 150 });
  });

  it('el porcentaje va de 1 a 90', () => {
    const { dialog } = open();
    fireEvent.change(dialog.getByLabelText('Descuento (%)'), { target: { value: '95' } });
    expect(dialog.getByRole('button', { name: /^Aplicar/ })).toBeDisabled();
    expect(dialog.getByText('De 1 a 90')).toBeInTheDocument();
  });

  it('«Quitar descuento» regresa al precio de antes solo a los que tienen', async () => {
    const { onSave, onDone, dialog } = open();
    fireEvent.click(dialog.getByRole('button', { name: 'Quitar descuento (1)' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(onSave.mock.calls).toEqual([[ITEMS[1], { price: 80, compare_at_price: null }]]);
  });
});

describe('Precio con descuento en las listas', () => {
  it('lleva el de antes tachado y el porcentaje', () => {
    render(<DiscountPrice price={480} compareAt={600} />);
    expect(screen.getByText('$480')).toBeInTheDocument();
    expect(screen.getByText('$600')).toHaveStyle({ textDecoration: 'line-through' });
    expect(screen.getByText('−20%')).toBeInTheDocument();
  });

  it('sin descuento es solo el precio', () => {
    render(<DiscountPrice price={600} compareAt={null} />);
    expect(screen.getByText('$600')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).toBeNull();
  });
});
