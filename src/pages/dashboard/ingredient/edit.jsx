import { useParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';
import { useGetIngredient } from 'src/actions/ingredient';

import { IngredientEditView } from 'src/sections/ingredient/view';

const metadata = { title: `Editar ingrediente | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  const { id } = useParams();
  const { ingredient } = useGetIngredient(id);
  return (<><title>{metadata.title}</title><IngredientEditView currentIngredient={ingredient} /></>);
}
