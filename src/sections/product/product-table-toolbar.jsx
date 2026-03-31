import { useState } from 'react';

import Button from '@mui/material/Button';
import { Toolbar } from '@mui/x-data-grid';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';

import { Iconify } from 'src/components/iconify';
import {
  ToolbarContainer,
  ToolbarLeftPanel,
  ToolbarRightPanel,
  CustomToolbarExportButton,
  CustomToolbarFilterButton,
  CustomToolbarColumnsButton,
  CustomToolbarSettingsButton,
} from 'src/components/custom-data-grid';

// ----------------------------------------------------------------------

export function ProductTableToolbar({
  initialSearch = '',
  onSearchSubmit,
  selectedRowCount,
  onOpenConfirmDeleteRows,
  /********/
  settings,
  onChangeSettings,
}) {
  const [localSearch, setLocalSearch] = useState(initialSearch);

  return (
    <Toolbar>
      <ToolbarContainer>
        <ToolbarLeftPanel>
          <TextField
            size="small"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit(localSearch)}
            placeholder="Buscar y presiona Enter..."
            sx={{ width: 1, maxWidth: { md: 260 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </ToolbarLeftPanel>

        <ToolbarRightPanel>
          {!!selectedRowCount && (
            <Button
              size="small"
              color="error"
              startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
              onClick={onOpenConfirmDeleteRows}
            >
              Eliminar ({selectedRowCount})
            </Button>
          )}

          <CustomToolbarColumnsButton />
          <CustomToolbarFilterButton />
          <CustomToolbarExportButton />
          <CustomToolbarSettingsButton settings={settings} onChangeSettings={onChangeSettings} />
        </ToolbarRightPanel>
      </ToolbarContainer>
    </Toolbar>
  );
}
