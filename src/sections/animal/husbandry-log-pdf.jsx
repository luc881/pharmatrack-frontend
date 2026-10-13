import barlowBold from '@fontsource/barlow/files/barlow-latin-700-normal.woff?url';
import barlowItalic from '@fontsource/barlow/files/barlow-latin-400-italic.woff?url';
import barlowRegular from '@fontsource/barlow/files/barlow-latin-400-normal.woff?url';
import { pdf, Page, Text, View, Font, Image, Document, StyleSheet } from '@react-pdf/renderer';

import axiosInstance, { endpoints } from 'src/lib/axios';

import { fedLabel, ACTIVITIES, conditionText } from './husbandry';

// ----------------------------------------------------------------------
// Historial de la bitácora en PDF: hoja horizontal, una sección por especie
// (nombre común y científico), tabla por fecha y pie con página. Respeta el
// filtro activo (especie o ejemplar); sin filtro, exporta todo.
// Barlow (la letra del dashboard) trae itálica para los nombres científicos.
// ----------------------------------------------------------------------

Font.register({
  family: 'Barlow',
  fonts: [
    { src: barlowRegular },
    { src: barlowBold, fontWeight: 700 },
    { src: barlowItalic, fontStyle: 'italic' },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

// Colores de la marca (--od-*) y de estado (los de MUI en el historial)
const C = {
  ink: '#3A3029',
  muted: '#6E6359',
  line: '#CBBFAE',
  head: '#EFE8DC',
  zebra: '#F7F3EC',
  accent: '#A8455C',
  'success.main': '#118D57',
  'warning.main': '#B76E00',
  'error.main': '#B71D18',
  'info.main': '#006C9C',
};

const COLS = [
  { key: 'date', label: 'Fecha', width: 54 },
  { key: 'who', label: 'Ejemplar', width: 70 },
  { key: 'fed', label: '¿Comió?', width: 46 },
  { key: 'food', label: 'Alimento', width: 112 },
  { key: 'supp', label: 'Suplemento', width: 72 },
  { key: 'cond', label: 'Estado', width: 64 },
  { key: 'weight', label: 'Peso', width: 40, right: true },
  { key: 'terr', label: 'Terrario', width: 86 },
  { key: 'deaths', label: 'Bajas', width: 52 },
  { key: 'notes', label: 'Notas', flex: 1 },
  { key: 'user', label: 'Anotó', width: 56 },
];

const s = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 38,
    paddingHorizontal: 28,
    fontFamily: 'Barlow',
    fontSize: 8.5,
    color: C.ink,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  logo: { width: 34, height: 34, marginRight: 10 },
  title: { fontSize: 18, fontWeight: 700 },
  subtitle: { fontSize: 9, color: C.muted, marginTop: 2 },
  generated: { marginLeft: 'auto', textAlign: 'right', fontSize: 8, color: C.muted },
  stats: {
    flexDirection: 'row',
    borderTop: `1 solid ${C.line}`,
    borderBottom: `1 solid ${C.line}`,
    marginBottom: 16,
  },
  stat: { flex: 1, paddingVertical: 7, paddingHorizontal: 8, borderRight: `1 solid ${C.line}` },
  statLabel: { fontSize: 7, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 },
  statValue: { fontSize: 13, fontWeight: 700, marginTop: 2 },
  species: { marginBottom: 14 },
  speciesHead: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 5 },
  speciesName: { fontSize: 12, fontWeight: 700 },
  speciesSci: { fontSize: 10, fontStyle: 'italic', color: C.muted, marginLeft: 6 },
  speciesCount: { fontSize: 8, color: C.muted, marginLeft: 'auto' },
  row: { flexDirection: 'row', borderBottom: `0.5 solid ${C.line}` },
  th: {
    backgroundColor: C.head,
    fontWeight: 700,
    fontSize: 7.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cell: { paddingVertical: 4, paddingHorizontal: 4 },
  small: { fontSize: 7, color: C.muted },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 28,
    right: 28,
    flexDirection: 'row',
    fontSize: 7.5,
    color: C.muted,
  },
});

const fDay = (d) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

// "Rhacodactylus Auriculatus" → "Rhacodactylus auriculatus" (el epíteto va en
// minúscula; la localidad entre comillas se deja igual)
const sciName = (name = '') =>
  name.replace(/^(\S+)\s+([^\s"“]+)/, (_, g, e) => `${g} ${e.toLowerCase()}`);

const num = (v) => (v == null ? null : Number(v));

function cells(log) {
  const fed = fedLabel(log);
  const food = [
    log.food_type,
    log.pieces != null && `${log.pieces} pza${log.pieces === 1 ? '' : 's'}`,
    log.grams != null && `${num(log.grams)} g`,
  ]
    .filter(Boolean)
    .join(' · ');
  const notes = [
    log.feeding_notes,
    log.notes,
    log.photos?.length && `(${log.photos.length} foto${log.photos.length === 1 ? '' : 's'})`,
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    date: fDay(log.log_date),
    who: log.animal_code ?? 'Toda la especie',
    whoSub: log.morph_name,
    fed: fed?.label ?? '',
    fedColor: fed ? C[fed.color] : undefined,
    food,
    supp: log.supplement ?? '',
    cond: conditionText(log),
    condColor: log.condition === 'lethargic' ? C['warning.main'] : undefined,
    weight: log.weight_g != null ? `${num(log.weight_g)} g` : '',
    terr: (log.activities ?? [])
      .filter((a) => a !== 'deaths')
      .map((a) => ACTIVITIES[a] ?? a)
      .join(', '),
    deaths: log.deaths ? String(log.deaths) : '',
    deathsSub: log.replacement_code && `cambio: ${log.replacement_code}`,
    notes,
    user: log.user_name ?? '',
  };
}

const colStyle = (c) => [
  s.cell,
  c.flex ? { flex: c.flex } : { width: c.width },
  c.right && { textAlign: 'right' },
];

function SpeciesTable({ group }) {
  return (
    <View style={s.species}>
      {/* el encabezado de la especie no se queda solo al final de una página */}
      <View style={s.speciesHead} minPresenceAhead={60}>
        <Text style={s.speciesName}>{group.common || group.sci}</Text>
        {group.common && <Text style={s.speciesSci}>{group.sci}</Text>}
        <Text style={s.speciesCount}>
          {group.logs.length} entrada{group.logs.length === 1 ? '' : 's'}
        </Text>
      </View>
      <View style={[s.row, s.th]} fixed>
        {COLS.map((c) => (
          <Text key={c.key} style={colStyle(c)}>
            {c.label}
          </Text>
        ))}
      </View>
      {group.logs.map((log, i) => {
        const v = cells(log);
        return (
          <View
            key={log.id}
            style={[s.row, i % 2 === 1 && { backgroundColor: C.zebra }]}
            wrap={false}
          >
            {COLS.map((c) => {
              if (c.key === 'deaths' && v.deathsSub) {
                return (
                  <View key={c.key} style={colStyle(c)}>
                    <Text style={{ color: C['error.main'], fontWeight: 700 }}>{v.deaths}</Text>
                    <Text style={s.small}>{v.deathsSub}</Text>
                  </View>
                );
              }
              if (c.key === 'who') {
                return (
                  <View key={c.key} style={colStyle(c)}>
                    <Text
                      style={{
                        fontWeight: log.animal_code ? 700 : 400,
                        color: log.animal_code ? C.ink : C.muted,
                      }}
                    >
                      {v.who}
                    </Text>
                    {v.whoSub && <Text style={s.small}>{v.whoSub}</Text>}
                  </View>
                );
              }
              const color = {
                fed: v.fedColor,
                cond: v.condColor,
                deaths: v.deaths ? C['error.main'] : undefined,
              }[c.key];
              return (
                <Text key={c.key} style={[...colStyle(c), color && { color, fontWeight: 700 }]}>
                  {v[c.key]}
                </Text>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function HusbandryLogDocument({ logs, scope, generatedAt }) {
  // Una sección por especie, en orden alfabético; dentro, lo más reciente arriba
  const bySpecies = new Map();
  logs.forEach((log) => {
    if (!bySpecies.has(log.species_id)) {
      bySpecies.set(log.species_id, {
        common: log.species_common_name,
        sci: sciName(log.species_name),
        logs: [],
      });
    }
    bySpecies.get(log.species_id).logs.push(log);
  });
  const groups = [...bySpecies.values()].sort((a, b) =>
    (a.common || a.sci).localeCompare(b.common || b.sci, 'es')
  );
  const dates = logs.map((l) => l.log_date).sort();
  const stats = [
    {
      label: 'Periodo',
      value: dates.length ? `${fDay(dates[0])} – ${fDay(dates[dates.length - 1])}` : '—',
    },
    { label: 'Entradas', value: logs.length },
    { label: 'Especies', value: groups.length },
    { label: 'Comidas', value: logs.filter((l) => l.fed).length },
    { label: 'Bajas', value: logs.reduce((n, l) => n + (l.deaths || 0), 0) },
  ];

  return (
    <Document title={`Bitácora de manejo — ${scope}`} author="Opuntia Den">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header}>
          <Image style={s.logo} src="/brand/assets/favicon/favicon-192-claro.png" />
          <View>
            <Text style={s.title}>Bitácora de manejo</Text>
            <Text style={s.subtitle}>Opuntia Den · {scope}</Text>
          </View>
          <Text style={s.generated}>Generado el {generatedAt}</Text>
        </View>

        <View style={s.stats}>
          {stats.map((st, i) => (
            <View
              key={st.label}
              style={[s.stat, i === 0 && { flex: 2 }, i === stats.length - 1 && { borderRight: 0 }]}
            >
              <Text style={s.statLabel}>{st.label}</Text>
              <Text style={s.statValue}>{st.value}</Text>
            </View>
          ))}
        </View>

        {groups.map((g) => (
          <SpeciesTable key={g.sci} group={g} />
        ))}
        {!logs.length && <Text style={{ color: C.muted }}>Sin entradas.</Text>}

        <View style={s.footer} fixed>
          <Text>Opuntia Den · Bitácora de manejo · {scope}</Text>
          <Text
            style={{ marginLeft: 'auto' }}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

// ----------------------------------------------------------------------

// Trae todas las páginas del historial con el filtro activo
async function fetchAllLogs(params) {
  const all = [];
  for (let page = 1; ; page += 1) {
    const { data } = await axiosInstance.get(endpoints.husbandryLog.list, {
      params: { ...params, page, page_size: 500 },
    });
    all.push(...(data.data ?? []));
    if (page >= (data.total_pages ?? 1)) return all;
  }
}

const slug = (t) =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Genera y descarga el PDF. Se importa al hacer clic (import dinámico):
// react-pdf pesa y no debe cargarse con la bitácora.
// speciesId / animal ({id, code}): el filtro del historial; scope: cómo se
// describe en el PDF ("Todas las especies", "Gecko Gárgola", "Ejemplar RAU-001")
export async function exportHusbandryLogPdf({ speciesId, animal, scope }) {
  const logs = await fetchAllLogs({
    ...(speciesId ? { species_id: speciesId } : {}),
    ...(animal ? { animal_id: animal.id } : {}),
  });
  const today = new Date();
  const generatedAt = today.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const blob = await pdf(
    <HusbandryLogDocument logs={logs} scope={scope} generatedAt={generatedAt} />
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bitacora-${slug(scope)}-${today.toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
