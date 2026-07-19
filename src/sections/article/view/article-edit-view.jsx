import { useParams } from 'react-router';

import { paths } from 'src/routes/paths';

import { useGetArticle } from 'src/actions/articles';
import { DashboardContent } from 'src/layouts/dashboard';

import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

import { ArticleCreateEditForm } from '../article-create-edit-form';

// ----------------------------------------------------------------------

export function ArticleEditView() {
  const { id } = useParams();
  const { article, articleLoading, articleError } = useGetArticle(id);

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Editar artículo"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Artículos', href: paths.dashboard.article.root },
          { name: article?.title ?? 'Editar' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />
      {articleError ? (
        <EmptyContent title="No se encontró el artículo" />
      ) : (
        !articleLoading && article && <ArticleCreateEditForm currentArticle={article} />
      )}
    </DashboardContent>
  );
}
