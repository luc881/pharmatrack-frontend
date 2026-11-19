// Filtro «Dueño» (consignor_id): '' todos · 'mine' los míos · 'others' de
// cualquier proveedor · id de uno. Sirve para productos y animales.
export const ownerTest = (owner) => (item) => {
  if (owner === '') return true;
  if (owner === 'mine') return !item.consignor_id;
  if (owner === 'others') return Boolean(item.consignor_id);
  return item.consignor_id === Number(owner);
};
