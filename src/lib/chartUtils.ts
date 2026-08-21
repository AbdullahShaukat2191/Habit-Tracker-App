// Rounds a data range's max value up to a clean axis ceiling
// (e.g. 47 -> 50, 1234 -> 1300), for chart Y-axis gridlines.
export function getAxisMax(values: number[]): number {
  const maxValue = Math.max(1, ...values)
  const step = Math.pow(10, Math.max(0, Math.floor(Math.log10(maxValue)) - 1))
  return Math.ceil(maxValue / step) * step || 1
}
