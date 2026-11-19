import { test, unique, expect } from './fixtures';

// ----------------------------------------------------------------------
// Lo más reciente: un ticket por dueño (productos y animales de otro
// expositor), proveedores con datos de ticket, «Tienda (no se ve)», fichas
// (buscar, filtrar, fotos por sección), avatares sin dominio y Links y eventos.
// ----------------------------------------------------------------------

const PHOTO = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';

const button = (page, title) =>
  page.getByRole('button', { name: new RegExp(`^Agregar ${title}`, 'i') });
const cart = (page) => page.getByRole('region', { name: 'Cuenta' });
const charge = (page) =>
  cart(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();
// los tickets del cliente (sin el talón de orden)
const tickets = (page) => page.locator('.od-ticket:not(.od-order)');

async function openQuickSale(page, { print = false } = {}) {
  await page.goto('/dashboard/quick-sale');
  await expect(page.getByText(/Listo para vender sin internet/)).toBeVisible({ timeout: 30_000 });
  const printBox = page.getByRole('checkbox', { name: 'Imprimir ticket' });
  if ((await printBox.isChecked()) !== print) await printBox.click();
}

async function openSpecies(page, name) {
  const row = page.getByRole('row').filter({ has: page.getByRole('link', { name, exact: true }) });
  await row.getByRole('cell').first().click();
}

test.describe('Un ticket por dueño', () => {
  test('lo propio y lo del expositor salen en tickets aparte, cada uno con su marca', async ({
    page,
    seed,
    api,
  }) => {
    const bd = await api.post('/suppliers', {
      name: unique('Bd Exoticos'),
      ticket_prefix: 'BD',
      ticket_lines: '@bd.exoticos\nCDMX',
    });
    const mine = await seed.product({ title: unique('Cueva propia'), price: 80, quick_sale: true });
    const slush = await seed.product({
      title: unique('Slushie mango'),
      price: 50,
      quick_sale: true,
      needs_prep: true,
      consignor_id: bd.id,
    });

    await openQuickSale(page, { print: true });
    await button(page, mine.title).click();
    await button(page, slush.title).click();
    await charge(page);

    await expect(page).toHaveURL(/\/quick-sale\/ticket\//);
    await expect(tickets(page)).toHaveCount(2);
    const [own, theirs] = [tickets(page).nth(0), tickets(page).nth(1)];
    await expect(own).toContainText(new RegExp(mine.title, 'i'));
    await expect(own).not.toContainText(new RegExp(slush.title, 'i'));
    await expect(own).toContainText('$80.00 MXN');
    await expect(theirs).toContainText(bd.name.toUpperCase());
    await expect(theirs).toContainText(/BD-[A-Z0-9]{4}-\d{4}/);
    await expect(theirs).toContainText('@bd.exoticos');
    await expect(theirs).toContainText(new RegExp(slush.title, 'i'));
    await expect(theirs).toContainText('$50.00 MXN');
    // el slushie sigue llevando su talón de orden
    await expect(page.getByTestId('prep-order')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__printed ?? 0)).toBeGreaterThan(0);
  });

  test('un animal del expositor se marca en «Agregar productos» y sale en su ticket', async ({
    page,
    seed,
    api,
  }) => {
    const owner = await api.post('/suppliers', { name: unique('Expositor'), ticket_prefix: 'EX' });
    const { species } = await seed.species({ common: unique('Serpiente') });
    const animal = await seed.animal(species.id, { price: 1200, quick_sale: true });

    await openQuickSale(page, { print: true });
    await page.getByRole('button', { name: '+ Agregar productos' }).first().click();
    const picker = page.getByRole('dialog', { name: /Qué se vende/ });
    await picker.getByLabel('Buscar').fill(species.common_name);
    await picker
      .getByRole('combobox', { name: `Dueño: ${animal.code}` })
      .selectOption(String(owner.id));
    await expect
      .poll(async () => (await api.get(`/animals/${animal.id}`)).consignor_id)
      .toBe(owner.id);
    await picker.getByRole('button', { name: 'Listo' }).click();

    await page.getByRole('button', { name: new RegExp(`^Agregar .*${animal.code}`) }).click();
    await charge(page);

    await expect(page).toHaveURL(/\/quick-sale\/ticket\//);
    await expect(tickets(page)).toHaveCount(1);
    await expect(tickets(page).first()).toContainText(owner.name.toUpperCase());
    await expect(tickets(page).first()).toContainText(/EX-[A-Z0-9]{4}-\d{4}/);
  });

  test('sin internet también salen los dos tickets, con los datos guardados en el equipo', async ({
    page,
    seed,
    api,
  }) => {
    const bd = await api.post('/suppliers', {
      name: unique('Bd Sin Red'),
      ticket_prefix: 'BD',
      ticket_lines: 'Tel. 55 0000 0000',
    });
    const mine = await seed.product({ title: unique('Musgo propio'), price: 60, quick_sale: true });
    const theirs = await seed.product({
      title: unique('Pecera ajena'),
      price: 300,
      quick_sale: true,
      consignor_id: bd.id,
    });

    await openQuickSale(page, { print: true });
    await page.context().setOffline(true);
    await button(page, mine.title).click();
    await button(page, theirs.title).click();
    await charge(page);

    await expect(page).toHaveURL(/\/quick-sale\/ticket\//);
    await expect(tickets(page)).toHaveCount(2);
    await expect(tickets(page).nth(1)).toContainText(bd.name.toUpperCase());
    await expect(tickets(page).nth(1)).toContainText('Tel. 55 0000 0000');
    await expect(tickets(page).nth(1)).toContainText('$300.00 MXN');
    await expect.poll(() => page.evaluate(() => window.__printed ?? 0)).toBeGreaterThan(0);

    // al volver la red se sube como una sola venta con los dos folios
    await page.context().setOffline(false);
    await page.goto('/dashboard/quick-sale');
    await expect(page.getByText(/por subir/)).toHaveCount(0, { timeout: 30_000 });
    await expect
      .poll(async () =>
        (await api.get('/sales?page=1&page_size=500')).data.map((s) => s.description).join('\n')
      )
      .toMatch(/Venta rápida · VR-\S+ · BD-\S+/);
  });

  test('el dueño de un animal también se marca al editarlo', async ({ page, seed, api }) => {
    const owner = await api.post('/suppliers', { name: unique('Criadero amigo') });
    const { species } = await seed.species({ common: unique('Tarántula') });
    const animal = await seed.animal(species.id);

    await page.goto(`/dashboard/animal/${animal.id}/edit`);
    await page.getByRole('combobox', { name: 'Dueño' }).selectOption(String(owner.id));
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect
      .poll(async () => (await api.get(`/animals/${animal.id}`)).consignor_id)
      .toBe(owner.id);
  });

  test('un proveedor se registra solo con su nombre y los datos de su ticket', async ({
    page,
    api,
  }) => {
    const name = unique('Expositor invitado');
    await page.goto('/dashboard/supplier/new');
    await expect(page.getByText('+ Subir logo')).toBeVisible();
    await page.getByLabel('Nombre / Razón social').fill(name);
    await page.getByLabel('Prefijo del folio').fill('EXP');
    await page.getByLabel('Datos de contacto en el ticket').fill('@expositor\nCDMX');
    await page.getByRole('button', { name: 'Crear proveedor' }).click();
    await expect(page).toHaveURL(/\/dashboard\/supplier\/?$/);

    const { data } = await api.get('/suppliers?page=1&page_size=100');
    expect(data.find((s) => s.name.toLowerCase() === name.toLowerCase())).toMatchObject({
      email: null,
      ticket_prefix: 'EXP',
      ticket_lines: '@expositor\nCDMX',
    });
  });
});

test.describe('Animales en el sitio', () => {
  test('marcado para la tienda pero con su especie apagada, dice que no se ve', async ({
    page,
    seed,
    api,
  }) => {
    const { species } = await seed.species({ common: unique('Isópodo') });
    await seed.animal(species.id);
    await api.put(`/species/${species.id}`, { show_public: false });

    await page.goto('/dashboard/animal');
    await openSpecies(page, species.common_name);
    const label = page.getByText('Tienda (no se ve)');
    await expect(label).toBeVisible();
    await expect(label).toHaveAttribute('title', 'Su especie está apagada en el sitio');
  });
});

test.describe('Fichas de cuidados', () => {
  test('se buscan, se filtran y cada foto de la especie elige su sección', async ({
    page,
    seed,
    api,
  }) => {
    const { species } = await seed.species({ common: unique('Colémbolo'), photos: [PHOTO] });
    const sheet = await api.post('/care-sheets', {
      species_id: species.id,
      summary: 'Resumen corto.',
      body: '## Terrario\n\nUno chico.\n\n## Alimentación\n\nLevadura.',
    });

    await page.goto('/dashboard/care-sheet');
    await page.getByRole('searchbox', { name: 'Buscar ficha' }).fill(species.common_name);
    const row = page.getByRole('row').filter({ hasText: species.common_name });
    await expect(row).toHaveCount(1);
    await page.getByLabel('Estado').selectOption('published');
    await expect(row).toHaveCount(0);
    await page.getByLabel('Estado').selectOption('draft');
    await expect(row).toHaveCount(1);

    await page.goto(`/dashboard/care-sheet/${sheet.id}/edit`);
    await page.getByRole('button', { name: 'Usar todas (1)' }).click();
    await page.getByLabel('Dónde va').selectOption('Alimentación');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect
      .poll(async () => (await api.get(`/care-sheets/${sheet.id}`)).photos)
      .toEqual([expect.objectContaining({ src: PHOTO, section: 'Alimentación' })]);
  });
});

test.describe('Cuenta y sitio', () => {
  test('el avatar predefinido se guarda sin dominio', async ({ page, api }) => {
    await page.goto('/dashboard/user/account');
    await page.locator('img[src$="/avatar-3.webp"]').first().click();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect
      .poll(async () => (await api.get('/users/me')).avatar)
      .toBe('/assets/images/mock/avatar/avatar-3.webp');
  });

  test('Links y eventos ya no tiene la lista de guías a mano', async ({ page }) => {
    await page.goto('/dashboard/site/links');
    await expect(page.getByText(/salen solas de las fichas publicadas/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar guía' })).toHaveCount(0);
  });
});

test.describe('Por pieza', () => {
  test('insectos iguales: un lote por sexo y un solo botón en la venta rápida', async ({
    page,
    seed,
    api,
  }) => {
    const { species } = await seed.species({ common: unique('Insecto hoja') });
    await api.put(`/species/${species.id}`, { sale_format: 'piece' });
    await seed.animal(species.id, { sex: 'unknown', stock: 20, price: 350, quick_sale: true });
    const hembras = await seed.animal(species.id, {
      sex: 'female',
      stock: 4,
      price: 600,
      quick_sale: true,
    });

    await openQuickSale(page, { print: true });
    const group = page.getByRole('button', {
      name: new RegExp(`^Elegir ${species.common_name}`, 'i'),
    });
    await expect(group).toHaveAttribute('aria-label', /desde \$350, Quedan 24$/);
    await group.click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^Agregar Hembra/ })
      .click();
    await charge(page);

    await expect(page).toHaveURL(/\/quick-sale\/ticket\//);
    await expect(tickets(page).first()).toContainText('Hembra');
    await expect.poll(async () => (await api.get(`/animals/${hembras.id}`)).stock).toBe(3);
  });

  test('al pasar una especie a «Por pieza», lo que está en venta se junta', async ({
    seed,
    api,
  }) => {
    const { species } = await seed.species({ common: unique('Mantis') });
    for (let i = 0; i < 3; i += 1) await seed.animal(species.id, { price: 250 });
    await api.put(`/species/${species.id}`, { sale_format: 'piece' });

    const { data } = await api.get(`/animals?species_id=${species.id}&page_size=20`);
    expect(data).toHaveLength(1);
    expect(data[0].stock).toBe(3);
  });
});

test.describe('Descuento a varios', () => {
  test('productos: se eligen varios, se rebajan por % y se quita', async ({ page, seed, api }) => {
    const tag = unique('Promo');
    const a = await seed.product({ title: `${tag} sustrato`, price: 200 });
    const b = await seed.product({ title: `${tag} cueva`, price: 155 });

    await page.goto(`/dashboard/product?search=${encodeURIComponent(tag)}`);
    const rowOf = (title) => page.getByRole('row').filter({ hasText: title });
    await rowOf(a.title).getByRole('checkbox').check();
    await rowOf(b.title).getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Descuento (2)' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Descuento (%)').fill('20');
    await dialog.getByRole('button', { name: 'Aplicar −20%' }).click();

    await expect
      .poll(async () => {
        const [pa, pb] = await Promise.all([api.get(`/products/${a.id}`), api.get(`/products/${b.id}`)]);
        return [pa.price_retail, pa.compare_at_price, pb.price_retail, pb.compare_at_price].map(Number);
      })
      .toEqual([160, 200, 124, 155]);
    await expect(rowOf(a.title).getByText('−20%')).toBeVisible();

    await rowOf(a.title).getByRole('checkbox').check();
    await page.getByRole('button', { name: /^Descuento/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^Quitar descuento/ }).click();
    await expect
      .poll(async () => {
        const p = await api.get(`/products/${a.id}`);
        return [Number(p.price_retail), p.compare_at_price];
      })
      .toEqual([200, null]);
  });

  test('animales en venta: el % baja el precio y la fila lo marca', async ({
    page,
    seed,
    api,
  }) => {
    const { species } = await seed.species({ common: unique('Mantis') });
    const animal = await seed.animal(species.id, { price: 500 });

    await page.goto('/dashboard/animal');
    await openSpecies(page, species.common_name);
    // la fila del ejemplar (la de la especie también contiene su enlace)
    const row = page.getByRole('row', { name: new RegExp(`^${animal.code} `) });
    await row.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Descuento (1)' }).click();
    await page.getByRole('dialog').getByLabel('Descuento (%)').fill('10');
    await page.getByRole('dialog').getByRole('button', { name: 'Aplicar −10%' }).click();

    await expect
      .poll(async () => {
        const saved = await api.get(`/animals/${animal.id}`);
        return [Number(saved.price), Number(saved.compare_at_price)];
      })
      .toEqual([450, 500]);
    await expect(row.getByText('−10%')).toBeVisible();
  });
});
