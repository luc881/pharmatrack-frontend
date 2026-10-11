import { http, HttpResponse } from 'msw';
import { it, vi, expect, describe } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { TaxonDialog } from 'src/sections/animal/taxon-dialog';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// Nueva especie sin género ni grupo previos: se crean en orden al guardar.
// ----------------------------------------------------------------------

vi.mock('src/components/snackbar', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const API = 'https://api.opuntiaden.com/api/v1';

// Botón explícito «+ Género nuevo» / «+ Grupo nuevo» y escribir el nombre
const createNew = (button, text) => {
  fireEvent.click(screen.getByRole('button', { name: button }));
  fireEvent.change(screen.getByLabelText(`Nombre del ${button.toLowerCase()} *`), {
    target: { value: text },
  });
};

function renderDialog(props = {}) {
  const Wrapper = createWrapper();
  return render(
    <ThemeProvider theme={createTheme({ cssVariables: true })}>
      <Wrapper>
        <TaxonDialog
          tab="species"
          singular="especie"
          genera={[]}
          allSpecies={[]}
          groupsFlat={[]}
          onClose={() => {}}
          onSaved={vi.fn()}
          {...props}
        />
      </Wrapper>
    </ThemeProvider>
  );
}

describe('TaxonDialog', () => {
  it('crea grupo, género y especie desde el mismo diálogo', async () => {
    const calls = [];
    server.use(
      http.post(`${API}/animal-groups`, async ({ request }) => {
        calls.push(['group', await request.json()]);
        return HttpResponse.json({ id: 11, name: 'Fásmidos' }, { status: 201 });
      }),
      http.post(`${API}/genera`, async ({ request }) => {
        calls.push(['genus', await request.json()]);
        return HttpResponse.json({ id: 22, name: 'Phyllium' }, { status: 201 });
      }),
      http.post(`${API}/species`, async ({ request }) => {
        calls.push(['species', await request.json()]);
        return HttpResponse.json({ id: 33 }, { status: 201 });
      })
    );
    const onSaved = vi.fn();
    renderDialog({ onSaved });

    createNew('Género nuevo', 'Phyllium');
    // el grupo aparece en cuanto el género es nuevo, y es obligatorio
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    createNew('Grupo nuevo', 'Fásmidos');
    fireEvent.change(screen.getByLabelText(/especie \(nombre científico\)/i), {
      target: { value: 'Phyllium gardabagusi' },
    });
    expect(screen.getByText('Al guardar quedará así:')).toBeInTheDocument();
    expect(screen.getAllByText('nuevo')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls.map(([k]) => k)).toEqual(['group', 'genus', 'species']);
    expect(calls[1][1]).toEqual({ name: 'Phyllium', group_id: 11 });
    expect(calls[2][1]).toMatchObject({ genus_id: 22, name: 'gardabagusi' });
  });

  it('no deja guardar un género sin grupo', async () => {
    renderDialog({ tab: 'genera', singular: 'género' });
    fireEvent.change(screen.getByLabelText(/^nombre/i), { target: { value: 'Phyllium' } });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    createNew('Grupo nuevo', 'Fásmidos');
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  it('no deja crear un género que ya existe; hay que elegirlo de la lista', () => {
    renderDialog({ genera: [{ id: 5, name: 'Cubaris', group: { id: 3, name: 'Isópodos' } }] });
    createNew('Género nuevo', 'cubaris');
    fireEvent.change(screen.getByLabelText(/especie \(nombre científico\)/i), { target: { value: 'murina' } });
    expect(screen.getByText('Ya existe: elígelo de la lista')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    // «Elegir existente» regresa a la lista
    fireEvent.click(screen.getByRole('button', { name: 'Elegir existente' }));
    expect(screen.getByRole('combobox', { name: /^género/i })).toBeInTheDocument();
  });

  it('un género viejo sin grupo pide el grupo y se lo asigna al guardar', async () => {
    const calls = [];
    server.use(
      http.put(`${API}/genera/5`, async ({ request }) => {
        calls.push(['genus', await request.json()]);
        return HttpResponse.json({ id: 5, name: 'Cubaris', group_id: 3 });
      }),
      http.post(`${API}/species`, async ({ request }) => {
        calls.push(['species', await request.json()]);
        return HttpResponse.json({ id: 9 }, { status: 201 });
      })
    );
    const onSaved = vi.fn();
    renderDialog({
      genera: [{ id: 5, name: 'Cubaris', group: null }],
      groupsFlat: [{ id: 3, name: 'Isópodos', depth: 0, ancestors: [] }],
      initial: { genus_id: 5 },
      onSaved,
    });

    fireEvent.change(screen.getByLabelText(/especie \(nombre científico\)/i), { target: { value: 'murina' } });
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    const group = screen.getByRole('combobox', { name: /grupo de cubaris/i });
    fireEvent.mouseDown(group);
    fireEvent.click(await screen.findByText('Isópodos'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls).toEqual([
      ['genus', { group_id: 3 }],
      ['species', expect.objectContaining({ genus_id: 5, name: 'murina' })],
    ]);
  });
});
