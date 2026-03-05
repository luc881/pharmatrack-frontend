import Button from '@mui/material/Button';
import { Toolbar } from '@mui/x-data-grid';

import { Iconify } from 'src/components/iconify';
import {
  ToolbarContainer,
  ToolbarLeftPanel,
  ToolbarRightPanel,
  CustomToolbarQuickFilter,
  CustomToolbarExportButton,
  CustomToolbarFilterButton,
  CustomToolbarColumnsButton,
  CustomToolbarSettingsButton,
} from 'src/components/custom-data-grid';

// ----------------------------------------------------------------------

export function ProductTableToolbar({
  selectedRowCount,
  onOpenConfirmDeleteRows,
  /********/
  settings,
  onChangeSettings,
}) {
  return (
    <Toolbar>
      <ToolbarContainer>
        <ToolbarLeftPanel>
          <CustomToolbarQuickFilter />
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
