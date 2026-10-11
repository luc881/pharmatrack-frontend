import { useState } from 'react';
import { it, vi, expect, describe } from 'vitest';
import { useForm, FormProvider } from 'react-hook-form';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import { InlineCreatableSelect } from 'src/sections/product/inline-creatable-select';

// ----------------------------------------------------------------------
// «+ Categoría nueva» a la vista: escribe el nombre, «Crear» y queda elegida.
// ----------------------------------------------------------------------

// Como en los formularios reales: al crear, la lista se recarga con el nuevo
function Harness({ onCreate }) {
  const methods = useForm({ defaultValues: { product_category_id: '' } });
  const [options, setOptions] = useState([{ id: 1, name: 'Sustratos' }]);
  return (
    <ThemeProvider theme={createTheme({ cssVariables: true })}>
      <FormProvider {...methods}>
        <InlineCreatableSelect
          name="product_category_id"
          label="Categoría *"
          newLabel="Categoría nueva"
          options={options}
          onCreate={async (name) => {
            const created = await onCreate(name);
            setOptions((o) => [...o, created]);
            return created;
          }}
        />
        <span data-testid="value">{methods.watch('product_category_id')}</span>
      </FormProvider>
    </ThemeProvider>
  );
}

describe('InlineCreatableSelect', () => {
  it('crea desde el botón y deja el nuevo elegido', async () => {
    const onCreate = vi.fn(async (name) => ({ id: 9, name }));
    render(<Harness onCreate={onCreate} />);

    fireEvent.click(screen.getByRole('button', { name: 'Categoría nueva' }));
    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Alimento vivo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('9'));
    expect(onCreate).toHaveBeenCalledWith('Alimento Vivo');
    // de vuelta a la lista con el nuevo puesto
    expect(screen.getByRole('combobox', { name: /categoría/i })).toHaveValue('Alimento Vivo');
  });

  it('no crea uno que ya existe', () => {
    const onCreate = vi.fn();
    render(<Harness onCreate={onCreate} />);

    fireEvent.click(screen.getByRole('button', { name: 'Categoría nueva' }));
    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'sustratos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    expect(screen.getByText('Ya existe: "Sustratos"')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
