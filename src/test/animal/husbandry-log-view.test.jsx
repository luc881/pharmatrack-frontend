import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { it, vi, expect, describe } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { toast } from 'src/components/snackbar';

import { HusbandryLogView } from 'src/sections/animal/view/husbandry-log-view';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// Bitácora de manejo: especies con plan arriba (solo nombres); tocar una
// despliega sus ejemplares por código, cada uno con su «Anotar».
// ----------------------------------------------------------------------

vi.mock('src/layouts/dashboard', () => ({ DashboardContent: ({ children }) => children }));
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: { permissions: ['animals.update'] } }),
}));
// Label importa el tema completo (CSS de data-grid), que vitest no carga
vi.mock('src/components/snackbar', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('src/components/label', () => ({ Label: ({ children }) => <span>{children}</span> }));

const API = 'https://api.opuntiaden.com/api/v1';
const SPECIES = { id: 7, name: 'gardabagusi', common_name: 'Hoja', genus: { name: 'Phyllium' } };
const PLAN = [
  { kind: 'supplement', name: 'Calcio', every_days: 7 },
  { kind: 'food', name: 'Zarzamora', every_days: 2 },
];
const page = (data) => ({ data, total: data.length, page: 1, page_size: 100, total_pages: 1 });

function renderView() {
  const Wrapper = createWrapper();
  return render(
    <ThemeProvider theme={createTheme({ cssVariables: true })}>
      <Wrapper>
        <MemoryRouter>
          <HusbandryLogView />
        </MemoryRouter>
      </Wrapper>
    </ThemeProvider>
  );
}

function mockApi({ species = [SPECIES], status = [], animals = [], onSave, onPlan, commitments }) {
  server.use(
    http.get(`${API}/animals/:id/commitments`, () =>
      HttpResponse.json(commitments ?? { status: 'available', sale: null, deliveries: [] })
    ),
    http.put(`${API}/species/7`, async ({ request }) => {
      const body = await request.json();
      onPlan?.(body);
      return HttpResponse.json({ ...SPECIES, ...body });
    }),
    http.get(`${API}/species`, () => HttpResponse.json(page(species))),
    http.get(`${API}/genera`, () => HttpResponse.json(page([]))),
    http.get(`${API}/animal-groups/tree`, () => HttpResponse.json([])),
    http.get(`${API}/morphs`, () => HttpResponse.json(page([]))),
    http.get(`${API}/husbandry-logs`, () => HttpResponse.json(page([]))),
    http.get(`${API}/husbandry-logs/status`, () => HttpResponse.json(status)),
    http.get(`${API}/husbandry-logs/reminder`, () => HttpResponse.json({ hour: 8, configured: true })),
    http.get(`${API}/animals`, () => HttpResponse.json(page(animals))),
    http.post(`${API}/husbandry-logs`, async ({ request }) => {
      const body = await request.json();
      onSave?.(body);
      return HttpResponse.json({ id: 1, ...body }, { status: 201 });
    })
  );
}

describe('HusbandryLogView', () => {
  it('sin planes explica cómo agregarlos y deja anotar en cualquier especie', async () => {
    let saved = null;
    mockApi({ onSave: (b) => (saved = b) });
    renderView();

    expect(await screen.findByText(/ninguna especie tiene plan/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver especies/i }));
    fireEvent.click(await screen.findByRole('button', { name: /hoja/i }));
    expect(await screen.findByText(/no hay ejemplares/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Anotar para toda la especie' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Todo' }));
    // estado «Otro» pide qué presenta; el peso va en gramos
    fireEvent.click(screen.getByRole('button', { name: 'Otro' }));
    fireEvent.change(await screen.findByLabelText('¿Qué presenta?'), {
      target: { value: 'Mudando' },
    });
    fireEvent.change(screen.getByLabelText(/peso/i), { target: { value: '42.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved).toMatchObject({
      species_id: 7,
      morph_id: null,
      fed: true,
      food_type: null,
      pieces: null,
      grams: null,
      appetite: 'good',
      condition: 'other',
      condition_note: 'Mudando',
      weight_g: 42.5,
      activities: [],
      supplement: null,
      deaths: null,
      animal_id: null,
      photos: [],
    });
    expect(saved.log_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('«Agregar plan» abre el plan ahí mismo, sin ir a la ficha', async () => {
    let plan = null;
    mockApi({ onPlan: (b) => (plan = b) });
    renderView();

    fireEvent.click(await screen.findByRole('button', { name: /ver especies/i }));
    fireEvent.click(await screen.findByRole('button', { name: /hoja/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar plan' }));
    // ya trae un renglón de comida para llenar
    fireEvent.change(await screen.findByRole('combobox', { name: 'Qué' }), {
      target: { value: 'Zarzamora' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar plan/i }));

    await waitFor(() => expect(plan).not.toBeNull());
    expect(plan).toEqual({ husbandry_plan: [{ kind: 'food', name: 'Zarzamora', every_days: 3 }] });
  });

  it('no guarda una entrada vacía', async () => {
    let saved = null;
    mockApi({ species: [{ ...SPECIES, husbandry_plan: PLAN }], onSave: (b) => (saved = b) });
    renderView();

    fireEvent.click(await screen.findByRole('button', { name: /hoja/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Anotar para toda la especie' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/marca si comió/i))
    );
    expect(saved).toBeNull();
  });

  it('arriba solo nombres y lo que toca; dentro, el plan y las bajas de una cepa', async () => {
    let saved = null;
    const status = [
      {
        species_id: 7,
        species_name: 'Phyllium gardabagusi',
        common_name: 'Hoja',
        last_fed: null,
        month: {},
        plan: [
          {
            kind: 'supplement',
            name: 'Calcio',
            every_days: 7,
            last_done: null,
            next_due: '2026-10-10',
            days_overdue: 2,
          },
          {
            kind: 'food',
            name: 'Zarzamora',
            every_days: 2,
            last_done: null,
            next_due: '2026-10-20',
            days_overdue: -8,
          },
        ],
      },
    ];
    mockApi({
      species: [{ ...SPECIES, husbandry_plan: PLAN }],
      status,
      animals: [{ id: 55, code: 'AN-55', stock: 10, morphs: [] }],
      onSave: (b) => (saved = b),
    });
    renderView();

    // arriba: nombres y el aviso de lo más atrasado; sin «Hecho» ni «Comió»
    expect(await screen.findByText('Atrasado 2 d')).toBeInTheDocument();
    expect(screen.getByText('Phyllium gardabagusi')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hecho' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /hoja/i }));
    expect(await screen.findByText('Zarzamora · cada 2 d')).toBeInTheDocument();
    expect(screen.getByText('AN-55')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Anotar para toda la especie' }));
    // el switch registra el suplemento del plan, sin escribirlo
    fireEvent.click(await screen.findByRole('switch', { name: 'Se suplementó con Calcio' }));
    fireEvent.click(screen.getByRole('button', { name: /más detalles/i }));
    fireEvent.change(screen.getByLabelText('Bajas'), { target: { value: '2' } });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /descontar del inventario/i }));
    fireEvent.click(await screen.findByRole('option', { name: /AN-55/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved).toMatchObject({
      species_id: 7,
      fed: false,
      deaths: 2,
      animal_id: 55,
      supplement: 'Calcio',
    });
  });

  it('«Anotar» de un ejemplar queda fijo en su código; suplemento y baja con switch', async () => {
    const saved = [];
    mockApi({
      species: [{ ...SPECIES, sale_format: 'individual' }],
      animals: [
        { id: 2, code: 'EJ-002', sex: 'male', status: 'available', stock: 1, morphs: [] },
        { id: 1, code: 'EJ-001', sex: 'female', status: 'available', stock: 1, morphs: [] },
        { id: 3, code: 'EJ-003', status: 'sold', stock: 0, morphs: [] },
        { id: 4, code: 'EJ-004', status: 'deceased', stock: 0, morphs: [] },
      ],
    });
    // lo guardado sale en las entradas del día (✓) y en el historial
    server.use(
      http.get(`${API}/husbandry-logs`, () => HttpResponse.json(page(saved))),
      http.post(`${API}/husbandry-logs`, async ({ request }) => {
        const body = await request.json();
        const log = {
          id: saved.length + 1,
          ...body,
          animal_code: `EJ-00${body.animal_id}`,
          species_name: 'Phyllium gardabagusi',
          species_common_name: 'Hoja',
        };
        saved.push(log);
        return HttpResponse.json(log, { status: 201 });
      })
    );
    renderView();

    fireEvent.click(await screen.findByRole('button', { name: /ver especies/i }));
    fireEvent.click(await screen.findByRole('button', { name: /hoja/i }));
    // la lista va por código y el vendido no aparece
    await screen.findByText('EJ-001');
    expect(screen.queryByText('EJ-003')).not.toBeInTheDocument();
    // el que murió sigue en la lista, al final y sin «Anotar»
    expect(screen.getByText('EJ-004')).toBeInTheDocument();
    expect(screen.getByText('Murió')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Anotar' })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Anotar' })[0]);
    // el título dice de quién es y no se puede cambiar a otro ejemplar
    expect(await screen.findByText(/Anotar en la bitácora · EJ-001/)).toBeInTheDocument();
    expect(screen.queryByText('¿De quién?')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /asistida/i }));
    fireEvent.click(screen.getByRole('switch', { name: 'Se suplementó' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Baja: murió' }));
    expect(screen.getByText(/EJ-001 queda como «Murió»/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({
      animal_id: 1,
      assisted: true,
      fed: true,
      appetite: null,
      supplement: 'Suplemento',
      deaths: 1,
    });

    // el diálogo tarda en cerrarse y soltar el resto de la página
    await waitFor(
      () => expect(screen.getAllByRole('button', { name: 'Anotar' })).toHaveLength(2),
      { timeout: 3000 }
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Anotar' })[1]);
    expect(await screen.findByText(/Anotar en la bitácora · EJ-002/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Poco' }));
    fireEvent.click(screen.getByRole('button', { name: 'Letárgico' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(saved).toHaveLength(2));
    expect(saved[1]).toMatchObject({
      animal_id: 2,
      assisted: false,
      fed: true,
      appetite: 'poor',
      condition: 'lethargic',
      condition_note: null,
    });

    // historial tipo hoja: nombre común, ejemplar y «Asistida»
    expect(await screen.findAllByText('Hoja')).not.toHaveLength(0);
    expect(
      await screen.findByRole('button', { name: 'EJ-001' }, { timeout: 5000 })
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Asistida' })).toBeInTheDocument();
  }, 30000);

  it('la baja de un ejemplar vendido ofrece cambiarlo por otro disponible', async () => {
    let saved = null;
    mockApi({
      species: [{ ...SPECIES, sale_format: 'individual' }],
      animals: [
        { id: 1, code: 'RAU-001', sex: 'female', status: 'sold', stock: 0, morphs: [] },
        { id: 3, code: 'RAU-003', sex: 'male', status: 'available', stock: 1, price: 4500, morphs: [] },
      ],
      commitments: {
        status: 'sold',
        sale: { id: 88, date_sale: '2026-10-11T18:00:00' },
        deliveries: [{ id: 5, buyer_name: 'Ana', scheduled_date: '2026-10-20' }],
      },
      onSave: (b) => (saved = b),
    });
    renderView();

    fireEvent.click(await screen.findByRole('button', { name: /ver especies/i }));
    fireEvent.click(await screen.findByRole('button', { name: /hoja/i }));
    // el vendido no está en la tabla; su baja se anota desde «Murió uno ya vendido»
    expect(await screen.findByText('RAU-003')).toBeInTheDocument();
    expect(screen.queryByText('RAU-001')).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /murió uno ya vendido/i }));
    fireEvent.click(await screen.findByRole('option', { name: 'RAU-001' }));

    // abre con la baja puesta y dice a qué estaba comprometido
    expect(await screen.findByText(/Anotar en la bitácora · RAU-001/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Baja: murió' })).toBeChecked();
    expect(await screen.findByText(/venta #88/)).toBeInTheDocument();
    expect(screen.getByText(/entrega pendiente de Ana/)).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: /lo cambias por otro/i }));
    fireEvent.click(await screen.findByRole('option', { name: /RAU-003 · Macho/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved).toMatchObject({ animal_id: 1, deaths: 1, replacement_animal_id: 3 });
  });

  it('el suplemento se sigue por ejemplar: cuenta el de toda la especie o el suyo', async () => {
    const day = (n) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    };
    mockApi({
      species: [{ ...SPECIES, husbandry_plan: [PLAN[0]] }],
      status: [
        {
          species_id: 7,
          species_name: 'Phyllium gardabagusi',
          common_name: 'Hoja',
          month: {},
          plan: [{ ...PLAN[0], next_due: day(2), days_overdue: 2, pending_codes: ['EJ-2'] }],
        },
      ],
      animals: [
        { id: 1, code: 'EJ-1', status: 'available', morphs: [] },
        { id: 2, code: 'EJ-2', status: 'available', morphs: [] },
      ],
    });
    server.use(
      http.get(`${API}/husbandry-logs`, () =>
        HttpResponse.json(
          page([
            { id: 2, species_id: 7, animal_id: 1, log_date: day(0), supplement: 'calcio ' },
            { id: 1, species_id: 7, animal_id: null, log_date: day(9), supplement: 'Calcio' },
          ])
        )
      )
    );
    renderView();

    // arriba dice a quién le falta
    fireEvent.click(await screen.findByRole('button', { name: /hoja/i }));
    expect(screen.getByText('Atrasado 2 d · EJ-2')).toBeInTheDocument();
    // dentro: EJ-1 al día por su entrada; EJ-2 solo tiene la de toda la especie
    const row = async (code) => (await screen.findByText(code)).closest('tr');
    expect((await row('EJ-1')).textContent).toContain('En 7 días');
    expect((await row('EJ-2')).textContent).toContain('Atrasado 2 d');
  });
});
