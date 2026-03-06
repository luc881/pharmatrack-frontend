import { useParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';
import { useGetBranch } from 'src/actions/branch';

import { BranchEditView } from 'src/sections/branch/view';

const metadata = { title: `Editar sucursal | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  const { id = '' } = useParams();
  const { branch } = useGetBranch(id);
  return (<><title>{metadata.title}</title><BranchEditView branch={branch} /></>);
}
