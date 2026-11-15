import { test, expect } from './fixtures';

// ----------------------------------------------------------------------
// General: con sesión iniciada, cada sección principal abre sin errores.
// ----------------------------------------------------------------------

const PAGES = [
  ['/dashboard', /Bienvenido de vuelta/],
  ['/dashboard/animal', 'En venta'],
  ['/dashboard/animal/breeding', 'Pie de cría y crianza'],
  ['/dashboard/animal/taxonomy', 'Especies y morphs'],
  ['/dashboard/animal/history', 'Vendidos y bajas'],
  ['/dashboard/animal/sheet', 'En venta'],
  ['/dashboard/product', /Productos/],
  ['/dashboard/product/provisional', 'Productos por revisar'],
  ['/dashboard/sale', /Ventas|Historial/],
  ['/dashboard/sale/summary', 'Corte de caja'],
  ['/dashboard/quick-sale', 'Venta rápida'],
];

for (const [url, heading] of PAGES) {
  test(`abre ${url}`, async ({ page }) => {
    await page.goto(url);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
  });
}

test('sin sesión manda al inicio de sesión', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/dashboard/animal');
  await expect(page).toHaveURL(/sign-in/);
  await context.close();
});
