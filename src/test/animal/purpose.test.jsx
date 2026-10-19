import { http, HttpResponse } from 'msw';
import { it, vi, expect, describe } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { MoveAnimalDialog } from 'src/sections/animal/move-animal-dialog';
import { purposeOf, animalUnits, countByPurpose } from 'src/sections/animal/utils';

import { server } from '../mocks/server';

vi.mock('src/components/label', () => ({ Label: ({ children }) => children }));

const API = 'https://api.opuntiaden.com/api/v1';
const PACKAGE = { id: 1, sale_format: 'package', package_size: 6 };
const INDIVIDUAL = { id: 2, sale_format: 'individual' };

const renderDialog = (props) =>
  render(
    <ThemeProvider theme={createTheme({ cssVariables: true })}>
      <MoveAnimalDialog open onClose={() => {}} onMoved={() => {}} {...props} />
    </ThemeProvider>
  );

describe('destino del animal', () => {
  it('purposeOf trata la falta de purpose como venta', () => {
    expect(purposeOf({})).toBe('sale');
    expect(purposeOf({ purpose: 'breeder' })).toBe('breeder');
  });

  it('animalUnits convierte paquetes en venta a animales', () => {
    expect(animalUnits({ status: 'available', purpose: 'sale', stock: 3 }, PACKAGE)).toBe(18);
    expect(animalUnits({ status: 'available', purpose: 'growing', stock: 17 }, PACKAGE)).toBe(17);
    expect(animalUnits({ status: 'sold', stock: 3 }, PACKAGE)).toBe(0);
  });

  it('countByPurpose ignora vendidos y muertos', () => {
    const animals = [
      { species_id: 1, status: 'available', purpose: 'sale', stock: 3 },
      { species_id: 1, status: 'reserved', purpose: 'sale', stock: 1 },
      { species_id: 1, status: 'available', purpose: 'growing', stock: 17 },
      { species_id: 2, status: 'available', purpose: 'breeder', stock: 1 },
      { species_id: 2, status: 'sold', purpose: 'sale', stock: 1 },
      { species_id: 2, status: 'deceased', purpose: 'breeder', stock: 1 },
    ];
    expect(countByPurpose(animals, { 1: PACKAGE, 2: INDIVIDUAL })).toEqual({
      sale: 24,
      breeder: 1,
      growing: 17,
      reserved: 1,
      salePackages: 4,
    });
  });
});

describe('MoveAnimalDialog', () => {
  it('pide precio al poner en venta uno sin precio y manda el payload', async () => {
    let body = null;
    server.use(
      http.post(`${API}/animals/5/move`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json([]);
      })
    );
    const onMoved = vi.fn();
    renderDialog({
      animal: {
        id: 5,
        species_id: 1,
        status: 'available',
        purpose: 'growing',
        stock: 20,
        price: 0,
      },
      species: PACKAGE,
      target: 'sale',
      onMoved,
    });

    expect(screen.getByText('Mover a En venta')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/¿Cuántos paquetes\?/), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/Precio de venta/), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mover' }));

    await waitFor(() => expect(onMoved).toHaveBeenCalled());
    expect(body).toEqual({ purpose: 'sale', quantity: 2, price: 300 });
  });

  it('en especie individual no pide cantidad', () => {
    renderDialog({
      animal: { id: 6, species_id: 2, status: 'available', purpose: 'sale', stock: 1, price: 100 },
      species: INDIVIDUAL,
      target: 'breeder',
    });
    expect(screen.queryByLabelText(/¿Cuántos/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Precio de venta/)).not.toBeInTheDocument();
  });

  it.each([
    ['sale', 'growing', /¿Cuántos paquetes\?/, 'Hay 3'],
    ['growing', 'sale', /¿Cuántos paquetes\?/, 'Hay 1 paquete (10 animales)'],
    ['growing', 'breeder', /¿Cuántos\?/, 'Hay 10'],
  ])('paquete %s -> %s: etiqueta y «Hay N»', (from, target, label, hay) => {
    renderDialog({
      animal: {
        id: 5,
        species_id: 1,
        status: 'available',
        purpose: from,
        stock: from === 'sale' ? 3 : 10,
        price: 100,
      },
      species: PACKAGE,
      target,
    });
    expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByText(hay)).toBeInTheDocument();
  });

  it('Todos manda quantity null', async () => {
    let body = null;
    server.use(
      http.post(`${API}/animals/5/move`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json([]);
      })
    );
    const onMoved = vi.fn();
    renderDialog({
      animal: { id: 5, species_id: 1, status: 'available', purpose: 'sale', stock: 3, price: 100 },
      species: PACKAGE,
      target: 'breeder',
      onMoved,
    });
    fireEvent.click(screen.getByLabelText('Todos'));
    fireEvent.click(screen.getByRole('button', { name: 'Mover' }));
    await waitFor(() => expect(onMoved).toHaveBeenCalled());
    expect(body).toEqual({ purpose: 'breeder', quantity: null });
  });
});
