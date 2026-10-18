import { useParams } from 'react-router';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetCareSheet } from 'src/actions/care-sheets';

import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { CareSheetForm } from '../care-sheet-form';

// ----------------------------------------------------------------------

export function CareSheetFormView() {
  const { id } = useParams();
  const { careSheet, careSheetLoading, careSheetError } = useGetCareSheet(id);

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading={id ? 'Editar ficha de cuidados' : 'Nueva ficha de cuidados'}
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Fichas de cuidados', href: paths.dashboard.careSheet.root },
          { name: id ? (careSheet?.scientific_name ?? 'Editar') : 'Nueva' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      {!id && <CareSheetForm />}
      {id && careSheetError && <EmptyContent title="No se encontró la ficha" />}
      {id && !careSheetLoading && careSheet && <CareSheetForm current={careSheet} />}
    </DashboardContent>
  );
}
