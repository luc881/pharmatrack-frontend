import { it, expect, describe } from 'vitest';
import { useForm, FormProvider } from 'react-hook-form';
import { render, screen, fireEvent } from '@testing-library/react';
import { Link, useNavigate, RouterProvider, createMemoryRouter } from 'react-router';

import { FormLeaveGuard } from 'src/components/hook-form/form-leave-guard';

// ----------------------------------------------------------------------
// Salir de un formulario a medio llenar pregunta; guardar no.
// ----------------------------------------------------------------------

function Page() {
  const navigate = useNavigate();
  const methods = useForm({ defaultValues: { name: '' } });
  const onSubmit = methods.handleSubmit(async () => {
    await Promise.resolve();
    navigate('/lista');
  });
  return (
    <FormProvider {...methods}>
      <FormLeaveGuard />
      <form onSubmit={onSubmit}>
        <input aria-label="Nombre" {...methods.register('name')} />
        <button type="submit">Guardar</button>
      </form>
      <Link to="/lista">Ir a la lista</Link>
    </FormProvider>
  );
}

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/form', element: <Page /> },
      { path: '/lista', element: <p>Lista</p> },
    ],
    { initialEntries: ['/form'] }
  );
  render(<RouterProvider router={router} />);
}

describe('FormLeaveGuard', () => {
  it('sin cambios sale directo', async () => {
    renderPage();
    fireEvent.click(screen.getByText('Ir a la lista'));
    expect(await screen.findByText('Lista')).toBeInTheDocument();
  });

  it('con cambios pregunta; «Cancelar» se queda y «Salir sin guardar» sale', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Gecko' } });

    fireEvent.click(screen.getByText('Ir a la lista'));
    expect(await screen.findByText('¿Salir sin guardar?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByLabelText('Nombre')).toHaveValue('Gecko');

    fireEvent.click(screen.getByText('Ir a la lista'));
    fireEvent.click(await screen.findByRole('button', { name: 'Salir sin guardar' }));
    expect(await screen.findByText('Lista')).toBeInTheDocument();
  });

  it('al guardar no pregunta', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Gecko' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Lista')).toBeInTheDocument();
    expect(screen.queryByText('¿Salir sin guardar?')).not.toBeInTheDocument();
  });
});
