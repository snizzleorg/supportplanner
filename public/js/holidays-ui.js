/**
 * Holiday UI Module
 * 
 * Manages holiday background items on the timeline.
 * Creates visual indicators for public holidays.
 * 
 * @module holidays-ui
 */

/**
 * Updates or inserts holiday background items on the timeline
 * Removes existing holiday backgrounds and adds new ones for the specified date range
 * 
 * @param {Object} items - vis-timeline DataSet with get(), getIds(), add(), remove() methods
 * @param {string} from - Start date in YYYY-MM-DD format
 * @param {string} to - End date in YYYY-MM-DD format
 * @param {Function} getHolidaysInRange - Async function to fetch holidays: (from, to) => Promise<Array>
 * @param {Object} dayjs - Day.js instance for date manipulation
 * @returns {Promise<void>}
 */
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
