import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { it, vi, expect, describe, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { toast } from 'src/components/snackbar';

import { CareSheetForm } from 'src/sections/care-sheet/care-sheet-form';
import { CareSheetListView } from 'src/sections/care-sheet/view/care-sheet-list-view';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// Fichas de cuidados: la lista muestra fichas y «+ Ficha nueva»; crear manda
// el body completo con sus listas; un 409 enseña el detail del API.
// ----------------------------------------------------------------------

vi.mock('src/layouts/dashboard', () => ({ DashboardContent: ({ children }) => children }));
// DataGrid y Label importan CSS que vitest no carga: tabla mínima con las mismas columnas
vi.mock('src/components/label', () => ({ Label: ({ children }) => children }));
vi.mock('@mui/x-data-grid', () => ({
  gridClasses: { cell: 'cell' },
  DataGrid: ({ rows, columns }) => (
    <table>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {columns.map((c) => (
              <td key={c.field}>
                {c.renderCell?.({ row }) ?? c.valueGetter?.(row[c.field], row) ?? row[c.field]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));
vi.mock('src/components/snackbar', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({
    user: { permissions: ['species.read', 'species.create', 'species.update', 'species.delete'] },
  }),
}));

const API = 'https://api.opuntiaden.com/api/v1';
const page = (data) => ({ data, total: data.length, page: 1, page_size: 500, total_pages: 1 });

const SPECIES = [
  {
    id: 3,
    name: 'imperator',
    common_name: 'Escorpión emperador',
    genus: { id: 1, name: 'Pandinus' },
  },
  { id: 7, name: 'ferrugineum', common_name: null, genus: { id: 2, name: 'Pylarthus' } },
];

function renderUi(ui) {
  const Wrapper = createWrapper();
  return render(
    <ThemeProvider theme={createTheme({ cssVariables: true })}>
      <Wrapper>
        <MemoryRouter>{ui}</MemoryRouter>
      </Wrapper>
    </ThemeProvider>
  );
}

const region = (name) => screen.getByRole('region', { name });
const type = (el, value) => fireEvent.change(el, { target: { value } });

async function fillMinimal() {
  const species = await screen.findByLabelText('Especie *');
  fireEvent.mouseDown(species);
  fireEvent.click(await screen.findByText('Escorpión emperador (Pandinus imperator)'));
  type(screen.getByLabelText('Resumen *'), 'El clásico escorpión grande y tranquilo.');
}

beforeEach(() => vi.clearAllMocks());

describe('CareSheetListView', () => {
  it('muestra las fichas y el botón «+ Ficha nueva»', async () => {
    server.use(
      http.get(`${API}/care-sheets`, () =>
        HttpResponse.json([
          {
            id: 1,
            slug: 'pandinus-imperator-ghana',
            species_id: 3,
            scientific_name: 'Pandinus imperator',
            locality: 'Ghana',
            common_name: 'Escorpión emperador',
            group: { id: 9, name: 'Escorpiones' },
            published: false,
            published_at: null,
            updated_at: '2026-10-01T12:00:00Z',
          },
        ])
      )
    );
    renderUi(<CareSheetListView />);

    expect(await screen.findByText('Pandinus imperator')).toBeInTheDocument();
    expect(screen.getByText('Pandinus imperator').tagName).toBe('EM');
    expect(screen.getByText(/“Ghana”/)).toBeInTheDocument();
    expect(screen.getByText('Escorpiones')).toBeInTheDocument();
    expect(screen.getByText('Borrador')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+ Ficha nueva' })).toBeInTheDocument();
  });
});

describe('CareSheetForm', () => {
  it('crear manda el body completo, con sus listas', async () => {
    let body = null;
    server.use(
      http.get(`${API}/species`, () => HttpResponse.json(page(SPECIES))),
      http.post(`${API}/care-sheets`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 11, ...body }, { status: 201 });
      })
    );
    renderUi(<CareSheetForm />);
    await fillMinimal();

    type(screen.getByLabelText('Autoridad'), 'Linnaeus, 1758');
    type(screen.getByLabelText('Dificultad'), 'Fácil');

    // Ficha técnica: viene con Orden/Familia/Género/Especie; se llena una y se agrega otra
    const tax = region('Ficha técnica');
    type(within(tax).getAllByLabelText('Nombre')[0], 'Scorpiones');
    fireEvent.click(within(tax).getByRole('button', { name: '+ Agregar fila' }));
    type(within(tax).getAllByLabelText('Rango')[4], 'Localidad tipo');
    type(within(tax).getAllByLabelText('Nombre')[4], 'Ghana');

    const facts = region('Datos rápidos');
    fireEvent.click(within(facts).getByRole('button', { name: '+ Agregar fila' }));
    type(within(facts).getByLabelText('Etiqueta'), 'Hembra adulta');
    type(within(facts).getByLabelText('Valor'), '18–20 cm');

    const morph = region('Morfología');
    fireEvent.click(within(morph).getByRole('button', { name: '+ Agregar fila' }));
    type(within(morph).getByLabelText('Etiqueta'), 'Hembra');
    type(within(morph).getByLabelText('Texto'), 'Más robusta que el macho.');

    type(screen.getByLabelText('Hábitat'), 'Sabana de África occidental.');
    const tags = within(region('Hábitat y etiquetas')).getByLabelText('Etiquetas');
    type(tags, 'Escorpión');
    fireEvent.keyDown(tags, { key: 'Enter' });

    const basics = region('Lo básico');
    fireEvent.click(within(basics).getByRole('button', { name: '+ Agregar fila' }));
    fireEvent.click(within(basics).getByRole('button', { name: '+ Agregar fila' }));
    type(within(basics).getAllByLabelText('Texto')[0], 'Sustrato *húmedo*');
    // la segunda fila queda vacía y no viaja

    const refs = region('Referencias');
    fireEvent.click(within(refs).getByRole('button', { name: '+ Agregar fila' }));
    type(within(refs).getByLabelText('Texto'), 'Prendini, 2004');

    type(screen.getByLabelText('Cuerpo (Markdown)'), '## Terrario\n\nUno de 40 cm.');

    fireEvent.click(screen.getByRole('button', { name: 'Crear ficha' }));

    await waitFor(() => expect(body).not.toBeNull(), { timeout: 5000 });
    expect(body).toEqual({
      species_id: 3,
      published: false,
      authority: 'Linnaeus, 1758',
      origin: null,
      difficulty: 'Fácil',
      summary: 'El clásico escorpión grande y tranquilo.',
      taxonomy: [
        { rank: 'Orden', name: 'Scorpiones', italic: false },
        { rank: 'Localidad tipo', name: 'Ghana', italic: false },
      ],
      facts: [{ label: 'Hembra adulta', value: '18–20 cm' }],
      morphology: [{ label: 'Hembra', text: 'Más robusta que el macho.' }],
      habitat: 'Sabana de África occidental.',
      tags: ['Escorpión'],
      basics: ['Sustrato *húmedo*'],
      body: '## Terrario\n\nUno de 40 cm.',
      photos: [],
      video: null,
      references: [{ text: 'Prendini, 2004', url: null }],
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Ficha creada'));
  });

  it('un 409 muestra el mensaje del API', async () => {
    server.use(
      http.get(`${API}/species`, () => HttpResponse.json(page(SPECIES))),
      http.post(`${API}/care-sheets`, () =>
        HttpResponse.json({ detail: 'Esta especie ya tiene ficha de cuidados' }, { status: 409 })
      )
    );
    renderUi(<CareSheetForm />);
    await fillMinimal();

    fireEvent.click(screen.getByRole('button', { name: 'Crear ficha' }));

    await waitFor(
      () => expect(toast.error).toHaveBeenCalledWith('Esta especie ya tiene ficha de cuidados'),
      { timeout: 5000 }
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});
