import { test, unique, expect } from './fixtures';

// ----------------------------------------------------------------------
// Animales: alta, variedades, sitio, fotos heredadas, borrar por bloque,
// mover entre venta y cría, y la búsqueda de Especies y morphs.
// ----------------------------------------------------------------------

const PHOTO = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';

// Despliega el bloque de una especie en las listas de animales (el nombre es
// un enlace a su ficha: se hace clic en la flecha de la fila)
async function openSpecies(page, name) {
  const row = page.getByRole('row').filter({ has: page.getByRole('link', { name, exact: true }) });
  await row.getByRole('cell').first().click();
}

// El buscador de especie y variedad (alta completa y filtros)
async function pickVariety(page, label, typed, option) {
  const field = page.getByLabel(label);
  await field.fill(typed);
  // el API guarda los nombres con mayúscula inicial: se compara sin distinguirlas
  const name = option instanceof RegExp ? option : new RegExp(`^${option}$`, 'i');
  await page.getByRole('option', { name }).click();
}

test.describe('Especies y morphs', () => {
  test('buscar la especie trae sus variedades y buscar una variedad la encuentra', async ({
    page,
    seed,
  }) => {
    const [glacier, anemone] = [unique('Glacier'), unique('Anemone')];
    const { species } = await seed.species({ name: unique('murina'), morphs: [glacier, anemone] });

    await page.goto('/dashboard/animal/taxonomy?tab=species');
    const search = page.getByRole('searchbox').first();

    // se escribe de corrido, letra por letra, sin perder el foco
    await search.click();
    await page.keyboard.type(species.name, { delay: 40 });
    await expect(search).toHaveValue(species.name);
    await expect(page.getByRole('gridcell', { name: new RegExp(glacier, 'i') })).toBeVisible();
    await expect(page.getByRole('gridcell', { name: new RegExp(anemone, 'i') })).toBeVisible();

    // por la variedad sale ella con su especie, y no las demás
    await search.fill(glacier);
    await expect(page.getByRole('gridcell', { name: new RegExp(glacier, 'i') })).toBeVisible();
    await expect(
      page.getByRole('gridcell', { name: new RegExp(`^${species.name}`, 'i') }).first()
    ).toBeVisible();
    await expect(page.getByRole('gridcell', { name: new RegExp(anemone, 'i') })).toHaveCount(0);
  });

  test('la especie se edita en su página, con la ficha de la tienda a la vista', async ({
    page,
    seed,
    api,
  }) => {
    const { species } = await seed.species();

    await page.goto(`/dashboard/animal/species/${species.id}/edit`);
    await expect(page.getByRole('heading', { name: 'Editar especie' })).toBeVisible();
    await expect(page.getByText('Ficha de cuidados en la tienda')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Fotos' })).toBeVisible();

    await page.getByLabel('Descripción').fill('Cálida y húmeda');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page).toHaveURL(/\/dashboard\/animal\/taxonomy/);
    expect((await api.get(`/species/${species.id}`)).description).toBe('Cálida y húmeda');
  });
});

test.describe('Altas de especie y variedad', () => {
  test('especie nueva, ya oculta en el sitio', async ({ page, seed, api }) => {
    const { genus } = await seed.species();
    const name = unique('caffrorum');

    await page.goto('/dashboard/animal/species/new');
    await page.getByLabel(/^Género/).click();
    await page.getByRole('option', { name: genus.name }).click();
    await page.getByLabel(/Especie \(nombre científico\)/).fill(name);
    await page.getByLabel('Nombre común').fill(unique('Cucaracha cromada'));
    await page.getByLabel('Visible en el sitio público').uncheck();
    await page.getByLabel('Descripción').fill('La más sencilla de las cucarachas de porcelana.');
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page).toHaveURL(/\/dashboard\/animal\/taxonomy/);
    const { data } = await api.get(`/species?genus_id=${genus.id}`);
    const created = data.find((s) => s.name.toLowerCase().includes(name.split(' ').pop()));
    expect(created).toMatchObject({ show_public: false });
  });

  test('variedad nueva desde la liga de su especie', async ({ page, seed, api }) => {
    const { species } = await seed.species();
    const name = unique('Glacier');

    await page.goto(`/dashboard/animal/morph/new?species_id=${species.id}`);
    await expect(page.getByRole('heading', { name: 'Nueva variedad' })).toBeVisible();
    await page.getByLabel(/^Nombre/).fill(name);
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page).toHaveURL(/\/dashboard\/animal\/taxonomy/);
    const { data } = await api.get(`/morphs?species_id=${species.id}`);
    expect(data.map((m) => m.name.toLowerCase())).toContain(`'${name.toLowerCase()}'`);
  });
});

test.describe('En venta', () => {
  test('alta completa con variedad: fuera del sitio y en la venta rápida', async ({
    page,
    seed,
    api,
  }) => {
    const glacier = unique('Glacier');
    const { species, morphs } = await seed.species({ name: unique('murina'), morphs: [glacier] });

    await page.goto('/dashboard/animal/new?purpose=sale');
    await pickVariety(page, /Especie y variedad/, glacier, glacier);
    await page.getByLabel(/Precio de venta/).fill('350');
    await page.getByRole('checkbox', { name: 'Mostrar en el sitio' }).uncheck();
    await page.getByRole('checkbox', { name: /También en la venta rápida/ }).check();
    await page.getByRole('button', { name: 'Registrar animal' }).click();

    await expect(page).toHaveURL(/\/dashboard\/animal$/);
    const { data } = await api.get(`/animals?species_id=${species.id}`);
    expect(data).toHaveLength(1);
    const [animal] = data;
    expect(animal).toMatchObject({ show_public: false, quick_sale: true });
    expect(animal.morphs.map((m) => m.id)).toEqual([morphs[0].id]);

    // no se anuncia, pero sí es botón de la venta rápida
    const site = await api.publicGet(`/public/animals?species_id=${species.id}`);
    expect(site.data).toEqual([]);
    const quick = await api.get('/products/quick-sale');
    expect(quick.map((i) => i.id)).toContain(animal.product_id);
  });

  test('sin fotos propias muestra y usa las de su especie', async ({ page, seed, api }) => {
    const { species } = await seed.species();
    await api.put(`/species/${species.id}`, { photos: [PHOTO] });

    await page.goto(`/dashboard/animal/new?species_id=${species.id}&purpose=sale`);
    await expect(page.getByAltText('Foto heredada 1')).toHaveAttribute('src', PHOTO);

    const animal = await seed.animal(species.id, { quick_sale: true });
    const quick = await api.get('/products/quick-sale');
    expect(quick.find((i) => i.id === animal.product_id).image).toBe(PHOTO);
  });

  test('la nominal y la variedad se anuncian por separado', async ({ page, seed, api }) => {
    const { species, morphs } = await seed.species({
      common: unique('Isópodo'),
      morphs: [unique('Glacier')],
    });
    const nominal = await seed.animal(species.id);
    const variety = await seed.animal(species.id, { morphIds: [morphs[0].id] });

    await page.goto('/dashboard/animal');
    await page.getByRole('switch', { name: `En el sitio: ${species.common_name}` }).click();
    await expect
      .poll(async () => (await api.get(`/species/${species.id}`)).show_public)
      .toBe(false);

    const ids = (await api.publicGet(`/public/animals?species_id=${species.id}`)).data.map(
      (a) => a.id
    );
    expect(ids).toEqual([variety.id]);
    expect(ids).not.toContain(nominal.id);
  });

  test('borrar una variedad desde su bloque deja las demás', async ({ page, seed, api }) => {
    const glacier = unique('Glacier');
    const { species, morphs } = await seed.species({
      common: unique('Isópodo'),
      morphs: [glacier],
    });
    const keep = await seed.animal(species.id);
    const gone = await seed.animal(species.id, { morphIds: [morphs[0].id] });

    await page.goto('/dashboard/animal');
    await openSpecies(page, species.common_name);
    await page.getByRole('button', { name: `Eliminar ${glacier} (1)` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click();

    await expect
      .poll(async () => (await api.get(`/animals?species_id=${species.id}`)).data.map((a) => a.id))
      .toEqual([keep.id]);
    expect(gone.id).not.toBe(keep.id);
  });

  test('pasar a pie de cría lo saca de En venta', async ({ page, seed }) => {
    const { species } = await seed.species({ common: unique('Gecko') });
    const animal = await seed.animal(species.id);

    await page.goto('/dashboard/animal');
    await openSpecies(page, species.common_name);
    const row = page
      .getByRole('row')
      .filter({ has: page.getByRole('link', { name: animal.code }) });
    await row.getByRole('button', { name: 'Mover a…' }).click();
    await page.getByRole('menuitem', { name: /Pasar a pie de cría/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Mover' }).click();

    await page.goto('/dashboard/animal/breeding');
    await openSpecies(page, species.common_name);
    await expect(page.getByRole('link', { name: animal.code })).toBeVisible();
  });
});
