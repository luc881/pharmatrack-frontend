import { fCurrency } from 'src/utils/format-number';

// ----------------------------------------------------------------------

// Al entregar algo sin pagar, lo normal es que paguen ahí mismo: se pregunta
// una vez. → true (ya pagó) | false (queda «Por cobrar») | null (no entregar)
export async function askPaid(ask, d) {
  if (d.paid || !(Number(d.amount) > 0)) return false;
  const answer = await ask({
    title: `¿${d.buyer_name} ya te pagó ${fCurrency(d.amount)}?`,
    content: 'Si todavía no, la entrega queda «Por cobrar».',
    options: [
      { label: 'No, por cobrar', value: 'no', variant: 'outlined', color: 'warning' },
      { label: 'Sí, ya pagó', value: 'yes', color: 'success' },
    ],
  });
  return answer === null ? null : answer === 'yes';
}
