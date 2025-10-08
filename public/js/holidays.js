// Holidays helper module
// Fetches German (Berlin) public holidays and filters them by range

import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.13/+esm';

const holidaysCache = new Map(); // year -> holidays array

async function getHolidaysForYear(year) {
  if (holidaysCache.has(year)) return holidaysCache.get(year);
  try {
    const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/DE`);
    if (!response.ok) throw new Error('Failed to fetch holidays');
    const holidays = await response.json();
    // Filter for Berlin-specific holidays (Germany + Berlin state holidays)
    const berlinHolidays = holidays.filter(h => !h.counties || h.counties.includes('DE-BE'));
    holidaysCache.set(year, berlinHolidays);
    return berlinHolidays;
  } catch (e) {
    console.error('Error fetching holidays:', e);
    return [];
  }
}

export async function getHolidaysInRange(start, end) {
  const startYear = dayjs(start).year();
  const endYear = dayjs(end).year();
  const allHolidays = [];
  try {
    for (let year = startYear; year <= endYear; year++) {
      const holidays = await getHolidaysForYear(year);
      if (holidays && Array.isArray(holidays)) allHolidays.push(...holidays);
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    return allHolidays
      .filter(h => h && h.date && h.localName)
      .map(h => ({
        date: new Date(h.date),
        name: h.localName,
        global: !h.counties
      }))
      .filter(h => h.date >= startDate && h.date <= endDate);
  } catch (e) {
    console.error('Error in getHolidaysInRange:', e);
    return [];
  }
}
