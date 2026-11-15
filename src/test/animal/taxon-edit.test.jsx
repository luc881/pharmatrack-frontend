import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { TaxonEditView } from 'src/sections/animal/view/taxon-edit-view';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// Especie y variedad se editan en su propia página (no en un diálogo), con
// varias fotos y la ficha de cuidados que ve el cliente bien a la vista.
// ----------------------------------------------------------------------

const push = vi.fn();
vi.mock('src/routes/hooks', async (original) => ({
  ...(await original()),
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));
vi.mock('src/layouts/dashboard', () => ({ DashboardContent: ({ children }) => children }));
vi.mock('src/components/snackbar', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
let uploaded = 0;
vi.mock('src/lib/cloudinary', () => ({
  uploadToCloudinary: async () => {
    uploaded += 1;
    return `https://x/nueva-${uploaded}.jpg`;
  },
}));

const API = 'https://api.opuntiaden.com/api/v1';
const page = (data) => ({ data, total: data.length, page: 1, page_size: 500, total_pages: 1 });

const GENUS = { id: 1, name: 'Cubaris', group_id: 1, group: { id: 1, name: 'Isópodos' } };
const MURINA = {
  id: 7,
  name: 'murina',
  common_name: null,
  genus_id: 1,
  genus: GENUS,
  photos: ['https://x/a.jpg', 'https://x/b.jpg'],
  image: 'https://x/a.jpg',
  variety_mode: 'named',
  show_public: true,
};

let sent;

function mount(props, entry = '/') {
  const Wrapper = createWrapper();
  return render(
    <ThemeProvider theme={createTheme({ cssVariables: true })}>
      <Wrapper>
        <MemoryRouter initialEntries={[entry]}>
          <TaxonEditView {...props} />
        </MemoryRouter>
      </Wrapper>
    </ThemeProvider>
  );
}

beforeEach(() => {
  sent = [];
  uploaded = 0;
  push.mockClear();
  const record =
    (method) =>
    async ({ request }) => {
      sent.push([
        method,
        new URL(request.url).pathname.replace('/api/v1', ''),
        await request.json(),
      ]);
      return HttpResponse.json({ id: 99 }, { status: method === 'POST' ? 201 : 200 });
    };
  server.use(
    http.get(`${API}/species`, () => HttpResponse.json(page([MURINA]))),
    http.get(`${API}/genera`, () => HttpResponse.json(page([GENUS]))),
    http.get(`${API}/morphs`, () => HttpResponse.json(page([]))),
    http.get(`${API}/animal-groups/tree`, () =>
      HttpResponse.json([{ id: 1, name: 'Isópodos', children: [] }])
    ),
    http.put(`${API}/species/:id`, record('PUT')),
    http.post(`${API}/morphs`, record('POST'))
  );
});

describe('editar especie en su página', () => {
  it('dice qué es la ficha de la tienda y maneja varias fotos', async () => {
    const user = userEvent.setup();
    mount({ kind: 'species', id: '7' });

    expect(await screen.findByRole('heading', { name: 'Editar especie' })).toBeInTheDocument();
    expect(screen.getByText(/Ficha de cuidados en la tienda/)).toBeInTheDocument();
    expect(screen.getByText(/lo que ve el cliente/)).toBeInTheDocument();

    const photos = within(screen.getByRole('group', { name: 'Fotos' }));
    expect(photos.getAllByRole('img')).toHaveLength(2);
    // se quita una y se suben dos más de una vez
    await user.click(photos.getByRole('button', { name: 'Quitar foto 1' }));
    await user.upload(photos.getByLabelText('Subir fotos'), [
      new File(['1'], '1.jpg', { type: 'image/jpeg' }),
      new File(['2'], '2.jpg', { type: 'image/jpeg' }),
    ]);
    await waitFor(() => expect(photos.getAllByRole('img')).toHaveLength(3));

    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0][1]).toBe('/species/7');
    expect(sent[0][2].photos).toEqual([
      'https://x/b.jpg',
      'https://x/nueva-1.jpg',
      'https://x/nueva-2.jpg',
    ]);
    // al guardar vuelve a Especies y morphs
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/animal/taxonomy'));
  });

  it('una foto se puede volver la principal', async () => {
    const user = userEvent.setup();
    mount({ kind: 'species', id: '7' });
    const photos = within(await screen.findByRole('group', { name: 'Fotos' }));
    await user.click(photos.getByRole('button', { name: 'Hacer principal la foto 2' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0][2].photos).toEqual(['https://x/b.jpg', 'https://x/a.jpg']);
  });
});

describe('nueva variedad en su página', () => {
  it('nace de la especie que viene en la liga', async () => {
    const user = userEvent.setup();
    mount({ kind: 'morph' }, '/?species_id=7');

    expect(await screen.findByRole('heading', { name: 'Nueva variedad' })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Nombre/), 'Glacier');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual([
      'POST',
      '/morphs',
      // la convención del sistema: el nombre de la variedad va entre comillas
      expect.objectContaining({ species_id: 7, name: "'Glacier'", photos: [] }),
    ]);
  });
});
