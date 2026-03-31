import { paths } from 'src/routes/paths';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export const _account = [
  { label: 'Home', href: '/', icon: <Iconify icon="solar:home-angle-bold-duotone" /> },
  {
    label: 'Mi cuenta',
    href: paths.dashboard.user.account,
    icon: <Iconify icon="solar:user-id-bold-duotone" />,
  },
];
