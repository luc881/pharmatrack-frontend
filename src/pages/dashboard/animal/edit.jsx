import { useParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';
import { useGetAnimal } from 'src/actions/animal';

import { AnimalEditView } from 'src/sections/animal/view';

const metadata = { title: `Editar animal | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  const { id } = useParams();
  const { animal } = useGetAnimal(id);
  return (<><title>{metadata.title}</title><AnimalEditView currentAnimal={animal} /></>);
}
