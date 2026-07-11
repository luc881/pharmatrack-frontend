export const SEX_OPTIONS = [
  { value: 'male', label: 'Macho' },
  { value: 'female', label: 'Hembra' },
  { value: 'unknown', label: 'Desconocido' },
];

export const SEX_LABELS = { male: 'Macho', female: 'Hembra', unknown: 'Desconocido' };

export const STATUS_LABELS = { available: 'Disponible', reserved: 'Reservado', sold: 'Vendido' };

export const STATUS_COLORS = { available: 'success', reserved: 'warning', sold: 'default' };

// "Ball Python (Python regius)" o "Python regius" si no hay nombre común
export function speciesLabel(species) {
  if (!species) return '';
  const scientific = [species.genus?.name, species.name].filter(Boolean).join(' ');
  return species.common_name ? `${species.common_name} (${scientific})` : scientific;
}
