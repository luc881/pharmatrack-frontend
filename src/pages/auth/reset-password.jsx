import { CONFIG } from 'src/global-config';

import { JwtResetPasswordView } from 'src/auth/view/jwt';

// ----------------------------------------------------------------------

const metadata = { title: `Restablecer contraseña | ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>
      <JwtResetPasswordView />
    </>
  );
}
