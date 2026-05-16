/** Nota F5 / F11 con exactamente 2 decimales y coma decimal (es-AR). */
export function formatRating(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
