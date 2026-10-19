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

export const SALE_FORMAT_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'package', label: 'Paquete de N' },
  { value: 'colony', label: 'Cepa / colonia' },
];

// "Paquete de 6" / "Cepa" / null para individual
export function saleFormatLabel(species) {
  if (species?.sale_format === 'package') return `Paquete de ${species.package_size}`;
  if (species?.sale_format === 'colony') return 'Cepa';
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
  if (species?.sale_format === 'colony') return stock;
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
