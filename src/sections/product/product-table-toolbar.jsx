import { useState } from 'react';

import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import { Toolbar } from '@mui/x-data-grid';
import InputAdornment from '@mui/material/InputAdornment';

import { Iconify } from 'src/components/iconify';
import {
  ToolbarContainer,
  ToolbarLeftPanel,
  ToolbarRightPanel,
  CustomToolbarExportButton,
  CustomToolbarColumnsButton,
  CustomToolbarSettingsButton,
} from 'src/components/custom-data-grid';

// ----------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' },
];

// ----------------------------------------------------------------------

export function ProductTableToolbar({
  initialSearch = '',
  onSearchSubmit,
  brands = [],
  categories = [],
  selectedBrand,
  selectedCategory,
  selectedStatus,
  onBrandChange,
  onCategoryChange,
  onStatusChange,
  selectedRowCount,
  onOpenConfirmDeleteRows,
  settings,
  onChangeSettings,
}) {
  const [localSearch, setLocalSearch] = useState(initialSearch);

  return (
    <Toolbar sx={{ flexDirection: 'column', alignItems: 'stretch', py: 1, gap: 1 }}>
      {/* Row 1: search + actions */}
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
          <CustomToolbarExportButton />
          <CustomToolbarSettingsButton settings={settings} onChangeSettings={onChangeSettings} />
        </ToolbarRightPanel>
      </ToolbarContainer>

      {/* Row 2: filters */}
      <ToolbarContainer sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Autocomplete
          size="small"
          options={brands}
          getOptionLabel={(o) => o.name}
          value={selectedBrand}
          onChange={(_, val) => onBrandChange(val)}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          sx={{ width: { xs: '100%', sm: 220 } }}
          renderInput={(params) => (
            <TextField {...params} label="Marca" placeholder="Todas las marcas" />
          )}
        />

        <Autocomplete
          size="small"
          options={categories}
          getOptionLabel={(o) => o.name}
          value={selectedCategory}
          onChange={(_, val) => onCategoryChange(val)}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          sx={{ width: { xs: '100%', sm: 240 } }}
          renderInput={(params) => (
            <TextField {...params} label="Categoría" placeholder="Todas las categorías" />
          )}
        />

        <TextField
          select
          size="small"
          label="Estado"
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value)}
          sx={{ width: { xs: '100%', sm: 140 } }}
        >
          {STATUS_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </TextField>
      </ToolbarContainer>
    </Toolbar>
  );
}
