import { it, vi, expect, describe } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';

import { QuickSaleGrid } from 'src/sections/quick-sale/quick-sale-grid';

// ----------------------------------------------------------------------
// Un botón por especie y variedad: con varias opciones (lotes por sexo o
// ejemplares) se elige al tocarlo; con una sola se agrega directo.
// ----------------------------------------------------------------------

const PHYLLIUM = {
  id: 9,
  name: 'Gardabagusi',
  common_name: 'Insecto hoja',
  sale_format: 'piece',
  genus: { name: 'Phyllium' },
};
const GECKO = {
  id: 1,
  name: 'Macularius',
  common_name: 'Gecko leopardo',
  sale_format: 'individual',
  genus: { name: 'Eublepharis' },
};
const TANGERINE = { id: 5, name: 'Tangerine' };

const animalItem = (id, species, { sex = 'unknown', code = `AN-${id}`, price, stock = 1, morphs = [], birth_date = null }) => ({
  id,
  title: `${species.common_name} ${code}`,
  category: 'Animales',
  image: `https://x/${id}.jpg`,
  price_retail: String(price),
  stock,
  is_bundle: false,
  components: [],
  blocked_reason: null,
  animal: { id: id + 1000, code, sex, birth_date, species, morphs },
});

const ITEMS = [
  animalItem(1, PHYLLIUM, { sex: 'unknown', price: 350, stock: 20 }),
  animalItem(2, PHYLLIUM, { sex: 'female', price: 600, stock: 4 }),
  animalItem(3, PHYLLIUM, { sex: 'male', price: 450, stock: 3 }),
  animalItem(4, GECKO, { code: 'G-12', sex: 'female', price: 1500, morphs: [TANGERINE], birth_date: '2025-03-01' }),
  animalItem(5, GECKO, { code: 'G-14', sex: 'male', price: 1200, morphs: [TANGERINE] }),
  animalItem(6, GECKO, { code: 'G-20', sex: 'male', price: 900 }),
  {
    id: 7,
    title: 'Cueva de resina',
    category: 'Decoración',
    image: null,
    price_retail: '80.00',
    stock: 8,
    is_bundle: false,
    components: [],
    blocked_reason: null,
    animal: null,
  },
];

const stockOf = (item) => item.stock;

describe('Venta rápida: un botón por especie y variedad', () => {
  it('junta los lotes y ejemplares iguales; lo demás va como siempre', () => {
    render(<QuickSaleGrid items={ITEMS} stockOf={stockOf} onAdd={() => {}} />);
    const buttons = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(buttons).toEqual([
      'Elegir Insecto hoja, desde $350, Quedan 27',
      'Elegir Gecko leopardo Tangerine, desde $1,200, Quedan 2',
      // una sola opción: botón directo de siempre
      expect.stringMatching(/^Agregar Gecko leopardo AN-6|^Agregar Gecko leopardo G-20/),
      'Agregar Cueva de resina, $80, Quedan 8',
    ]);
  });

  it('por pieza se elige el lote por sexo', async () => {
    const onAdd = vi.fn();
    render(<QuickSaleGrid items={ITEMS} stockOf={stockOf} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: /^Elegir Insecto hoja/ }));

    const dialog = within(screen.getByRole('dialog', { name: 'Insecto hoja' }));
    const options = dialog.getAllByRole('button', { name: /^Agregar/ });
    expect(options.map((o) => o.getAttribute('aria-label'))).toEqual([
      'Agregar Sin sexar, $350, Quedan 20',
      'Agregar Hembra, $600, Quedan 4',
      'Agregar Macho, $450, Quedan 3',
    ]);
    fireEvent.click(options[1]);
    expect(onAdd).toHaveBeenCalledWith(ITEMS[1]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('en individuales se elige el ejemplar por su código', () => {
    const onAdd = vi.fn();
    render(<QuickSaleGrid items={ITEMS} stockOf={stockOf} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: /^Elegir Gecko leopardo Tangerine/ }));

    const dialog = within(screen.getByRole('dialog', { name: 'Gecko leopardo Tangerine' }));
    expect(dialog.getByText('G-12 · Hembra · 2025')).toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: /^Agregar G-14/ }));
    expect(onAdd).toHaveBeenCalledWith(ITEMS[4]);
  });

  it('un lote agotado se ve pero no se puede elegir', () => {
    const onAdd = vi.fn();
    render(
      <QuickSaleGrid
        items={ITEMS}
        stockOf={(item) => (item.id === 2 ? 0 : item.stock)}
        onAdd={onAdd}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /^Elegir Insecto hoja/ }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('button', { name: /^Agregar Hembra/ })).toBeDisabled();
  });
});
