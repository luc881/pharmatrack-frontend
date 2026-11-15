import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

// ----------------------------------------------------------------------

// Dos vistas de lo mismo, los animales en venta: la lista por especie y la
// tabla para cambiar precios y cantidades de corrido (la «hoja de inventario»)
export function SaleViewSwitch({ value, sx }) {
  return (
    <ToggleButtonGroup exclusive size="small" value={value} aria-label="Vista" sx={sx}>
      <ToggleButton value="list" component={RouterLink} href={paths.dashboard.animal.root}>
        Lista
      </ToggleButton>
      <ToggleButton value="sheet" component={RouterLink} href={paths.dashboard.animal.sheet}>
        Tabla de precios
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
