import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { it, vi, expect, describe } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { SupplierCreateEditForm } from 'src/sections/supplier/supplier-create-edit-form';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// Proveedor: solo el nombre es obligatorio; el logo se sube (o un link se
// copia a Cloudinary) y lleva los datos de su ticket en la venta rápida.
// ----------------------------------------------------------------------

const uploads = [];
vi.mock('src/lib/cloudinary', () => {
  const uploadToCloudinary = async (source) => {
    uploads.push(source);
    return `https://res.cloudinary.com/demo/image/upload/logo-${uploads.length}.png`;
  };
  return {
    uploadToCloudinary,
    keepInCloudinary: async (url) =>
      !url || url.startsWith('https://res.cloudinary.com/') ? url : uploadToCloudinary(url),
  };
});
vi.mock('src/components/snackbar', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const API = 'https://api.opuntiaden.com/api/v1';
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

function renderForm() {
  const Wrapper = createWrapper();
  return render(
    <ThemeProvider theme={createTheme({ cssVariables: true })}>
      <Wrapper>
        <MemoryRouter>
          <SupplierCreateEditForm />
        </MemoryRouter>
      </Wrapper>
    </ThemeProvider>
  );
}

describe('Proveedor: datos de su ticket', () => {
  it('se registra solo con el nombre, más su logo y los datos del ticket', async () => {
    let body = null;
    server.use(
      http.post(`${API}/suppliers`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 9, ...body }, { status: 201 });
      })
    );
    renderForm();
    expect(screen.getByText('+ Subir logo')).toBeInTheDocument();

    type('Nombre / Razón social', 'BD Exóticos');
    type('Prefijo del folio', 'BD');
    type('Datos de contacto en el ticket', '@bd.exoticos\nCDMX');
    type('Link del QR', 'https://instagram.com/bd.exoticos');
    // un link de otra página se copia a Cloudinary al guardar
    type('o pega un link del logo', 'https://otra-pagina.com/bd.png');
    expect(screen.getByText('Cambiar logo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Crear proveedor' }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      name: 'BD Exóticos',
      email: null,
      logo: 'https://res.cloudinary.com/demo/image/upload/logo-1.png',
      ticket_prefix: 'BD',
      ticket_lines: '@bd.exoticos\nCDMX',
      ticket_qr_url: 'https://instagram.com/bd.exoticos',
    });
    expect(uploads).toEqual(['https://otra-pagina.com/bd.png']);
  });
});
