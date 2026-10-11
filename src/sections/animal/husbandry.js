// ----------------------------------------------------------------------
// Etiquetas y ayudas de la bitácora / plan de manejo, compartidas por la
// bitácora y la ficha de especie.
// ----------------------------------------------------------------------

export const APPETITE = {
  good: { label: 'Bien', color: 'success' },
  regular: { label: 'Regular', color: 'info' },
  poor: { label: 'Poco', color: 'warning' },
  refused: { label: 'No comió', color: 'error' },
};

// "deaths" se marca solo al anotar bajas (no es chip)
export const ACTIVITIES = {
  misted: 'Rociado',
  cleaned: 'Limpieza',
  substrate: 'Cambio de sustrato',
  molt: 'Muda',
  eggs: 'Puesta / ootecas',
  births: 'Nacimientos',
  deaths: 'Bajas',
};

export const PLAN_KIND = {
  food: { label: 'Comida', color: 'primary' },
  supplement: { label: 'Suplemento', color: 'secondary' },
};

// Sugerencias; se puede escribir cualquier otro
export const FOODS = [
  'Grillos',
  'Cucarachas dubia',
  'Tenebrios',
  'Gusano de seda',
  'Papilla',
  'Fruta',
  'Verdura',
  'Hojas',
  'Hojarasca',
  'Croqueta',
];

export const SUPPLEMENTS = [
  'Calcio',
  'Calcio con D3',
  'Multivitamínico',
  'Hueso de jibia',
  'Levadura de cerveza',
  'Espirulina',
  'Polen',
];

// Opciones del plan de la especie primero, luego las sugerencias
export const planOptions = (species, kind, base) => {
  const own = (species?.husbandry_plan ?? []).filter((p) => p.kind === kind).map((p) => p.name);
  return [...new Set([...own, ...base])];
};

export const fDate = (d) =>
  new Date(`${d}T12:00:00`).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

export const dueLabel = (daysOverdue) => {
  if (daysOverdue > 0) return { label: `Atrasado ${daysOverdue} d`, color: 'error' };
  if (daysOverdue === 0) return { label: 'Toca hoy', color: 'warning' };
  if (daysOverdue === -1) return { label: 'Mañana', color: 'default' };
  return { label: `En ${-daysOverdue} días`, color: 'default' };
};
