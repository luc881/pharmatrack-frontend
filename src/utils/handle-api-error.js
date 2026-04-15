/**
 * Maps API error messages (from backend `detail` field) to specific form fields.
 * Uses setError from react-hook-form to show inline field errors instead of toasts.
 *
 * Returns true  → error was handled as a field error (don't show toast)
 * Returns false → error is generic (caller should show a toast)
 */

// Rules are checked in order — put more specific strings before generic catch-alls.
const FIELD_ERROR_RULES = [
  // ── Users ──────────────────────────────────────────────────────────────
  {
    match: 'User with this email already exists',
    field: 'email',
    message: 'Este email ya está registrado',
  },

  // ── Roles ───────────────────────────────────────────────────────────────
  {
    match: 'Role name already exists',
    field: 'name',
    message: 'Ya existe un rol con este nombre',
  },

  // ── Branches ────────────────────────────────────────────────────────────
  {
    match: 'Branch already exists',
    field: 'name',
    message: 'Ya existe una sucursal con este nombre',
  },

  // ── Products (more specific before generic) ─────────────────────────────
  {
    match: 'title and SKU combination already exists',
    field: 'sku',
    message: 'Ya existe un producto con este título y SKU',
  },
  {
    match: 'Product with this SKU already exists',
    field: 'sku',
    message: 'Este SKU ya está en uso',
  },

  // ── Product categories ───────────────────────────────────────────────────
  {
    match: 'category with this name already exists',
    field: 'name',
    message: 'Ya existe una categoría con este nombre',
  },

  // ── Ingredients ──────────────────────────────────────────────────────────
  {
    match: 'Ingredient with this name already exists',
    field: 'name',
    message: 'Ya existe un ingrediente con este nombre',
  },

  // ── Suppliers ────────────────────────────────────────────────────────────
  {
    match: 'Email already in use',
    field: 'email',
    message: 'Este email ya está en uso',
  },
  {
    match: 'RFC already in use',
    field: 'rfc',
    message: 'Este RFC ya está en uso',
  },

  // ── Generic catch-all for product_brand / product_master ─────────────────
  // Messages like "The brand 'X' already exists." / "Product master with name 'X' already exists."
  {
    match: 'already exists',
    field: 'name',
    message: 'Ya existe un elemento con este nombre',
  },
];

export function handleApiError(error, setError) {
  const detail = error?.message ?? '';

  for (const rule of FIELD_ERROR_RULES) {
    if (detail.includes(rule.match)) {
      setError(rule.field, { message: rule.message ?? detail });
      return true;
    }
  }

  return false;
}
