import { test, unique, expect } from './fixtures';

// ----------------------------------------------------------------------
// Venta rápida (la expo): cobrar con y sin internet, abrir sin red, producto
// de último momento, talón de orden, reparto por dueño, stock y buscador.
// ----------------------------------------------------------------------

const button = (page, title) =>
  page.getByRole('button', { name: new RegExp(`^Agregar ${title}`, 'i') });
const cart = (page) => page.getByRole('region', { name: 'Cuenta' });
const salesCount = async (api) => (await api.get('/sales?page=1&page_size=1')).total;

// Abre la venta rápida y espera a que el equipo tenga el catálogo
async function openQuickSale(page, { print = false } = {}) {
  await page.goto('/dashboard/quick-sale');
  await expect(page.getByText(/Listo para vender sin internet/)).toBeVisible({ timeout: 30_000 });
  const printBox = page.getByRole('checkbox', { name: 'Imprimir ticket' });
  if ((await printBox.isChecked()) !== print) await printBox.click();
}

const charge = (page) =>
  cart(page)
    .getByRole('button', { name: /^Cobrar/ })
    .click();

test.describe('Venta rápida', () => {
  test('cobra con internet y la venta queda registrada', async ({ page, seed, api }) => {
    const p = await seed.product({ title: unique('Cueva'), price: 80, quick_sale: true });
    const before = await salesCount(api);

    await openQuickSale(page);
    await button(page, p.title).click();
    await button(page, p.title).click();
    await expect(cart(page).getByTestId('total')).toHaveText('$160');
    await charge(page);

    await expect.poll(() => salesCount(api)).toBe(before + 1);
    await expect(cart(page).getByText('Toca un producto para empezar')).toBeVisible();
  });

  test('sin internet guarda la venta y la sube al volver la red', async ({ page, seed, api }) => {
    const p = await seed.product({ title: unique('Musgo'), price: 60, quick_sale: true });
    const before = await salesCount(api);

    await openQuickSale(page);
    await page.context().setOffline(true);
    await button(page, p.title).click();
    await charge(page);
    await expect(page.getByText('1 por subir')).toBeVisible();
    expect(await salesCount(api)).toBe(before);

    await page.context().setOffline(false);
    await expect(page.getByText(/por subir/)).toHaveCount(0, { timeout: 30_000 });
    await expect.poll(() => salesCount(api)).toBe(before + 1);
  });

  test('preparada, la app abre y cobra sin internet', async ({ page, seed, api }) => {
    const p = await seed.product({ title: unique('Sustrato'), price: 45, quick_sale: true });
    const before = await salesCount(api);

    await openQuickSale(page);
    await page.context().setOffline(true);
    await page.reload(); // la sirve el service worker
    await expect(
      page.getByText('Sin conexión: las ventas se guardan en este equipo')
    ).toBeVisible();
    await button(page, p.title).click();
    await charge(page);
    await expect(page.getByText('1 por subir')).toBeVisible();

    await page.context().setOffline(false);
    await expect.poll(() => salesCount(api), { timeout: 30_000 }).toBe(before + 1);
  });

  test('un producto de último momento sin internet llega a «Por revisar»', async ({
    page,
    api,
  }) => {
    const title = unique('Tronco');

    await openQuickSale(page);
    await page.context().setOffline(true);
    await page.getByRole('button', { name: '+ Alta rápida' }).click();
    await page.getByRole('menuitem', { name: /Producto temporal/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nombre').fill(title);
    await dialog.getByLabel('Precio').fill('120,50');
    await dialog.getByRole('button', { name: 'Agregar a la cuenta' }).click();
    await expect(cart(page).getByTestId('total')).toHaveText('$120.5');
    await charge(page);

    await page.context().setOffline(false);
    await expect
      .poll(async () => (await api.get('/products/provisional')).map((r) => r.title.toLowerCase()))
      .toContain(title.toLowerCase());

    await page.goto('/dashboard/product/provisional');
    await expect(page.getByText(new RegExp(title, 'i'))).toBeVisible();
  });

  test('lo que se prepara imprime su talón de orden tras el ticket', async ({ page, seed }) => {
    const slush = await seed.product({
      title: unique('Slushie limón'),
      price: 100,
      quick_sale: true,
      needs_prep: true,
    });

    await openQuickSale(page, { print: true });
    await button(page, slush.title).click();
    await button(page, slush.title).click();
    await charge(page);

    await expect(page).toHaveURL(/\/quick-sale\/ticket\//);
    const order = page.getByTestId('prep-order');
    await expect(order.getByText('ORDEN')).toBeVisible();
    await expect(order.getByText(new RegExp(`2 × ${slush.title}`, 'i'))).toBeVisible();
    await expect(page.getByText('Gracias por tu compra')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__printed ?? 0)).toBeGreaterThan(0);
  });

  test('una venta mezclada dice cuánto es de cada dueño y sale en el corte', async ({
    page,
    seed,
    api,
  }) => {
    const owner = await api.post('/suppliers', { name: unique('Insectario Vecino') });
    const mine = await seed.product({ title: unique('Cueva propia'), price: 80, quick_sale: true });
    const theirs = await seed.product({
      title: unique('Mantis ajena'),
      price: 300,
      quick_sale: true,
      consignor_id: owner.id,
    });

    await openQuickSale(page);
    await button(page, mine.title).click();
    await button(page, theirs.title).click();
    const split = page.getByRole('list', { name: 'Reparto' });
    await expect(split.getByText('Propio')).toBeVisible();
    await expect(split.getByText(owner.name)).toBeVisible();
    await expect(split.getByText('$300')).toBeVisible();
    const before = await salesCount(api);
    await charge(page);
    // «por subir» aparece un instante después del cobro: se espera a la venta en el servidor
    await expect.poll(() => salesCount(api), { timeout: 30_000 }).toBe(before + 1);

    await page.goto('/dashboard/sale/summary');
    const theirsCard = page.getByRole('region', { name: owner.name });
    await expect(theirsCard.getByText(new RegExp(theirs.title, 'i'))).toBeVisible();
  });

  test('lo último en stock se agota y dos toques en cobrar hacen una sola venta', async ({
    page,
    seed,
    api,
  }) => {
    const p = await seed.product({
      title: unique('Terrario'),
      price: 900,
      stock: 1,
      quick_sale: true,
    });
    const before = await salesCount(api);

    await openQuickSale(page);
    await expect(button(page, p.title)).toContainText('Quedan 1');
    await button(page, p.title).click();
    await cart(page)
      .getByRole('button', { name: /^Cobrar/ })
      .dblclick();

    await expect(button(page, p.title)).toBeDisabled();
    await expect(button(page, p.title)).toContainText('Agotado');
    await expect.poll(() => salesCount(api)).toBe(before + 1);
    await page.waitForTimeout(1500);
    expect(await salesCount(api)).toBe(before + 1);
  });

  test('el buscador deja solo lo que coincide, sin acentos', async ({ page, seed }) => {
    const a = await seed.product({ title: unique('Decoración roca'), price: 50, quick_sale: true });
    const b = await seed.product({ title: unique('Bebedero'), price: 30, quick_sale: true });

    await openQuickSale(page);
    await page.getByRole('searchbox', { name: 'Buscar producto' }).fill('decoracion roca');
    await expect(button(page, a.title)).toBeVisible();
    await expect(button(page, b.title)).toHaveCount(0);
  });

  test('«+ Alta rápida» → Animal lo pone en venta rápida sin anunciarlo en el sitio', async ({
    page,
    seed,
    api,
  }) => {
    const { species } = await seed.species({ common: unique('Gecko') });

    await openQuickSale(page);
    // directo desde la venta rápida, sin cambiar de pestaña
    await page.getByRole('button', { name: '+ Alta rápida' }).click();
    await page.getByRole('menuitem', { name: /^Animal/ }).click();
    const form = page.getByRole('dialog', { name: 'Alta rápida de animal' });
    await form.getByLabel('Especie y variedad').fill(species.common_name);
    await page.getByRole('option', { name: 'Nominal' }).click();
    await form.getByLabel('Precio de venta').fill('1500');
    await form.getByRole('button', { name: 'Poner en venta' }).click();
    await expect(form).toHaveCount(0);

    const [animal] = (await api.get(`/animals?species_id=${species.id}`)).data;
    expect(animal).toMatchObject({ quick_sale: true, show_public: false });
    const site = await api.publicGet(`/public/animals?species_id=${species.id}`);
    expect(site.data).toEqual([]);
    await expect(
      page.getByRole('button', { name: new RegExp(`^Agregar .*${animal.code}`) })
    ).toBeVisible({
      timeout: 30_000,
    });
  });

  test('si otro equipo vendió lo mismo, la venta queda por revisar y se puede descartar', async ({
    page,
    seed,
    api,
  }) => {
    const p = await seed.product({
      title: unique('Último ejemplar'),
      price: 700,
      stock: 1,
      quick_sale: true,
    });
    const branches = await api.get('/branches');
    const branchId = (Array.isArray(branches) ? branches : branches.data)[0].id;

    // este equipo vende el último sin red…
    await openQuickSale(page);
    await page.context().setOffline(true);
    await button(page, p.title).click();
    await charge(page);
    await expect(page.getByText('1 por subir')).toBeVisible();

    // …mientras otro equipo lo vende con red
    await api.post('/sales/checkout', {
      branch_id: branchId,
      items: [{ product_id: p.id, quantity: 1 }],
      payments: [{ method_payment: 'cash', amount: 700 }],
    });

    await page.context().setOffline(false);
    await expect(page.getByText('1 por revisar')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/stock/i).first()).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Descartar' }).click();
    await expect(page.getByText(/por revisar/)).toHaveCount(0);
  });

  test('vender un animal en la venta rápida lo pasa a «Vendidos y bajas»', async ({
    page,
    seed,
  }) => {
    const { species } = await seed.species({ common: unique('Gecko') });
    const animal = await seed.animal(species.id, { quick_sale: true, price: 1200 });

    await openQuickSale(page);
    await page.getByRole('button', { name: new RegExp(`^Agregar .*${animal.code}`) }).click();
    await charge(page);
    await expect(page.getByText(/por subir/)).toHaveCount(0, { timeout: 30_000 });

    await page.goto('/dashboard/animal/history');
    const row = page
      .getByRole('row')
      .filter({ has: page.getByRole('link', { name: species.common_name, exact: true }) });
    await row.getByRole('cell').first().click();
    await expect(page.getByRole('link', { name: animal.code })).toBeVisible();

    await page.goto('/dashboard/animal');
    await expect(page.getByRole('link', { name: species.common_name, exact: true })).toHaveCount(0);
  });

  test('«Marcar todos» pone en la venta rápida todos los ejemplares de una especie', async ({
    page,
    seed,
    api,
  }) => {
    const { species } = await seed.species({ common: unique('Isópodo') });
    const a = await seed.animal(species.id);
    const b = await seed.animal(species.id);

    await openQuickSale(page);
    await page.getByRole('button', { name: '+ Agregar productos' }).first().click();
    const picker = page.getByRole('dialog', { name: /Qué se vende/ });
    await picker.getByLabel('Buscar').fill(species.common_name);
    await picker.getByRole('button', { name: `Marcar todos: ${species.common_name}` }).click();
    await expect
      .poll(async () => (await api.get('/products/quick-sale')).map((i) => i.id))
      .toEqual(expect.arrayContaining([a.product_id, b.product_id]));
    await picker.getByRole('button', { name: 'Listo' }).click();
    // los dos de la misma especie van en un solo botón; al tocarlo se elige cuál
    await page
      .getByRole('button', { name: new RegExp(`^Elegir ${species.common_name}`, 'i') })
      .click();
    const choose = page.getByRole('dialog', { name: new RegExp(species.common_name, 'i') });
    await expect(
      choose.getByRole('button', { name: new RegExp(`^Agregar ${a.code}`) })
    ).toBeVisible();
    await expect(
      choose.getByRole('button', { name: new RegExp(`^Agregar ${b.code}`) })
    ).toBeVisible();
  });
});

test.describe('Productos por revisar', () => {
  async function provisional(api, title) {
    return api.post('/products/provisional', {
      client_key: `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      price_retail: 99,
    });
  }

  test('desechar lo saca de la venta rápida', async ({ page, api }) => {
    const item = await provisional(api, unique('Corcho'));

    await page.goto('/dashboard/product/provisional');
    const row = page.getByRole('row').filter({ hasText: new RegExp(item.title, 'i') });
    page.once('dialog', (dialog) => dialog.accept());
    await row.getByRole('button', { name: 'Desechar' }).click();
    await expect(row).toHaveCount(0);

    const quick = await api.get('/products/quick-sale');
    expect(quick.map((i) => i.id)).not.toContain(item.id);
  });

  test('conservar lo vuelve producto formal y abre su ficha', async ({ page, api }) => {
    const item = await provisional(api, unique('Hojarasca'));

    await page.goto('/dashboard/product/provisional');
    const row = page.getByRole('row').filter({ hasText: new RegExp(item.title, 'i') });
    await row.getByRole('button', { name: 'Completar y conservar' }).click();

    await expect(page).toHaveURL(new RegExp(`/dashboard/product/${item.id}/edit`));
    const product = await api.get(`/products/${item.id}`);
    expect(product.provisional).toBe(false);
  });
});
