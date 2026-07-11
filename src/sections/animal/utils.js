export const SEX_OPTIONS = [
  { value: 'male', label: 'Macho' },
  { value: 'female', label: 'Hembra' },
  { value: 'unknown', label: 'Desconocido' },
];

export const SEX_LABELS = { male: 'Macho', female: 'Hembra', unknown: 'Desconocido' };

export const STATUS_LABELS = { available: 'Disponible', reserved: 'Reservado', sold: 'Vendido' };

export const STATUS_COLORS = { available: 'success', reserved: 'warning', sold: 'default' };

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
