import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';
import { updateLinkPages, useGetLinkPages, updateSiteTicker, useGetSiteSettings } from 'src/actions/site';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------
// Contenido de /links, la página tipo linktree del sitio (bio de Instagram,
// QR del ticket, tarjetas): eventos, guías, textos y botones. Al final, la
// cinta de novedades del sitio (otro ajuste, con su propio guardado).
// Se guarda todo junto (PUT completo) y el sitio lo muestra en ~1 minuto.
// ----------------------------------------------------------------------

const SITE = 'https://www.opuntiaden.com';

// Igual que el API: rutas del sitio, http(s), tel: y mailto:
const URL_OK = /^(\/[^/]|\/$|https?:\/\/|tel:|mailto:)/;
const urlError = (url, required) =>
  !url ? (required ? 'Obligatorio' : '') : URL_OK.test(url) ? '' : 'Usa /ruta, https://…, tel: o mailto:';


const NEW_EVENT = { title: '', place: '', date: '', time: '', ends: '', url: '', url_label: 'Más información' };
const NEW_GUIDE = { name: '', url: '', sub: false };
const NEW_BUTTON = { label: '', url: '', primary: false };

// Primer error del formulario, para no mandar al API algo que va a rechazar
function firstError(d) {
  for (const e of d.events) {
    if (!e.title.trim()) return 'Un evento no tiene nombre.';
    if (!e.date) return `Falta la fecha de "${e.title}".`;
    if (urlError(e.url)) return `El enlace de "${e.title}" no es válido.`;
  }
  for (const g of d.guides) {
    if (!g.name.trim()) return 'Una guía no tiene nombre.';
    if (urlError(g.url)) return `El enlace de la guía "${g.name}" no es válido.`;
  }
  const page = d.pages.links;
  if (!page.title.trim()) return 'Falta el titular de la página.';
  for (const b of page.buttons) {
    if (!b.label.trim()) return 'Un botón no tiene texto.';
    if (urlError(b.url, true)) return `El enlace de "${b.label}" no es válido.`;
  }
  return null;
}

// Helpers inmutables para listas
const setAt = (list, i, patch) => list.map((item, j) => (j === i ? { ...item, ...patch } : item));
const removeAt = (list, i) => list.filter((_, j) => j !== i);
const move = (list, i, dir) => {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

export function SiteLinksView() {
  const { linkPages, linkPagesLoading, linkPagesError, linkPagesMutate } = useGetLinkPages();
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (linkPages) setDraft(structuredClone(linkPages));
  }, [linkPages]);

  const dirty = draft && linkPages && JSON.stringify(draft) !== JSON.stringify(linkPages);

  // Avisar antes de cerrar o recargar con cambios sin guardar
  // ponytail: solo cierre/recarga del navegador; navegar dentro del dashboard no avisa
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const handleSave = async () => {
    const error = firstError(draft);
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      await linkPagesMutate(await updateLinkPages(draft), { revalidate: false });
      toast.success('Guardado. El sitio lo muestra en ~1 minuto.');
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const setEvents = (events) => setDraft((d) => ({ ...d, events }));
  const setGuides = (guides) => setDraft((d) => ({ ...d, guides }));
  const setPage = (key, patch) => setDraft((d) => ({ ...d, pages: { ...d.pages, [key]: { ...d.pages[key], ...patch } } }));

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Links y eventos"
        links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Sitio web' }, { name: 'Links y eventos' }]}
        action={
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!dirty || saving}
            startIcon={<Iconify icon="solar:check-circle-bold" />}
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
        Página tipo linktree del sitio:{' '}
        <a href={`${SITE}/links`} target="_blank" rel="noopener noreferrer">
          /links
        </a>{' '}
        (bio de Instagram, QR del ticket y tarjetas). Los cambios aparecen en el sitio en aproximadamente un minuto.
      </Typography>

      {linkPagesError ? (
        <EmptyContent title="No se pudo cargar el contenido" description="Reintenta en unos segundos." sx={{ py: 10 }} />
      ) : linkPagesLoading || !draft ? (
        <Typography>Cargando…</Typography>
      ) : (
        <Stack spacing={3}>
          {/* Eventos */}
          <Section
            title="Eventos"
            hint="Se muestra el próximo, con cuenta regresiva. Desaparece solo al día siguiente de su último día (hora de CDMX)."
            onAdd={() => setEvents([...draft.events, { ...NEW_EVENT }])}
            addLabel="Agregar evento"
          >
            {draft.events.length === 0 && <Empty>Sin eventos: la tarjeta no aparece.</Empty>}
            {draft.events.map((e, i) => (
              <Row key={i} onRemove={() => setEvents(removeAt(draft.events, i))}>
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '2fr 2fr' } }}>
                  <TextField label="Nombre" value={e.title} onChange={(ev) => setEvents(setAt(draft.events, i, { title: ev.target.value }))} required />
                  <TextField label="Lugar" value={e.place} onChange={(ev) => setEvents(setAt(draft.events, i, { place: ev.target.value }))} />
                </Box>
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' } }}>
                  <TextField label="Fecha" type="date" value={e.date} onChange={(ev) => setEvents(setAt(draft.events, i, { date: ev.target.value }))} slotProps={{ inputLabel: { shrink: true } }} required />
                  <TextField
                    label="Hora de inicio"
                    type="time"
                    value={e.time}
                    onChange={(ev) => setEvents(setAt(draft.events, i, { time: ev.target.value }))}
                    slotProps={{ inputLabel: { shrink: true } }}
                    helperText="Opcional"
                  />
                  <TextField
                    label="Último día"
                    type="date"
                    value={e.ends}
                    onChange={(ev) => setEvents(setAt(draft.events, i, { ends: ev.target.value }))}
                    slotProps={{ inputLabel: { shrink: true } }}
                    helperText="Solo si dura varios días"
                  />
                </Box>
                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' } }}>
                  <TextField
                    label="Enlace (boletos, post…)"
                    value={e.url}
                    onChange={(ev) => setEvents(setAt(draft.events, i, { url: ev.target.value.trim() }))}
                    error={!!urlError(e.url)}
                    helperText={urlError(e.url) || 'Opcional: sin enlace no hay botón'}
                  />
                  <TextField label="Texto del botón" value={e.url_label} onChange={(ev) => setEvents(setAt(draft.events, i, { url_label: ev.target.value }))} />
                </Box>
              </Row>
            ))}
          </Section>

          {/* Guías */}
          <Section
            title="Guías de cuidado"
            hint="Sin enlace, el botón dice “Pídela por WhatsApp”. “Especie” la muestra con sangría y nombre científico en itálica (la localidad entre comillas)."
            onAdd={() => setGuides([...draft.guides, { ...NEW_GUIDE }])}
            addLabel="Agregar guía"
          >
            {draft.guides.map((g, i) => (
              <Row
                key={i}
                inline
                onUp={() => setGuides(move(draft.guides, i, -1))}
                onDown={() => setGuides(move(draft.guides, i, 1))}
                onRemove={() => setGuides(removeAt(draft.guides, i))}
              >
                <Box sx={{ flex: 1, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '2fr 3fr auto' }, alignItems: 'center', pl: g.sub ? { md: 4 } : 0 }}>
                  <TextField size="small" label="Nombre" value={g.name} onChange={(ev) => setGuides(setAt(draft.guides, i, { name: ev.target.value }))} required />
                  <TextField
                    size="small"
                    label="Enlace"
                    value={g.url}
                    onChange={(ev) => setGuides(setAt(draft.guides, i, { url: ev.target.value.trim() }))}
                    error={!!urlError(g.url)}
                    helperText={urlError(g.url) || undefined}
                    placeholder="/articulos/…"
                  />
                  <FormControlLabel control={<Switch checked={g.sub} onChange={(ev) => setGuides(setAt(draft.guides, i, { sub: ev.target.checked }))} />} label="Especie" />
                </Box>
              </Row>
            ))}
          </Section>

          {/* Páginas */}
          <Card>
            <Typography variant="h6" sx={{ px: 3, pt: 3 }}>
              Página /links
            </Typography>
            <PageEditor page={draft.pages.links} onChange={(patch) => setPage('links', patch)} />
          </Card>

          <TickerEditor />
        </Stack>
      )}
    </DashboardContent>
  );
}

// ----------------------------------------------------------------------

// Cinta de novedades que corre en el sitio (antes del pie y en la suscripción).
// Vive en los ajustes del sitio, no en /links, así que se guarda aparte.
const TICKER_MAX = 8;

function TickerEditor() {
  const { site, siteMutate } = useGetSiteSettings();
  const [items, setItems] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (site) setItems(site.ticker ?? []);
  }, [site]);

  if (!items) return null;
  const dirty = JSON.stringify(items) !== JSON.stringify(site.ticker ?? []);

  const save = async () => {
    setSaving(true);
    try {
      await siteMutate(await updateSiteTicker(items.map((t) => t.trim()).filter(Boolean)), { revalidate: false });
      toast.success('Cinta guardada. El sitio la muestra en ~1 minuto.');
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title="Cinta de novedades"
      hint={`Frases que corren en el sitio antes del pie y en la suscripción (hasta ${TICKER_MAX}, de 80 caracteres). Se guarda con su propio botón.`}
      onAdd={() => setItems([...items, ''])}
      addLabel="Agregar frase"
      addDisabled={items.length >= TICKER_MAX}
    >
      {items.length === 0 && <Empty>Sin frases: la cinta no aparece en el sitio.</Empty>}
      {items.map((t, i) => (
        <Row
          key={i}
          inline
          onUp={() => setItems(move(items, i, -1))}
          onDown={() => setItems(move(items, i, 1))}
          onRemove={() => setItems(removeAt(items, i))}
        >
          <TextField
            size="small"
            fullWidth
            label={`Frase ${i + 1}`}
            value={t}
            onChange={(ev) => setItems(items.map((x, j) => (j === i ? ev.target.value : x)))}
            slotProps={{ htmlInput: { maxLength: 80 } }}
          />
        </Row>
      ))}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={save} disabled={!dirty || saving} startIcon={<Iconify icon="solar:check-circle-bold" />}>
          {saving ? 'Guardando…' : 'Guardar cinta'}
        </Button>
      </Box>
    </Section>
  );
}

function PageEditor({ page, onChange }) {
  const setButtons = (buttons) => onChange({ buttons });
  return (
    <Stack spacing={2.5} sx={{ p: 2.5 }}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' } }}>
        <TextField label="Etiqueta" value={page.label} onChange={(ev) => onChange({ label: ev.target.value })} helperText="Arriba del titular, en mayúsculas" />
        <TextField label="Titular" value={page.title} onChange={(ev) => onChange({ title: ev.target.value })} required />
      </Box>
      <TextField label="Bajada" value={page.lead} onChange={(ev) => onChange({ lead: ev.target.value })} multiline minRows={2} />
      <TextField label="Pie" value={page.footer} onChange={(ev) => onChange({ footer: ev.target.value })} helperText="Sin dirección: la tienda no tiene local abierto al público" />

      <Box>
        <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2">Botones</Typography>
          <Button size="small" startIcon={<Iconify icon="mingcute:add-line" />} onClick={() => setButtons([...page.buttons, { ...NEW_BUTTON }])}>
            Agregar botón
          </Button>
        </Box>
        <Stack spacing={1.5}>
          {page.buttons.map((b, i) => (
            <Row
              key={i}
              inline
              onUp={() => setButtons(move(page.buttons, i, -1))}
              onDown={() => setButtons(move(page.buttons, i, 1))}
              onRemove={() => setButtons(removeAt(page.buttons, i))}
            >
              <Box sx={{ flex: 1, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '2fr 3fr auto' }, alignItems: 'center' }}>
                <TextField size="small" label="Texto" value={b.label} onChange={(ev) => setButtons(setAt(page.buttons, i, { label: ev.target.value }))} required />
                <TextField
                  size="small"
                  label="Enlace"
                  value={b.url}
                  onChange={(ev) => setButtons(setAt(page.buttons, i, { url: ev.target.value.trim() }))}
                  error={!!urlError(b.url, true)}
                  helperText={urlError(b.url, true) || undefined}
                  placeholder="/catalogo · https://… · tel:+52…"
                />
                <FormControlLabel control={<Switch checked={b.primary} onChange={(ev) => setButtons(setAt(page.buttons, i, { primary: ev.target.checked }))} />} label="Relleno" />
              </Box>
            </Row>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}

function Section({ title, hint, onAdd, addLabel, addDisabled = false, children }) {
  return (
    <Card sx={{ p: 2.5 }}>
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h6">{title}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {hint}
          </Typography>
        </Box>
        <Button size="small" variant="outlined" startIcon={<Iconify icon="mingcute:add-line" />} onClick={onAdd} disabled={addDisabled} sx={{ flexShrink: 0 }}>
          {addLabel}
        </Button>
      </Box>
      <Stack spacing={1.5}>{children}</Stack>
    </Card>
  );
}

// Fila editable con controles de orden y borrar. `inline` pone los controles
// a un lado (filas cortas); si no, arriba a la derecha (bloques altos).
function Row({ inline, onUp, onDown, onRemove, children }) {
  const controls = (
    <Box sx={{ display: 'flex', flexShrink: 0 }}>
      {onUp && (
        <IconButton size="small" onClick={onUp} aria-label="Subir">
          <Iconify icon="eva:arrow-ios-upward-fill" />
        </IconButton>
      )}
      {onDown && (
        <IconButton size="small" onClick={onDown} aria-label="Bajar">
          <Iconify icon="eva:arrow-ios-downward-fill" />
        </IconButton>
      )}
      <IconButton size="small" color="error" onClick={onRemove} aria-label="Quitar">
        <Iconify icon="solar:trash-bin-trash-bold" />
      </IconButton>
    </Box>
  );
  return (
    <Box sx={{ p: 2, border: (theme) => `1px dashed ${theme.vars.palette.divider}`, borderRadius: 1.5 }}>
      {inline ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {children}
          {controls}
        </Box>
      ) : (
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: -1 }}>{controls}</Box>
          {children}
        </Stack>
      )}
    </Box>
  );
}

function Empty({ children }) {
  return (
    <Typography variant="body2" sx={{ color: 'text.disabled', py: 1 }}>
      {children}
    </Typography>
  );
}
