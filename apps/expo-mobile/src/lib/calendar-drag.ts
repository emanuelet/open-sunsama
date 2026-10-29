/** Snap a calendar drag to 15-minute intervals while keeping it within the day. */
export function calendarDragOffset(startMinutes: number, durationMinutes: number, translationY: number, hourHeight: number): number {
  const candidate = Math.round((startMinutes + translationY / hourHeight * 60) / 15) * 15;
  const maxStart = Math.max(0, 1440 - Math.ceil(durationMinutes));
  return Math.min(maxStart, Math.max(0, candidate)) - startMinutes;
}
