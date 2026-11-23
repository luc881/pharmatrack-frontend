import { useState } from 'react';

import Button from '@mui/material/Button';

import { exportSales } from 'src/actions/sale';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// Excel con todas las ventas de los filtros (no solo la página a la vista) y
// lo que se vendió en cada una
export function SalesExportButton({ filters }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const url = URL.createObjectURL(await exportSales(filters));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${['ventas', filters.dateFrom, filters.dateTo].filter(Boolean).join('_')}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('No se pudo descargar el Excel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="small"
      variant="outlined"
      loading={loading}
      startIcon={<Iconify icon="solar:import-bold" />}
      onClick={handleClick}
    >
      Descargar Excel
    </Button>
  );
}
