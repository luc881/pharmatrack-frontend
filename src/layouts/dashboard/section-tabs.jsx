import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

import { usePathname } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useAuthContext } from 'src/auth/hooks';

import { findSection } from './section-tabs-config';

// ----------------------------------------------------------------------
// Pestañas del área actual (Ventas, Animales, Productos…), arriba del
// contenido. Las pinta DashboardContent, así que cualquier página de un área
// las tiene sin hacer nada. Fuera de un área no pinta nada.
// ----------------------------------------------------------------------

export function SectionTabs() {
  const pathname = usePathname();
  const { user } = useAuthContext();

  // En formularios de alta/edición las pestañas solo distraen (la miga de
  // pan ya dice dónde estás); el POS de nueva venta queda limpio.
  const isForm = /\/(new|edit)$/.test(pathname);
  const found = isForm ? null : findSection(pathname);
  if (!found) return null;

  const perms = user?.permissions ?? [];
  const allowed = (item) => !item.allowedRoles || item.allowedRoles.some((p) => perms.includes(p));

  // Una pestaña con hijos solo se ve si alguno de sus hijos se ve
  const tabs = found.section.tabs
    .map((tab) => (tab.children ? { ...tab, children: tab.children.filter(allowed) } : tab))
    .filter((tab) => allowed(tab) && (!tab.children || tab.children.length));

  if (tabs.length < 2 && !found.tab.children) return null;

  const hrefOf = (tab) => (tab.children ? tab.children[0].path : tab.path);
  const active = tabs.find((t) => t.label === found.tab.label);
  const subTabs = active?.children ?? [];

  return (
    <>
      <Tabs
        value={active ? active.label : false}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: subTabs.length ? 1.5 : 4, boxShadow: (t) => `inset 0 -2px 0 0 ${t.vars.palette.divider}` }}
      >
        {tabs.map((tab) => (
          <Tab key={tab.label} value={tab.label} label={tab.label} component={RouterLink} href={hrefOf(tab)} />
        ))}
      </Tabs>

      {subTabs.length > 0 && (
        <Tabs
          value={found.child?.label ?? false}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{
            mb: 4,
            minHeight: 36,
            '& .MuiTab-root': { minHeight: 36, py: 0.5, px: 1.5, fontSize: 13, borderRadius: 1, mr: 1 },
            '& .MuiTab-root.Mui-selected': { bgcolor: 'action.selected' },
            '& .MuiTabs-indicator': { display: 'none' },
          }}
        >
          {subTabs.map((child) => (
            <Tab key={child.label} value={child.label} label={child.label} component={RouterLink} href={child.path} />
          ))}
        </Tabs>
      )}
    </>
  );
}
