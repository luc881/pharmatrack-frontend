import { useState } from 'react';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { it, expect, describe, beforeEach } from 'vitest';

import { VarietyPicker } from 'src/sections/animal/variety-picker';

import { server } from '../mocks/server';
import { createWrapper } from '../utils';

// ----------------------------------------------------------------------
// Especie y variedad en un solo buscador: se llega igual por «murina» que
// por «glacier». Las especies de genes (reptiles) marcan varios.
// ----------------------------------------------------------------------

const API = 'https://api.opuntiaden.com/api/v1';
const page = (data) => ({ data, total: data.length, page: 1, page_size: 500, total_pages: 1 });

const MURINA = {
  id: 1,
  name: 'murina',
  common_name: null,
  variety_mode: 'named',
  genus: { id: 1, name: 'Cubaris' },
};
const DAIRY = {
  id: 2,
  name: 'laevis',
  common_name: 'Dairy Cow',
  variety_mode: 'named',
  genus: { id: 2, name: 'Porcellio' },
};
const BALL = {
  id: 3,
  name: 'regius',
  common_name: 'Pitón bola',
  variety_mode: 'genes',
  genus: { id: 3, name: 'Python' },
};
const MORPHS = [
  { id: 11, name: 'Papaya', species_id: 1 },
  { id: 12, name: 'Glacier', species_id: 1 },
  { id: 13, name: 'Anémona', species_id: 1 },
  { id: 31, name: 'Banana', species_id: 3 },
  { id: 32, name: 'Pastel', species_id: 3 },
];

let changes;

function Harness({ initial = { speciesId: null, morphIds: [] } }) {
  const [value, setValue] = useState(initial);
  return (
    <VarietyPicker
      value={value}
      onChange={(next) => {
        changes.push({ speciesId: next.species?.id ?? null, morphIds: next.morphIds });
        setValue({ speciesId: next.species?.id ?? null, morphIds: next.morphIds });
      }}
    />
  );
}

const mount = (props) => {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <Harness {...props} />
    </Wrapper>
  );
};

const field = () => screen.getByLabelText('Especie y variedad');
const optionNames = async () => (await screen.findAllByRole('option')).map((o) => o.textContent);
const groups = () =>
  [...document.querySelectorAll('.MuiAutocomplete-groupLabel')].map((el) => el.textContent);

beforeEach(() => {
  changes = [];
  server.use(
    http.get(`${API}/species`, () => HttpResponse.json(page([MURINA, DAIRY, BALL]))),
    http.get(`${API}/morphs`, () => HttpResponse.json(page(MORPHS)))
  );
});

describe('buscador de especie y variedad', () => {
  it('por la especie salen la nominal y todas sus variedades', async () => {
    const user = userEvent.setup();
    mount();
    await user.type(field(), 'murina');

    expect(await optionNames()).toEqual(['Nominal', 'Anémona', 'Glacier', 'Papaya']);
    expect(groups()).toEqual(['Cubaris murina']);
  });

  it('por el nombre de la variedad se llega directo, sin saber de qué especie es', async () => {
    const user = userEvent.setup();
    mount();
    // sin acento y en minúsculas
    await user.type(field(), 'anemona');
    expect(await optionNames()).toEqual(['Anémona']);
    expect(groups()).toEqual(['Cubaris murina']);

    await user.click(screen.getByRole('option', { name: 'Anémona' }));
    expect(field()).toHaveValue('Cubaris murina · Anémona');
    expect(changes).toEqual([{ speciesId: 1, morphIds: [13] }]);
  });

  it('una especie sin variedades solo tiene la nominal', async () => {
    const user = userEvent.setup();
    mount();
    await user.type(field(), 'dairy');
    expect(await optionNames()).toEqual(['Nominal']);

    await user.click(screen.getByRole('option', { name: 'Nominal' }));
    expect(field()).toHaveValue('Dairy Cow (Porcellio laevis) · Nominal');
    expect(changes).toEqual([{ speciesId: 2, morphIds: [] }]);
  });

  it('muestra lo que ya está elegido', async () => {
    mount({ initial: { speciesId: 1, morphIds: [12] } });
    await screen.findByDisplayValue('Cubaris murina · Glacier');
    // en variedades con nombre no hay campo de genes
    expect(screen.queryByLabelText('Genes')).toBeNull();
  });

  it('en una especie de genes se elige la especie y luego se combinan varios', async () => {
    const user = userEvent.setup();
    mount();
    await user.type(field(), 'python');
    // sus genes no salen como variedades sueltas
    expect(await optionNames()).toEqual(['Elegir genes…']);
    await user.click(screen.getByRole('option', { name: 'Elegir genes…' }));
    expect(field()).toHaveValue('Pitón bola (Python regius)');

    await user.click(screen.getByLabelText('Genes'));
    await user.click(await screen.findByRole('option', { name: 'Banana' }));
    await user.click(screen.getByRole('option', { name: 'Pastel' }));

    expect(changes.at(-1)).toEqual({ speciesId: 3, morphIds: [31, 32] });
  });
});
