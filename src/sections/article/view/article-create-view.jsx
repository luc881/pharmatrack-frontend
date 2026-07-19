import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';

import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { ArticleCreateEditForm } from '../article-create-edit-form';

// ----------------------------------------------------------------------

export function ArticleCreateView() {
  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Nuevo artículo"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Artículos', href: paths.dashboard.article.root },
          { name: 'Nuevo' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      <ArticleCreateEditForm />
    </DashboardContent>
  );
}
