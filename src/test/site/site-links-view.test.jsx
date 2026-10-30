import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { it, vi, expect, describe } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { SiteLinksView } from 'src/sections/site/view/site-links-view';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// Editor de /links: carga el contenido, edita y guarda completo;
// no deja guardar un enlace inválido.
// ----------------------------------------------------------------------

vi.mock('src/layouts/dashboard', () => ({ DashboardContent: ({ children }) => children }));

const URL = 'https://api.opuntiaden.com/api/v1/settings/link-pages';

const DATA = {
  events: [{ title: 'Animalia Otoño CDMX 2026', place: 'Tlatelolco', date: '2026-11-21', time: '', ends: '', url: '', url_label: 'Más información' }],
  guides: [{ name: 'Isópodos', url: '/articulos/x', sub: false }],
  pages: {
    links: { label: 'Criadero', title: 'Historia natural', lead: '', footer: '', buttons: [{ label: 'Ver catálogo', url: '/catalogo', primary: true }] },
  },
};

function renderView() {
  const Wrapper = createWrapper();
  return render(
    <ThemeProvider theme={createTheme({ cssVariables: true })}>
      <Wrapper>
        <MemoryRouter>
          <SiteLinksView />
        </MemoryRouter>
      </Wrapper>
    </ThemeProvider>
  );
}

describe('SiteLinksView', () => {
  it('carga, edita el titular y guarda el documento completo', async () => {
    let saved = null;
    server.use(
      http.get(URL, () => HttpResponse.json(DATA)),
      http.put(URL, async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json(saved);
      })
    );
    renderView();

    const title = await screen.findByDisplayValue('Historia natural');
    fireEvent.change(title, { target: { value: 'Historia natural de CDMX' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved.pages.links.title).toBe('Historia natural de CDMX');
    expect(saved.events[0].title).toBe('Animalia Otoño CDMX 2026');
  });

  it('no manda al API un enlace inválido', async () => {
    const put = vi.fn();
    server.use(
      http.get(URL, () => HttpResponse.json(DATA)),
      http.put(URL, () => {
        put();
        return HttpResponse.json(DATA);
      })
    );
    renderView();

    const url = await screen.findByDisplayValue('/catalogo');
    fireEvent.change(url, { target: { value: 'javascript:alert(1)' } });
    expect(await screen.findByText(/Usa \/ruta/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(put).not.toHaveBeenCalled();
  });
});
