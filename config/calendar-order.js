/**
 * Calendar Order Configuration
 * 
 * This file defines the order in which calendars should be displayed in the UI.
 * The order is determined by the position of calendar URLs in the array.
 * Calendars not listed here will appear after the configured ones in alphabetical order.
 */

// Array of calendar URLs in the desired display order
const calendarOrder = [
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_strauch/',
  
  
  
  

  
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_subhrokolighosh/',
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_batalov/',
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_buschmann/',
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_subhabrataghosh/',
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_luna/',
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_doerr/',
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_lan/',
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_ruettinger/',
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_oschulz/',
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_lira/'
];

// Human-readable names for each calendar (optional, for reference)
const calendarNames = {
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_strauch/': 'Melanie Strauch',
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_ruettinger/': 'Steffen Ruettinger',
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_doerr/': 'Denis Doerr',
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_lan/': 'Chenyang Lan',
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_subhabrataghosh/': 'Subhabrata Ghosh',
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_oschulz/': 'Olaf Schulz',
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_lira/': 'Angel Oliveira-Lira',
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_luna/': 'Jorge Rodrigo Luna Piedra',
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_subhrokolighosh/': 'Subhrokoli Ghosh',
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_batalov/': 'Anton Batalov',
  'https://nc.picoquant.com/remote.php/dav/calendars/support/travel_shared_by_buschmann/': 'Volker Buschmann'
};

export { calendarOrder, calendarNames };
