export const SEX_OPTIONS = [
  { value: 'male', label: 'Macho' },
  { value: 'female', label: 'Hembra' },
  { value: 'unknown', label: 'Desconocido' },
];

export const SEX_LABELS = { male: 'Macho', female: 'Hembra', unknown: 'Desconocido' };

export const STATUS_LABELS = {
  available: 'Disponible',
  reserved: 'Reservado',
  sold: 'Vendido',
  deceased: 'Murió',
};

export const STATUS_COLORS = {
  available: 'success',
  reserved: 'warning',
  sold: 'default',
  deceased: 'error',
};

// Vendido o muerto: ya no está a la venta ni en tu cuidado. No se borra ni se
// cambia su estado a mano (los pone la venta o la baja en la bitácora).
export const isClosedStatus = (status) => status === 'sold' || status === 'deceased';

// help: qué significa cada formato, a la vista al elegirlo
export const SALE_FORMAT_OPTIONS = [
  {
    value: 'individual',
    label: 'Individual',
    help: 'Cada animal es único, con su propio código, sexo, fotos y bitácora (reptiles, tarántulas). En la venta rápida eliges el ejemplar exacto.',
  },
  {
    value: 'package',
    label: 'Paquete de N',
    help: 'Se vende en paquetes con varios animales iguales (isópodos ×6). Un solo registro con cuántos paquetes hay.',
  },
  {
    value: 'colony',
    label: 'Cepa / colonia',
    help: 'Se vende una colonia o cultivo completo, sin contar animales (colémbolos).',
  },
  {
    value: 'piece',
    label: 'Por pieza',
    help: 'Animales iguales que se venden de uno en uno sin distinguirlos (insecto hoja, mantis). Un lote con cantidad por variedad y sexo (sin sexar, hembras, machos); no llevan código propio.',
  },
];

// En «Por pieza» el sexo separa lotes: sin sexar (crías), hembras y machos
export const PIECE_SEX_OPTIONS = [
  { value: 'unknown', label: 'Sin sexar' },
  { value: 'female', label: 'Hembra' },
  { value: 'male', label: 'Macho' },
];
export const isPieceSpecies = (species) => species?.sale_format === 'piece';

// "Paquete de 6" / "Cepa" / null para individual
export function saleFormatLabel(species) {
  if (species?.sale_format === 'package') return `Paquete de ${species.package_size}`;
  if (species?.sale_format === 'colony') return 'Cepa';
  if (species?.sale_format === 'piece') return 'Por pieza';
  return null;
}

// Aplana el árbol de grupos en orden jerárquico, con depth (para sangría)
// y ancestors (para excluir descendientes al elegir padre)
export function flattenGroupTree(nodes = [], depth = 0, ancestors = []) {
  return nodes.flatMap((node) => [
    { ...node, depth, ancestors },
    ...flattenGroupTree(node.children ?? [], depth + 1, [...ancestors, node.id]),
  ]);
}

// "Ball Python (Python regius)" o "Python regius" si no hay nombre común
export function speciesLabel(species) {
  if (!species) return '';
  const scientific = [species.genus?.name, species.name].filter(Boolean).join(' ');
  return species.common_name ? `${species.common_name} (${scientific})` : scientific;
}

// ----------------------------------------------------------------------
// Destino del animal: en venta / pie de cría / en crianza
// ----------------------------------------------------------------------

export const PURPOSES = ['sale', 'breeder', 'growing'];

export const PURPOSE_LABELS = { sale: 'En venta', breeder: 'Pie de cría', growing: 'En crianza' };

export const PURPOSE_COLORS = { sale: 'success', breeder: 'info', growing: 'warning' };

export const PURPOSE_HELP = {
  sale: 'Aparece en la tienda y en el POS.',
  breeder: 'Reproductores; no se venden.',
  growing: 'Crías o cultivo que todavía no salen a la venta.',
};

// Respuestas viejas de la API no traen purpose: eran de venta
export const purposeOf = (animal) => animal?.purpose ?? 'sale';

// Unidades contadas en animales (un paquete en venta = package_size animales)
export function animalUnits(animal, species) {
  if (isClosedStatus(animal.status)) return 0;
  const stock = Number(animal.stock ?? 0);
  if (species?.sale_format === 'colony' || species?.sale_format === 'piece') return stock;
  if (species?.sale_format === 'package') {
    return purposeOf(animal) === 'sale' ? stock * Number(species.package_size ?? 1) : stock;
  }
  return 1;
}

export function countByPurpose(animals, speciesById = {}) {
  const out = { sale: 0, breeder: 0, growing: 0, reserved: 0, salePackages: 0 };
  animals.forEach((a) => {
    if (a.status !== 'available' && a.status !== 'reserved') return;
    const species = speciesById[a.species_id] ?? a.species;
    const purpose = purposeOf(a);
    out[purpose] += animalUnits(a, species);
    // apartados en la misma unidad que la tarjeta (animales, no registros)
    if (a.status === 'reserved') out.reserved += animalUnits(a, species);
    if (purpose === 'sale' && species?.sale_format === 'package') {
      out.salePackages += Number(a.stock ?? 0);
    }
  });
  return out;
}

export function statusLabel(animal) {
  const bulk = animal.species?.sale_format && animal.species.sale_format !== 'individual';
  // Vacío primero: un «Mover a… → Todos» deja el registro de origen en 0, sea del destino que sea
  if (animal.status === 'available' && bulk && Number(animal.stock) === 0) return 'Vacío';
  if (animal.status === 'available' && purposeOf(animal) !== 'sale') return 'Activo';
  return STATUS_LABELS[animal.status];
}

export function moveBlockReason(animal) {
  if (animal.status === 'available') return null;
  if (animal.status === 'reserved') return 'Primero libera el apartado';
  return 'Ya no está en tu criadero';
}

// ----------------------------------------------------------------------
// Foto que se muestra de un ejemplar: la propia; si no tiene, la de su
// variedad; si no, la de su especie (las de especie y variedad, editadas en
// «Especies y morphs», son la fuente de verdad). Mismo orden que el API.
export function displayImage(animal, species = animal?.species) {
  const own = animal?.image || animal?.photos?.[0];
  if (own) return own;
  const variety = (animal?.morphs ?? []).find((m) => m.image)?.image;
  return variety || species?.image || '';
}

// Por qué un ejemplar marcado «Mostrar en el sitio» no se ve en la tienda (el
// mismo criterio que el API): la forma nominal depende de su especie y una
// variedad de sus morphs; un grupo oculto esconde todo. null = sí se ve.
export function siteBlocker({ species, morphs = [], groupHidden = false }) {
  if (groupHidden) return 'Su grupo está oculto en el sitio';
  if (!morphs.length) {
    return species?.show_public === false ? 'Su especie está apagada en el sitio' : null;
  }
  const off = morphs.find((m) => m?.show_public === false);
  return off ? `La variedad ${off.name} está apagada en el sitio` : null;
}
