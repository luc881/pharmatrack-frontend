import { CONFIG } from 'src/global-config';

import { JwtForgotPasswordView } from 'src/auth/view/jwt';

// ----------------------------------------------------------------------

const metadata = { title: `Olvidé mi contraseña | ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>
      <JwtForgotPasswordView />
    </>
  );
}
