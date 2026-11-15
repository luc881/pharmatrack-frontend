import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';

import { PutOnSaleDialog } from 'src/sections/animal/put-on-sale-dialog';
import { QuickSalePicker } from 'src/sections/quick-sale/quick-sale-picker';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// «Poner en venta» en corto (especie, cuántos, precio) y el selector de la
// venta rápida con los animales aparte de los productos.
// ----------------------------------------------------------------------

vi.mock('src/components/snackbar', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const API = 'https://api.opuntiaden.com/api/v1';
const page = (data) => ({ data, total: data.length, page: 1, page_size: 500, total_pages: 1 });

const GECKO = {
  id: 1,
  name: 'macularius',
  common_name: 'Gecko leopardo',
  sale_format: 'individual',
  genus: { id: 1, name: 'Eublepharis', group: { id: 1, name: 'Reptiles' } },
};
const ROACH = {
  id: 2,
  name: 'dubia',
  common_name: 'Cucaracha Dubia',
  sale_format: 'package',
  package_size: 6,
  genus: { id: 2, name: 'Blaptica', group: { id: 2, name: 'Insectos' } },
};
const MANTIS = {
  id: 3,
  name: 'wahlbergii',
  common_name: 'Mantis orquídea',
  sale_format: 'individual',
  genus: { id: 3, name: 'Pseudocreobotra', group: { id: 2, name: 'Insectos' } },
};

let sent;

function wrap(ui) {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <MemoryRouter>{ui}</MemoryRouter>
    </Wrapper>
  );
}

beforeEach(() => {
  sent = [];
  const record =
    (method) =>
    async ({ request, params }) => {
      const body = method === 'PATCH' ? null : await request.json();
      sent.push([method, new URL(request.url).pathname.replace('/api/v1', ''), body]);
      return HttpResponse.json({ id: Number(params.id ?? 77), product_id: 700 }, { status: 200 });
    };
  server.use(
    http.get(`${API}/species`, () => HttpResponse.json(page([GECKO, ROACH, MANTIS]))),
    http.get(`${API}/morphs`, () =>
      HttpResponse.json(page([{ id: 5, name: 'Tangerine', species_id: 1 }]))
    ),
    http.get(`${API}/genera`, () =>
      HttpResponse.json(page([GECKO.genus, ROACH.genus, MANTIS.genus]))
    ),
    http.get(`${API}/animal-groups/tree`, () =>
      HttpResponse.json([
        { id: 1, name: 'Reptiles', children: [] },
        // «Mantis» cuelga de «Insectos»: elegir el grupo padre también la trae
        { id: 2, name: 'Insectos', children: [{ id: 3, name: 'Mantis', children: [] }] },
      ])
    ),
    http.post(`${API}/animals`, record('POST')),
    http.put(`${API}/animals/:id`, record('PUT')),
    http.put(`${API}/products/:id`, record('PUT')),
    http.put(`${API}/species/:id`, record('PUT')),
    http.put(`${API}/morphs/:id`, record('PUT')),
    http.patch(`${API}/products/:id/toggle-quick-sale`, record('PATCH'))
  );
});

const PICKER = 'Especie y variedad';

// escribe en el buscador y elige una variedad de lo que quedó
const pick = async (user, dialog, typed, option = 'Nominal') => {
  await user.clear(dialog.getByLabelText(PICKER));
  await user.type(dialog.getByLabelText(PICKER), typed);
  await user.click(await screen.findByRole('option', { name: option }));
};

// encabezados de especie de la lista abierta
const speciesShown = () =>
  [...document.querySelectorAll('.MuiAutocomplete-groupLabel')].map((el) => el.textContent);

describe('Poner en venta (alta corta)', () => {
  it('con especie, cuántos y precio da de alta los ejemplares en venta', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    wrap(<PutOnSaleDialog onClose={() => {}} onDone={onDone} />);
    const dialog = within(await screen.findByRole('dialog'));

    // se encuentra por nombre científico y sin acentos
    await pick(user, dialog, 'eubleph');
    expect(dialog.getByLabelText(PICKER)).toHaveValue(
      'Gecko leopardo (Eublepharis macularius) · Nominal'
    );
    await user.clear(dialog.getByLabelText('¿Cuántos ejemplares?'));
    await user.type(dialog.getByLabelText('¿Cuántos ejemplares?'), '3');
    await user.type(dialog.getByLabelText('Precio de venta'), '1500');
    await user.click(dialog.getByRole('button', { name: 'Poner en venta' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith(1));
    expect(sent).toEqual([
      [
        'POST',
        '/animals',
        {
          species_id: 1,
          purpose: 'sale',
          sex: 'unknown',
          price: 1500,
          price_cost: 0,
          morph_ids: [],
          photos: [],
          count: 3,
          // es el alta de la venta rápida: entra como botón y fuera del sitio
          quick_sale: true,
          show_public: false,
        },
      ],
    ]);
  });

  it('abre con la especie de la fila y deja elegir su variedad', async () => {
    const user = userEvent.setup();
    wrap(<PutOnSaleDialog initialSpecies={GECKO} onClose={() => {}} onDone={() => {}} />);
    const dialog = within(await screen.findByRole('dialog'));

    expect(dialog.getByLabelText(PICKER)).toHaveValue(
      'Gecko leopardo (Eublepharis macularius) · Nominal'
    );
    // la variedad se busca por su nombre, sin pasar por la especie
    await pick(user, dialog, 'tanger', 'Tangerine');
    expect(dialog.getByLabelText(PICKER)).toHaveValue(
      'Gecko leopardo (Eublepharis macularius) · Tangerine'
    );
    await user.type(dialog.getByLabelText('Precio de venta'), '900');
    await user.click(dialog.getByRole('button', { name: 'Poner en venta' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0][2]).toMatchObject({
      species_id: 1,
      morph_ids: [5],
      price: 900,
      quick_sale: true,
    });
    expect(sent[0][2].count).toBeUndefined();
  });

  it('en paquetes pide paquetes y manda existencias', async () => {
    const user = userEvent.setup();
    wrap(<PutOnSaleDialog initialSpecies={ROACH} onClose={() => {}} onDone={() => {}} />);
    const dialog = within(await screen.findByRole('dialog'));

    await user.clear(dialog.getByLabelText('¿Cuántos paquetes de 6?'));
    await user.type(dialog.getByLabelText('¿Cuántos paquetes de 6?'), '4');
    await user.type(dialog.getByLabelText('Precio de venta'), '120');
    await user.click(dialog.getByRole('button', { name: 'Poner en venta' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0][2]).toMatchObject({ species_id: 2, stock: 4, price: 120 });
    expect(sent[0][2].count).toBeUndefined();
  });

  it('si esos paquetes ya están en venta, suma a lo que hay en vez de duplicar', async () => {
    const user = userEvent.setup();
    const existing = {
      id: 40,
      product_id: 400,
      purpose: 'sale',
      status: 'available',
      stock: 6,
      price: 120,
      morphs: [],
      species: ROACH,
    };
    wrap(
      <PutOnSaleDialog
        initialSpecies={ROACH}
        animals={[existing]}
        onClose={() => {}}
        onDone={() => {}}
      />
    );
    const dialog = within(await screen.findByRole('dialog'));

    expect(dialog.getByText(/Ya hay 6 en venta/)).toBeInTheDocument();
    await user.clear(dialog.getByLabelText('¿Cuántos paquetes de 6?'));
    await user.type(dialog.getByLabelText('¿Cuántos paquetes de 6?'), '2');
    await user.click(dialog.getByRole('button', { name: 'Poner en venta' }));

    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent).toEqual([
      ['PUT', '/animals/40', { stock: 8 }],
      ['PUT', '/products/400', { quick_sale: true }],
    ]);
  });

  it('al sumar a lo que ya hay, «Mostrar también en el sitio» lo publica', async () => {
    const user = userEvent.setup();
    const existing = {
      id: 40,
      product_id: 400,
      purpose: 'sale',
      status: 'available',
      stock: 6,
      price: 120,
      morphs: [],
      species: ROACH,
      show_public: false,
    };
    wrap(
      <PutOnSaleDialog initialSpecies={ROACH} animals={[existing]} onClose={() => {}} onDone={() => {}} />
    );
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('checkbox', { name: /Mostrar también en el sitio/ }));
    await user.click(dialog.getByRole('button', { name: 'Poner en venta' }));

    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[0]).toEqual(['PUT', '/animals/40', { stock: 7, show_public: true }]);
  });

  it('los filtros de grupo y género acortan la lista de especies', async () => {
    const user = userEvent.setup();
    wrap(<PutOnSaleDialog onClose={() => {}} onDone={() => {}} />);
    const dialog = within(await screen.findByRole('dialog'));
    const options = async () => {
      await user.click(dialog.getByLabelText(PICKER));
      await screen.findAllByRole('option');
      const names = speciesShown();
      await user.keyboard('{Escape}');
      return names;
    };

    expect(await options()).toHaveLength(3);

    await user.click(dialog.getByLabelText('Grupo'));
    await user.click(await screen.findByRole('option', { name: 'Insectos' }));
    expect(await options()).toEqual([
      'Cucaracha Dubia (Blaptica dubia)',
      'Mantis orquídea (Pseudocreobotra wahlbergii)',
    ]);

    // el género solo ofrece los del grupo elegido
    await user.click(dialog.getByLabelText('Género'));
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual([
      'Blaptica',
      'Pseudocreobotra',
    ]);
    await user.click(screen.getByRole('option', { name: 'Pseudocreobotra' }));
    expect(await options()).toEqual(['Mantis orquídea (Pseudocreobotra wahlbergii)']);
  });

  it('un grupo padre trae también las especies de sus subgrupos', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API}/species`, () =>
        HttpResponse.json(
          page([GECKO, { ...MANTIS, genus: { ...MANTIS.genus, group: { id: 3, name: 'Mantis' } } }])
        )
      )
    );
    wrap(<PutOnSaleDialog onClose={() => {}} onDone={() => {}} />);
    const dialog = within(await screen.findByRole('dialog'));

    await user.click(dialog.getByLabelText('Grupo'));
    await user.click(await screen.findByRole('option', { name: 'Insectos' }));
    await user.click(dialog.getByLabelText(PICKER));
    await screen.findAllByRole('option');
    expect(speciesShown()).toEqual(['Mantis orquídea (Pseudocreobotra wahlbergii)']);
  });

  it('abierto desde una especie no estorba con filtros', async () => {
    wrap(<PutOnSaleDialog initialSpecies={GECKO} onClose={() => {}} onDone={() => {}} />);
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.queryByLabelText('Grupo')).toBeNull();
  });

  it('si se pide, también se anuncia en el sitio', async () => {
    const user = userEvent.setup();
    wrap(<PutOnSaleDialog initialSpecies={GECKO} onClose={() => {}} onDone={() => {}} />);
    const dialog = within(await screen.findByRole('dialog'));
    const site = dialog.getByRole('checkbox', { name: /Mostrar también en el sitio/ });
    expect(site).not.toBeChecked();
    await user.click(site);
    await user.type(dialog.getByLabelText('Precio de venta'), '900');
    await user.click(dialog.getByRole('button', { name: 'Poner en venta' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0][2]).toMatchObject({ show_public: true, quick_sale: true });
  });

  it('no manda nada si falta la especie o el precio', async () => {
    const user = userEvent.setup();
    wrap(<PutOnSaleDialog onClose={() => {}} onDone={() => {}} />);
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Poner en venta' }));

    expect(dialog.getByText('Elige la especie')).toBeInTheDocument();
    expect(dialog.getByText('Escribe un precio mayor a cero')).toBeInTheDocument();
    expect(sent).toEqual([]);
  });
});

// ----------------------------------------------------------------------

describe('Venta rápida: elegir qué se vende', () => {
  const animal = (id, code, species, extra = {}) => ({
    id,
    code,
    product_id: 700 + id,
    purpose: 'sale',
    status: 'available',
    stock: 1,
    price: 500,
    sex: 'unknown',
    morphs: [],
    species,
    ...extra,
  });
  let products;

  beforeEach(() => {
    products = Array.from({ length: 45 }, (_, i) => ({
      id: 100 + i,
      title: `Producto ${String(i + 1).padStart(2, '0')}`,
      price_retail: '10.00',
      quick_sale: false,
    }));
    server.use(
      http.get(`${API}/animals`, () =>
        HttpResponse.json(
          page([
            animal(1, 'G-1', GECKO),
            animal(2, 'G-2', GECKO, { morphs: [{ id: 5, name: 'Tangerine' }] }),
            animal(3, 'M-1', MANTIS),
            animal(4, 'B-1', GECKO, { purpose: 'breeder' }),
            animal(5, 'S-1', GECKO, { status: 'sold' }),
          ])
        )
      ),
      // ya marcado: el gemelo de G-2
      http.get(`${API}/products/quick-sale`, () => HttpResponse.json([{ id: 702 }])),
      http.get(`${API}/products`, ({ request }) => {
        const q = new URL(request.url).searchParams;
        sent.push(['GET', '/products', Object.fromEntries(q)]);
        const size = Number(q.get('page_size'));
        return HttpResponse.json({ data: products.slice(0, size), total: products.length });
      })
    );
  });

  it('los animales en venta van aparte, agrupados por especie', async () => {
    wrap(<QuickSalePicker onClose={() => {}} />);
    const dialog = within(await screen.findByRole('dialog'));

    expect(dialog.getByRole('tab', { name: 'Animales', selected: true })).toBeInTheDocument();
    expect(await dialog.findByText('Gecko leopardo')).toBeInTheDocument();
    expect(dialog.getByText('Mantis orquídea')).toBeInTheDocument();
    // ni pie de cría ni vendidos: no se pueden cobrar
    expect(dialog.queryByText(/B-1/)).toBeNull();
    expect(dialog.queryByText(/S-1/)).toBeNull();
    expect(dialog.getByRole('checkbox', { name: 'Venta rápida: G-2 Tangerine' })).toBeChecked();
    expect(dialog.getByRole('checkbox', { name: 'Venta rápida: G-1' })).not.toBeChecked();
  });

  it('se buscan por nombre científico y se marcan de uno en uno o toda la especie', async () => {
    const user = userEvent.setup();
    wrap(<QuickSalePicker onClose={() => {}} />);
    const dialog = within(await screen.findByRole('dialog'));
    await dialog.findByText('Gecko leopardo');

    await user.type(dialog.getByLabelText('Buscar'), 'pseudocreobotra');
    expect(dialog.queryByText('Gecko leopardo')).toBeNull();
    await user.click(dialog.getByRole('checkbox', { name: 'Venta rápida: M-1' }));
    await waitFor(() => expect(sent).toEqual([['PATCH', '/products/703/toggle-quick-sale', null]]));

    await user.clear(dialog.getByLabelText('Buscar'));
    sent.length = 0;
    await user.click(await dialog.findByRole('button', { name: 'Marcar todos: Gecko leopardo' }));
    // G-2 ya estaba marcado: solo falta G-1
    await waitFor(() => expect(sent).toEqual([['PATCH', '/products/701/toggle-quick-sale', null]]));
  });

  it('solo elige lo que ya hay: las altas viven fuera del selector', async () => {
    wrap(<QuickSalePicker onClose={() => {}} />);
    const dialog = within(await screen.findByRole('dialog', { name: /Qué se vende/ }));
    await dialog.findByText('Gecko leopardo');
    expect(dialog.queryByRole('button', { name: /Alta/ })).toBeNull();
    expect(dialog.queryByRole('link', { name: /Alta|catálogo/ })).toBeNull();
  });

  it('los productos van sin los animales y se pueden ver más de 30', async () => {
    const user = userEvent.setup();
    wrap(<QuickSalePicker onClose={() => {}} />);
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('tab', { name: 'Productos' }));

    expect(await dialog.findByText('Producto 01')).toBeInTheDocument();
    expect(dialog.queryByText('Producto 31')).toBeNull();
    expect(sent.at(-1)[2]).toMatchObject({ exclude_animal_twins: 'true', page_size: '30' });

    await user.click(dialog.getByRole('button', { name: 'Ver más (15)' }));
    expect(await dialog.findByText('Producto 45')).toBeInTheDocument();
    expect(dialog.queryByRole('button', { name: /Ver más/ })).toBeNull();
  });

  it('los animales se filtran por grupo y el buscador sugiere las especies', async () => {
    const user = userEvent.setup();
    wrap(<QuickSalePicker onClose={() => {}} />);
    const dialog = within(await screen.findByRole('dialog'));
    await dialog.findByText('Gecko leopardo');

    await user.click(dialog.getByLabelText('Grupo'));
    await user.click(await screen.findByRole('option', { name: 'Insectos' }));
    expect(dialog.queryByText('Gecko leopardo')).toBeNull();
    expect(dialog.getByText('Mantis orquídea')).toBeInTheDocument();

    // quitar el filtro y elegir una sugerencia
    await user.click(dialog.getByLabelText('Grupo'));
    await user.click(await screen.findByRole('option', { name: 'Todos' }));
    await user.type(dialog.getByLabelText('Buscar'), 'gec');
    await user.click(await screen.findByRole('option', { name: 'Gecko leopardo' }));
    expect(dialog.getByLabelText('Buscar')).toHaveValue('Gecko leopardo');
    expect(dialog.queryByText('Mantis orquídea')).toBeNull();
  });

  it('los productos se filtran por categoría y el buscador sugiere sus nombres', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API}/productscategories`, () =>
        HttpResponse.json(
          page([
            { id: 8, name: 'Sustratos' },
            { id: 9, name: 'Decoración' },
          ])
        )
      )
    );
    wrap(<QuickSalePicker onClose={() => {}} />);
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('tab', { name: 'Productos' }));
    await dialog.findByText('Producto 01');

    await user.click(dialog.getByLabelText('Categoría'));
    await user.click(await screen.findByRole('option', { name: 'Decoración' }));
    await waitFor(() => expect(sent.at(-1)[2]).toMatchObject({ category_id: '9' }));

    await user.type(dialog.getByLabelText('Buscar'), 'Producto 0');
    expect(await screen.findByRole('option', { name: 'Producto 07' })).toBeInTheDocument();
  });
});
