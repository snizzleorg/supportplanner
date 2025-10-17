/**
 * DOM Element References
 * 
 * Centralized DOM element references for the application.
 * All elements are queried once on module load for performance.
 * 
 * Note: All exports are HTMLElement references or null if element doesn't exist.
 * Elements are grouped by functional area for better organization.
 * 
 * @module dom
 */

// Modal elements
/** @type {HTMLElement|null} Event modal container */
export const modal = document.getElementById('eventModal');
/** @type {HTMLElement|null} Modal content wrapper */
export const modalContent = document.querySelector('#eventModal .modal-content');
/** @type {HTMLFormElement|null} Event form element */
export const eventForm = document.getElementById('eventForm');
/** @type {HTMLElement|null} Modal close button */
export const closeBtn = document.querySelector('.close-btn');
/** @type {HTMLButtonElement|null} Cancel edit button */
export const cancelBtn = document.getElementById('cancelEdit');
/** @type {HTMLButtonElement|null} Save event button */
export const saveBtn = document.getElementById('saveEvent');
/** @type {HTMLButtonElement|null} Delete event button */
export const deleteBtn = document.getElementById('deleteEvent');

// Form inputs - Event details
/** @type {HTMLInputElement|null} Event ID (UID) input */
export const eventIdInput = document.getElementById('eventId');
/** @type {HTMLInputElement|null} Event title input */
export const eventTitleInput = document.getElementById('eventTitle');
/** @type {HTMLInputElement|null} Event start date input */
export const eventStartDateInput = document.getElementById('eventStartDate');
/** @type {HTMLInputElement|null} Event end date input */
export const eventEndDateInput = document.getElementById('eventEndDate');
/** @type {HTMLInputElement|null} All-day event checkbox */
export const eventAllDayInput = document.getElementById('eventAllDay');
/** @type {HTMLTextAreaElement|null} Event description textarea */
export const eventDescriptionInput = document.getElementById('eventDescription');
/** @type {HTMLInputElement|null} Event location input */
export const eventLocationInput = document.getElementById('eventLocation');
/** @type {HTMLSelectElement|null} Calendar selection dropdown */
export const eventCalendarSelect = document.getElementById('eventCalendar');

// Form inputs - Structured metadata
/** @type {HTMLInputElement|null} Order number input */
export const eventOrderNumberInput = document.getElementById('eventOrderNumber');
/** @type {HTMLInputElement|null} Ticket link input */
export const eventTicketLinkInput = document.getElementById('eventTicketLink');
/** @type {HTMLInputElement|null} System type input */
export const eventSystemTypeInput = document.getElementById('eventSystemType');
/** @type {HTMLElement|null} Location validation help text */
export const eventLocationHelp = document.getElementById('eventLocationHelp');

// Status and display elements
/** @type {HTMLElement|null} Status message display */
export const statusEl = document.getElementById('status');
/** @type {HTMLInputElement|null} Date range from input */
export const fromEl = document.getElementById('fromDate');
/** @type {HTMLInputElement|null} Date range to input */
export const toEl = document.getElementById('toDate');
/** @type {HTMLElement|null} From date display (formatted) */
export const fromDateDisplay = document.getElementById('fromDateDisplay');
/** @type {HTMLElement|null} To date display (formatted) */
export const toDateDisplay = document.getElementById('toDateDisplay');

// Control buttons
/** @type {HTMLButtonElement|null} Refresh data button */
export const refreshBtn = document.getElementById('refreshBtn');
/** @type {HTMLButtonElement|null} Fit timeline to content button */
export const fitBtn = document.getElementById('fitBtn');
/** @type {HTMLButtonElement|null} Jump to today button */
export const todayBtn = document.getElementById('todayBtn');
/** @type {HTMLButtonElement|null} Month view button */
export const monthViewBtn = document.getElementById('monthViewBtn');
/** @type {HTMLButtonElement|null} Quarter view button */
export const quarterViewBtn = document.getElementById('quarterViewBtn');
/** @type {HTMLButtonElement|null} Zoom in button */
export const zoomInBtn = document.getElementById('zoomInBtn');
/** @type {HTMLButtonElement|null} Zoom out button */
export const zoomOutBtn = document.getElementById('zoomOutBtn');
/** @type {HTMLButtonElement|null} Show date range button */
export const showRangeBtn = document.getElementById('showRangeBtn');

// Search elements
/** @type {HTMLInputElement|null} Search input box */
export const searchBox = document.getElementById('searchBox');
/** @type {HTMLButtonElement|null} Clear search button */
export const clearSearchBtn = document.getElementById('clearSearch');

// Timeline and map
/** @type {HTMLElement|null} Timeline container element */
export const timelineEl = document.getElementById('timeline');

// User authentication
/** @type {HTMLElement|null} User info display */
export const userInfoEl = document.getElementById('userInfo');
/** @type {HTMLButtonElement|null} Logout button */
export const logoutBtn = document.getElementById('logoutBtn');

// Mobile UI elements
/** @type {HTMLButtonElement|null} Filters panel toggle button */
export const filtersToggleBtn = document.getElementById('filtersToggle');
/** @type {HTMLButtonElement|null} Map panel toggle button */
export const mapToggleBtn = document.getElementById('mapToggle');
/** @type {HTMLElement|null} Mobile backdrop overlay */
export const mobileBackdrop = document.getElementById('mobileBackdrop');
