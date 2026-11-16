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

const uploads = [];
vi.mock('src/lib/cloudinary', () => {
  const uploadToCloudinary = async (source) => {
    uploads.push(source);
    return `https://res.cloudinary.com/demo/image/upload/copia-${uploads.length}.jpg`;
  };
  return {
    uploadToCloudinary,
    keepInCloudinary: async (url) =>
      !url || url.startsWith('https://res.cloudinary.com/') ? url : uploadToCloudinary(url),
  };
});
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

// los formularios largos tardan con toda la suite corriendo a la vez
vi.setConfig({ testTimeout: 45_000 });

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
    expect(within(screen.getByRole('table')).getByText('Escorpiones')).toBeInTheDocument();
    expect(screen.getByText('Borrador')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+ Ficha nueva' })).toBeInTheDocument();
  });
});

const SHEETS = [
  {
    id: 1,
    slug: 'pandinus-imperator-ghana',
    species_id: 3,
    scientific_name: 'Pandinus imperator',
    locality: 'Ghana',
    common_name: 'Escorpión emperador',
    group: { id: 9, name: 'Escorpiones' },
    difficulty: 'Fácil',
    published: false,
    updated_at: '2026-10-01T12:00:00Z',
  },
  {
    id: 2,
    slug: 'cubaris-murina',
    species_id: 4,
    scientific_name: 'Cubaris murina',
    common_name: 'Isópodo Murina',
    group: { id: 7, name: 'Isópodos' },
    difficulty: 'Fácil',
    published: true,
    published_at: '2026-11-16T12:00:00Z',
    updated_at: '2026-11-16T12:00:00Z',
  },
  {
    id: 3,
    slug: 'cubaris-sp-panda-king',
    species_id: 5,
    scientific_name: 'Cubaris sp.',
    locality: 'Panda King',
    common_name: 'Isópodo Panda King',
    group: { id: 7, name: 'Isópodos' },
    difficulty: 'Intermedia',
    published: true,
    published_at: '2026-11-16T12:00:00Z',
    updated_at: '2026-11-16T12:00:00Z',
  },
];

describe('CareSheetListView: buscar y filtrar', () => {
  const shown = () =>
    ['Pandinus imperator', 'Cubaris murina', 'Cubaris sp.'].filter((n) => screen.queryByText(n));

  beforeEach(() => {
    server.use(http.get(`${API}/care-sheets`, () => HttpResponse.json(SHEETS)));
  });

  it('busca por especie, localidad o nombre común, sin acentos', async () => {
    renderUi(<CareSheetListView />);
    await screen.findByText('Cubaris murina');
    const search = screen.getByRole('searchbox', { name: 'Buscar ficha' });

    fireEvent.change(search, { target: { value: 'escorpion' } });
    expect(shown()).toEqual(['Pandinus imperator']);

    fireEvent.change(search, { target: { value: 'panda' } });
    expect(shown()).toEqual(['Cubaris sp.']);

    fireEvent.change(search, { target: { value: 'cubaris' } });
    expect(shown()).toEqual(['Cubaris murina', 'Cubaris sp.']);
  });

  it('filtra por estado, grupo y dificultad', async () => {
    renderUi(<CareSheetListView />);
    await screen.findByText('Cubaris murina');

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'draft' } });
    expect(shown()).toEqual(['Pandinus imperator']);

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'published' } });
    fireEvent.change(screen.getByLabelText('Dificultad'), { target: { value: 'Intermedia' } });
    expect(shown()).toEqual(['Cubaris sp.']);

    fireEvent.change(screen.getByLabelText('Dificultad'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Grupo'), { target: { value: 'Isópodos' } });
    expect(shown()).toEqual(['Cubaris murina', 'Cubaris sp.']);
    expect(screen.getByText('2 de 3 fichas')).toBeInTheDocument();
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
    // lista fija (no texto libre)
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Dificultad' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Fácil' }));

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

describe('CareSheetForm: fotos por link', () => {
  const photoSrcs = () =>
    [...document.querySelectorAll('img')]
      .map((img) => img.getAttribute('src'))
      .filter((src) => src?.includes('.jpg'));

  const pasteLink = (url) => {
    fireEvent.change(screen.getByLabelText('o pega un link'), { target: { value: url } });
    fireEvent.click(screen.getByRole('button', { name: 'Subir link' }));
  };

  it('un link de otra página se copia a Cloudinary; uno de Cloudinary va tal cual', async () => {
    uploads.length = 0;
    server.use(http.get(`${API}/species`, () => HttpResponse.json(page(SPECIES))));
    renderUi(<CareSheetForm />);

    pasteLink('https://otra-pagina.com/foto.jpg');
    await waitFor(() =>
      expect(photoSrcs()).toEqual(['https://res.cloudinary.com/demo/image/upload/copia-1.jpg'])
    );
    expect(uploads).toEqual(['https://otra-pagina.com/foto.jpg']);

    pasteLink('https://res.cloudinary.com/demo/image/upload/mia.jpg');
    await waitFor(() => expect(photoSrcs()).toHaveLength(2));
    expect(photoSrcs()[1]).toBe('https://res.cloudinary.com/demo/image/upload/mia.jpg');
    expect(uploads).toHaveLength(1);
  });
});

describe('CareSheetForm: fotos de la especie y sus variedades', () => {
  const A = 'https://res.cloudinary.com/demo/image/upload/especie-a.jpg';
  const B = 'https://res.cloudinary.com/demo/image/upload/especie-b.jpg';
  const P = 'https://res.cloudinary.com/demo/image/upload/papaya.jpg';
  const guidePhotos = () =>
    [...document.querySelectorAll('[data-guide-photo] img')].map((img) => img.getAttribute('src'));

  beforeEach(() => {
    uploads.length = 0;
    server.use(
      http.get(`${API}/species`, () =>
        HttpResponse.json(page([{ ...SPECIES[0], photos: [A, B] }, SPECIES[1]]))
      ),
      http.get(`${API}/morphs`, ({ request }) =>
        HttpResponse.json(
          page(
            new URL(request.url).searchParams.get('species_id') === '3'
              ? [{ id: 30, species_id: 3, name: "'Papaya'", photos: [P] }]
              : []
          )
        )
      )
    );
  });

  it('se usan sin volver a subirlas, todas o una por una, y se pueden quitar', async () => {
    renderUi(<CareSheetForm />);
    await fillMinimal();

    // una sola, de la especie
    fireEvent.click(screen.getByRole('button', { name: 'Agregar foto 2 de la especie' }));
    expect(guidePhotos()).toEqual([B]);
    expect(screen.queryByRole('button', { name: 'Agregar foto 2 de la especie' })).toBeNull();

    // las de la variedad también, con su nombre en el texto alternativo
    fireEvent.click(await screen.findByRole('button', { name: "Agregar foto 1 de 'Papaya'" }));
    expect(guidePhotos()).toEqual([B, P]);
    expect(screen.getAllByLabelText('Texto alternativo')[1]).toHaveValue(
      "Escorpión emperador 'Papaya'"
    );

    // las que falten
    fireEvent.click(screen.getByRole('button', { name: 'Usar todas (1)' }));
    expect(guidePhotos()).toEqual([B, P, A]);
    expect(screen.queryByRole('button', { name: /Usar todas/ })).toBeNull();

    // el texto alternativo viene lleno y se puede quitar una
    expect(screen.getAllByLabelText('Texto alternativo')[0]).toHaveValue('Escorpión emperador');
    const firstRow = document.querySelector('[data-guide-photo]');
    fireEvent.click(within(firstRow).getByRole('button', { name: 'Quitar' }));
    expect(guidePhotos()).toEqual([P, A]);
    expect(screen.getByRole('button', { name: 'Agregar foto 2 de la especie' })).toBeInTheDocument();
    expect(uploads).toEqual([]);
  });
});

describe('CareSheetForm: dónde va cada foto', () => {
  it('cada foto elige una sección del cuerpo o «Automático»', async () => {
    let body = null;
    server.use(
      http.get(`${API}/species`, () =>
        HttpResponse.json(
          page([{ ...SPECIES[0], photos: ['https://res.cloudinary.com/demo/image/upload/a.jpg'] }])
        )
      ),
      http.get(`${API}/morphs`, () => HttpResponse.json(page([]))),
      http.post(`${API}/care-sheets`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 11, ...body }, { status: 201 });
      })
    );
    renderUi(<CareSheetForm />);
    await fillMinimal();
    type(
      screen.getByLabelText('Cuerpo (Markdown)'),
      '## Terrario\n\nUno de 40 cm.\n\n## Alimentación\n\nHojarasca.'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Agregar foto 1 de la especie' }));

    // las opciones salen de los títulos «## » del cuerpo
    const where = screen.getByLabelText('Dónde va');
    expect([...where.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'Automático',
      'Terrario',
      'Alimentación',
    ]);
    fireEvent.change(where, { target: { value: 'Alimentación' } });

    fireEvent.click(screen.getByRole('button', { name: 'Crear ficha' }));
    await waitFor(() => expect(body).not.toBeNull(), { timeout: 5000 });
    expect(body.photos).toEqual([
      {
        src: 'https://res.cloudinary.com/demo/image/upload/a.jpg',
        alt: 'Escorpión emperador',
        section: 'Alimentación',
      },
    ]);
  });
});
