import { MemoryRouter } from 'react-router';
import { http, delay, HttpResponse } from 'msw';
import { it, vi, expect, describe } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { toast } from 'src/components/snackbar';

import { AnimalListView } from 'src/sections/animal/view/animal-list-view';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// Animales en tres páginas (En venta · Pie de cría y crianza · Vendidos y
// bajas): cada una trae solo lo suyo. «Mover a…» y borrado de 5 en 5.
// ----------------------------------------------------------------------

vi.mock('src/layouts/dashboard', () => ({ DashboardContent: ({ children }) => children }));
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({
    user: {
      permissions: [
        'animals.create',
        'animals.update',
        'animals.delete',
        'species.update',
        'morphs.update',
      ],
    },
  }),
}));
vi.mock('src/components/snackbar', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
// Label importa el tema completo (CSS de data-grid), que vitest no carga
vi.mock('src/components/label', () => ({ Label: ({ children }) => <span>{children}</span> }));

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
  common_name: 'Dubia',
  sale_format: 'package',
  package_size: 6,
  genus: { id: 2, name: 'Blaptica', group: { id: 2, name: 'Insectos' } },
};

let nextId = 1;
const animal = (code, purpose, status = 'available', extra = {}) => ({
  id: nextId++,
  code,
  purpose,
  status,
  stock: 1,
  price: 500,
  sex: 'unknown',
  morphs: [],
  species_id: GECKO.id,
  species: GECKO,
  ...extra,
});

const TANGERINE = { id: 5, name: 'Tangerine', species_id: GECKO.id, show_public: true };

const ANIMALS = [
  animal('V-1', 'sale', 'available', { requires_legal_doc: true, legal_doc: null }),
  animal('V-2', 'sale', 'available', { morphs: [TANGERINE] }),
  animal('V-3', 'sale', 'reserved'),
  animal('B-1', 'breeder', 'available', { price: 0 }),
  animal('B-2', 'breeder', 'available', { price: 0 }),
  animal('C-1', 'growing', 'available', { price: 0 }),
  animal('S-1', 'sale', 'sold'),
];

function mockApi(animals = ANIMALS, extra = []) {
  server.use(
    http.get(`${API}/animals`, () => HttpResponse.json(page(animals))),
    http.get(`${API}/species`, () => HttpResponse.json(page([GECKO, ROACH]))),
    http.get(`${API}/genera`, () => HttpResponse.json(page([]))),
    http.get(`${API}/animal-groups/tree`, () => HttpResponse.json([])),
    http.get(`${API}/morphs`, () => HttpResponse.json(page([TANGERINE]))),
    ...extra
  );
}

function renderView(area = 'sale') {
  const Wrapper = createWrapper();
  return render(
    <ThemeProvider theme={createTheme({ cssVariables: true })}>
      <Wrapper>
        <MemoryRouter>
          <AnimalListView area={area} />
        </MemoryRouter>
      </Wrapper>
    </ThemeProvider>
  );
}

const rowOf = (name) => screen.getByRole('link', { name }).closest('tr');
const codes = () =>
  screen
    .getAllByRole('link')
    .map((l) => l.textContent)
    .filter((t) => /^[A-Z]-\d+$/.test(t));

describe('Animales: En venta', () => {
  it('solo trae lo que se vende, con sus disponibles y apartados', async () => {
    mockApi();
    renderView('sale');

    expect(await screen.findByRole('heading', { name: 'En venta' })).toBeInTheDocument();
    await screen.findByRole('link', { name: 'V-1' });
    // agrupados por variedad: la nominal primero
    expect(codes()).toEqual(['V-1', 'V-3', 'V-2']);
    // sin contador arriba: el conteo va en cada especie
    expect(screen.queryByText(/disponibles ·/)).toBeNull();
    expect(screen.getByText('3 en venta')).toBeInTheDocument();
    // pide documento y no tiene folio
    expect(screen.getByText('1 doc. pendiente')).toBeInTheDocument();
    // una sola cosa aquí: no hay filtro por destino
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('el alta es la completa, ya como venta; no hay alta corta', async () => {
    mockApi();
    renderView('sale');

    await screen.findByRole('link', { name: 'V-1' });
    expect(screen.queryByRole('button', { name: 'Poner en venta' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Nuevo ejemplar en venta' })).toHaveAttribute(
      'href',
      '/dashboard/animal/new?purpose=sale'
    );
    // por especie, ya con la especie elegida
    expect(within(rowOf('Gecko leopardo')).getByRole('link', { name: 'Nuevo ejemplar' })).toHaveAttribute(
      'href',
      '/dashboard/animal/new?species_id=1&purpose=sale'
    );
    expect(screen.getByRole('link', { name: 'Tabla de precios' })).toHaveAttribute(
      'href',
      '/dashboard/animal/sheet'
    );
  });

  it('Mover a… deshabilitado para un apartado con su razón', async () => {
    mockApi();
    renderView('sale');

    await screen.findByRole('link', { name: 'V-3' });
    fireEvent.click(within(rowOf('V-3')).getByRole('button', { name: 'Mover a…' }));

    const items = await screen.findAllByRole('menuitem');
    expect(items).toHaveLength(2);
    items.forEach((item) => {
      expect(item).toHaveAttribute('aria-disabled', 'true');
      expect(item).toHaveTextContent('Primero libera el apartado');
    });
  });

  it('los paquetes se cuentan en paquetes y animales', async () => {
    mockApi([animal('P-1', 'sale', 'available', { stock: 6, species_id: 2, species: ROACH })]);
    renderView('sale');
    expect(await screen.findByText('6 paquetes en venta (36)')).toBeInTheDocument();
  });

  it('sin nada en venta invita a poner algo', async () => {
    mockApi([animal('B-9', 'breeder', 'available', { price: 0 })]);
    renderView('sale');
    expect(await screen.findByText('Todavía no hay nada en venta')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'B-9' })).toBeNull();
  });
});

describe('Animales: buscar por especie o variedad', () => {
  it('escribir la variedad filtra a ella; la nominal se ve como tal', async () => {
    const user = userEvent.setup();
    mockApi();
    renderView('sale');
    await screen.findByRole('link', { name: 'V-1' });
    // en la lista, sin morph se dice «Nominal»
    expect(within(rowOf('V-1')).getByText('Nominal')).toBeInTheDocument();
    expect(within(rowOf('V-2')).getByText('Tangerine')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Especie o variedad'), 'tanger');
    await user.click(await screen.findByRole('option', { name: 'Tangerine' }));
    expect(codes()).toEqual(['V-2']);

    // la opción base de la especie trae todas sus variedades
    await user.clear(screen.getByLabelText('Especie o variedad'));
    await user.type(screen.getByLabelText('Especie o variedad'), 'gecko');
    await user.click(await screen.findByRole('option', { name: 'Todas las variedades' }));
    // agrupados por variedad: la nominal primero
    expect(codes()).toEqual(['V-1', 'V-3', 'V-2']);
  });
});

describe('Animales: si se ve en el sitio', () => {
  const sent = [];
  const record = (kind) => async ({ request, params }) => {
    sent.push([kind, Number(params.id), await request.json()]);
    return HttpResponse.json({ id: Number(params.id) });
  };

  it('En venta prende y apaga la especie y cada variedad en el sitio', async () => {
    const user = userEvent.setup();
    sent.length = 0;
    mockApi(ANIMALS, [
      http.put(`${API}/species/:id`, record('species')),
      http.put(`${API}/morphs/:id`, record('morph')),
    ]);
    renderView('sale');
    await screen.findByRole('link', { name: 'V-1' });

    const speciesSwitch = screen.getByRole('switch', { name: 'En el sitio: Gecko leopardo' });
    expect(speciesSwitch).toBeChecked();
    await user.click(speciesSwitch);
    await waitFor(() => expect(sent).toEqual([['species', 1, { show_public: false }]]));

    await user.click(screen.getByRole('switch', { name: 'En el sitio: Tangerine' }));
    await waitFor(() => expect(sent.at(-1)).toEqual(['morph', 5, { show_public: false }]));
  });

  it('Pie de cría no anuncia nada: no hay interruptor del sitio', async () => {
    mockApi();
    renderView('breeding');
    await screen.findByRole('link', { name: 'B-1' });
    expect(screen.queryByRole('switch', { name: /En el sitio/ })).toBeNull();
  });
});

describe('Animales: Pie de cría y crianza', () => {
  it('solo trae lo que no se vende, con filtro por destino', async () => {
    mockApi();
    renderView('breeding');

    expect(
      await screen.findByRole('heading', { name: 'Pie de cría y crianza' })
    ).toBeInTheDocument();
    await screen.findByRole('link', { name: 'B-1' });
    expect(codes()).toEqual(['B-1', 'B-2', 'C-1']);
    expect(screen.getByRole('tab', { name: 'Todo' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Pie de cría (2)' }));
    expect(codes()).toEqual(['B-1', 'B-2']);

    // la tarjeta también filtra
    fireEvent.click(screen.getByRole('button', { name: /En crianza\s*1/ }));
    expect(codes()).toEqual(['C-1']);
  });

  it('el alta nace como pie de cría', async () => {
    mockApi();
    renderView('breeding');
    await screen.findByRole('link', { name: 'B-1' });
    expect(screen.getByRole('link', { name: 'Registrar ejemplar' })).toHaveAttribute(
      'href',
      '/dashboard/animal/new?purpose=breeder'
    );
    expect(screen.queryByRole('button', { name: 'Poner en venta' })).toBeNull();
  });

  it('Mover a… → Poner en venta abre el diálogo', async () => {
    mockApi();
    renderView('breeding');

    await screen.findByRole('link', { name: 'B-1' });
    const row = rowOf('B-1');
    expect(within(row).getByRole('link', { name: 'Anotar' })).toHaveAttribute(
      'href',
      '/dashboard/animal/log?species=1'
    );
    fireEvent.click(within(row).getByRole('button', { name: 'Mover a…' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Poner en venta/ }));

    expect(await screen.findByText('Mover a En venta')).toBeInTheDocument();
    expect(screen.getByLabelText(/Precio de venta/)).toBeInTheDocument();
  });

  it('un paquete vacío solo se ve en «Todo»', async () => {
    mockApi([animal('P-0', 'growing', 'available', { stock: 0, species_id: 2, species: ROACH })]);
    renderView('breeding');

    expect(await screen.findByRole('link', { name: 'P-0' })).toBeInTheDocument();
    expect(within(rowOf('P-0')).getByText('Vacío')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'En crianza (0)' }));
    expect(screen.queryByRole('link', { name: 'P-0' })).not.toBeInTheDocument();
  });
});

describe('Animales: Vendidos y bajas', () => {
  it('es el historial: ni venta ni cría, y sin altas', async () => {
    mockApi([...ANIMALS, animal('D-1', 'breeder', 'deceased', { price: 0 })]);
    renderView('history');

    expect(await screen.findByRole('heading', { name: 'Vendidos y bajas' })).toBeInTheDocument();
    await screen.findByRole('link', { name: 'S-1' });
    expect(codes()).toEqual(['S-1', 'D-1']);
    fireEvent.click(screen.getByRole('tab', { name: 'Bajas (1)' }));
    expect(codes()).toEqual(['D-1']);
    expect(screen.queryByRole('link', { name: /Registrar|Alta/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Poner en venta' })).toBeNull();
  });
});

describe('Animales: por dónde se vende (canales)', () => {
  // V-1 solo tienda · V-2 tienda y venta rápida · V-3 solo venta rápida
  const channels = () =>
    ANIMALS.map((a) =>
      a.code === 'V-1'
        ? { ...a, show_public: true, quick_sale: false }
        : a.code === 'V-2'
          ? { ...a, show_public: true, quick_sale: true }
          : a.code === 'V-3'
            ? { ...a, show_public: false, quick_sale: true }
            : a
    );

  it('cada ejemplar dice si está en la tienda, en la venta rápida o en las dos', async () => {
    mockApi(channels());
    renderView('sale');
    await screen.findByRole('link', { name: 'V-1' });
    expect(within(rowOf('V-1')).getByText('Tienda')).toBeInTheDocument();
    expect(within(rowOf('V-1')).queryByText('Venta rápida')).toBeNull();
    expect(within(rowOf('V-2')).getByText('Tienda')).toBeInTheDocument();
    expect(within(rowOf('V-2')).getByText('Venta rápida')).toBeInTheDocument();
    expect(within(rowOf('V-3')).queryByText('Tienda')).toBeNull();
  });

  it('se filtra por canal', async () => {
    const user = userEvent.setup();
    mockApi(channels());
    renderView('sale');
    await screen.findByRole('link', { name: 'V-1' });

    await user.click(screen.getByLabelText('Dónde se vende'));
    await user.click(await screen.findByRole('option', { name: 'Solo venta rápida' }));
    expect(codes()).toEqual(['V-3']);

    await user.click(screen.getByLabelText('Dónde se vende'));
    await user.click(await screen.findByRole('option', { name: 'En la venta rápida' }));
    expect(codes()).toEqual(['V-3', 'V-2']);
  });

  it('varios a la vez a la venta rápida, con un solo menú', async () => {
    const user = userEvent.setup();
    const sent = [];
    mockApi(channels(), [
      http.put(`${API}/animals/:id`, async ({ request, params }) => {
        sent.push([Number(params.id), await request.json()]);
        return HttpResponse.json({ id: Number(params.id) });
      }),
    ]);
    renderView('sale');
    await screen.findByRole('link', { name: 'V-1' });

    fireEvent.click(within(rowOf('V-1')).getByRole('checkbox'));
    fireEvent.click(within(rowOf('V-2')).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Canales (2)' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Agregar a la venta rápida' }));

    const id = (code) => ANIMALS.find((a) => a.code === code).id;
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent).toEqual(
      expect.arrayContaining([
        [id('V-1'), { quick_sale: true }],
        [id('V-2'), { quick_sale: true }],
      ])
    );
  });
});

describe('Animales: borrar por bloque', () => {
  it('cada especie y cada variedad tienen su botón para borrar lo suyo', async () => {
    const user = userEvent.setup();
    const deleted = [];
    mockApi(ANIMALS, [
      http.delete(`${API}/animals/:id`, ({ params }) => {
        deleted.push(Number(params.id));
        return new HttpResponse(null, { status: 204 });
      }),
    ]);
    renderView('sale');
    await screen.findByRole('link', { name: 'V-1' });

    // la especie entera (los 3 en venta) y, dentro, cada variedad
    expect(screen.getByRole('button', { name: 'Eliminar los 3 de Gecko leopardo' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Eliminar Tangerine (1)' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    const v2 = ANIMALS.find((a) => a.code === 'V-2').id;
    await waitFor(() => expect(deleted).toEqual([v2]));
  });
});

describe('Animales: borrado', () => {
  it('borrado múltiple manda máximo 5 a la vez', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    let deleted = 0;
    const many = Array.from({ length: 12 }, (_, i) => animal(`M-${i + 1}`, 'sale'));
    mockApi(many, [
      http.delete(`${API}/animals/:id`, async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await delay(20);
        inFlight -= 1;
        deleted += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    ]);
    renderView();

    await screen.findByRole('link', { name: 'M-1' });
    // casilla de la cabecera: selecciona todos los de la especie
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar (12)' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('12 animales eliminados'));
    expect(deleted).toBe(12);
    expect(maxInFlight).toBeLessThanOrEqual(5);
    expect(maxInFlight).toBeGreaterThan(1);
  });
});
