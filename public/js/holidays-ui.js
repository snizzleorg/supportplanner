// Helpers to manage holiday background items on the timeline
// Usage: upsertHolidayBackgrounds(items, from, to, getHolidaysInRange, dayjs)
// - items: vis DataSet-like with get(), getIds(filter?), add(), remove()
// - from/to: YYYY-MM-DD strings defining the window
// - getHolidaysInRange: async (from, to) => [{ date: 'YYYY-MM-DD', name: 'Holiday' }, ...]
// - dayjs: dayjs instance

export async function upsertHolidayBackgrounds(items, from, to, getHolidaysInRange, dayjs) {
  if (!items || !getHolidaysInRange || !dayjs) return;

  // Remove existing holiday-* items to avoid duplicate IDs
  try {
    const ids = typeof items.getIds === 'function'
      ? items.getIds({ filter: (it) => typeof it?.id === 'string' && it.id.startsWith('holiday-') })
      : (items.get() || []).filter(it => typeof it?.id === 'string' && it.id.startsWith('holiday-')).map(it => it.id);
    if (ids && ids.length) items.remove(ids);
  } catch (_) {
    // ignore cleanup errors
  }

  // Fetch holidays in range
  const holidays = await getHolidaysInRange(from, to);
  if (!holidays || !holidays.length) return;

  const holidayItems = [];
  holidays.forEach(holiday => {
    const startDate = dayjs(holiday.date).startOf('day');
    const endDate = startDate.add(1, 'day');
    holidayItems.push({
      id: `holiday-${startDate.format('YYYY-MM-DD')}`,
      start: startDate.toDate(),
      end: endDate.toDate(),
      type: 'background',
      className: 'holiday-bg',
      title: holiday.name,
      editable: false,
      selectable: false
    });
  });

  if (holidayItems.length) items.add(holidayItems);
}
