import { useParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';
import { useGetAnimal } from 'src/actions/animal';

import { AnimalDetailsView } from 'src/sections/animal/view';

const metadata = { title: `Detalle del animal | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  const { id } = useParams();
  const { animal } = useGetAnimal(id);
  return (<><title>{metadata.title}</title><AnimalDetailsView animal={animal} /></>);
}
