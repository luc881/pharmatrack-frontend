import Alert from '@mui/material/Alert';

// ----------------------------------------------------------------------

// Las vistas que cuentan todo el inventario lo cargan de una vez y la API da
// máximo 500 por página: si hay más, lo dice en vez de mostrar cuentas cortas.
// ponytail: tope de 500; paginar o contar en la API si el inventario crece
export function AnimalCapAlert({ shown, total, sx }) {
  if (total <= shown) return null;
  return (
    <Alert severity="warning" sx={sx}>
      Solo se cargaron los primeros {shown} de {total} animales: los números de esta página no
      cuentan los otros {total - shown}.
    </Alert>
  );
}
