import { useParams } from 'src/routes/hooks';

import { CONFIG } from 'src/global-config';
import { useGetRole } from 'src/actions/role';

import { RoleEditView } from 'src/sections/role/view';

// ----------------------------------------------------------------------

const metadata = { title: `Editar rol | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  const { id = '' } = useParams();
  const { role } = useGetRole(id);

  return (
    <>
      <title>{metadata.title}</title>
      <RoleEditView role={role} />
    </>
  );
}
