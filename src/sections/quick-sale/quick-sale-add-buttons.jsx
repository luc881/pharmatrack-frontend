import { useState } from 'react';

import Menu from '@mui/material/Menu';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';

import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------
// Cómo se agrega algo a la venta rápida, siempre los mismos tres botones
// (arriba y en la pantalla vacía):
//   + Agregar productos → elegir lo que ya está en el inventario
//   + Alta rápida       → ventana corta: producto temporal o animal
//   + Alta completa ↗   → el formulario completo en otra pestaña (la cuenta
//                         en curso no se pierde; al volver se actualiza)
// ----------------------------------------------------------------------

const FULL = [
  {
    label: 'Animal',
    help: 'Con fotos, sexo, documentos… Queda en tu inventario.',
    href: `${paths.dashboard.animal.new}?purpose=sale&quick_sale=1`,
    permission: 'animals.create',
  },
  {
    label: 'Producto',
    help: 'Entra al catálogo de la tienda.',
    href: `${paths.dashboard.product.new}?quick_sale=1`,
    permission: 'products.create',
  },
];

export function QuickSaleAddButtons({
  online,
  permissions = [],
  onPick,
  onQuickProduct,
  onQuickAnimal,
}) {
  const [quickMenu, setQuickMenu] = useState(null);
  const [fullMenu, setFullMenu] = useState(null);
  const can = (permission) => permissions.includes(permission);
  const full = FULL.filter((item) => can(item.permission));

  return (
    <>
      <Button variant="outlined" disabled={!online} onClick={onPick}>
        + Agregar productos
      </Button>

      <Button variant="outlined" onClick={(e) => setQuickMenu(e.currentTarget)}>
        + Alta rápida
      </Button>
      <Menu anchorEl={quickMenu} open={Boolean(quickMenu)} onClose={() => setQuickMenu(null)}>
        <MenuItem
          onClick={() => {
            setQuickMenu(null);
            onQuickProduct();
          }}
        >
          <ListItemText
            primary="Producto temporal"
            secondary="Solo para cobrar ahora, también sin internet. Se revisa después."
          />
        </MenuItem>
        {can('animals.create') && (
          <MenuItem
            disabled={!online}
            onClick={() => {
              setQuickMenu(null);
              onQuickAnimal();
            }}
          >
            <ListItemText
              primary="Animal"
              secondary={
                online ? 'Especie, cuántos y precio. Queda en tu inventario.' : 'Necesita internet'
              }
            />
          </MenuItem>
        )}
      </Menu>

      {full.length > 0 && (
        <>
          <Button
            variant="outlined"
            disabled={!online}
            onClick={(e) => setFullMenu(e.currentTarget)}
          >
            + Alta completa
          </Button>
          <Menu anchorEl={fullMenu} open={Boolean(fullMenu)} onClose={() => setFullMenu(null)}>
            {full.map((item) => (
              <MenuItem
                key={item.label}
                component="a"
                href={item.href}
                target="_blank"
                rel="noopener"
                onClick={() => setFullMenu(null)}
              >
                <ListItemText primary={`${item.label} ↗`} secondary={item.help} />
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </>
  );
}
