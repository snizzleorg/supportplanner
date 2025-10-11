/**
 * DOM Element References
 * 
 * Centralized DOM element references for the application.
 * All elements are queried once on module load for performance.
 * 
 * @module dom
 */

// Modal elements
export const modal = document.getElementById('eventModal');
export const modalContent = document.querySelector('#eventModal .modal-content');
export const eventForm = document.getElementById('eventForm');
export const closeBtn = document.querySelector('.close-btn');
export const cancelBtn = document.getElementById('cancelEdit');
export const saveBtn = document.getElementById('saveEvent');
export const deleteBtn = document.getElementById('deleteEvent');

// Form inputs - Event details
export const eventIdInput = document.getElementById('eventId');
export const eventTitleInput = document.getElementById('eventTitle');
export const eventStartDateInput = document.getElementById('eventStartDate');
export const eventEndDateInput = document.getElementById('eventEndDate');
export const eventAllDayInput = document.getElementById('eventAllDay');
export const eventDescriptionInput = document.getElementById('eventDescription');
export const eventLocationInput = document.getElementById('eventLocation');
export const eventCalendarSelect = document.getElementById('eventCalendar');

// Form inputs - Structured metadata
export const eventOrderNumberInput = document.getElementById('eventOrderNumber');
export const eventTicketLinkInput = document.getElementById('eventTicketLink');
export const eventSystemTypeInput = document.getElementById('eventSystemType');
export const eventLocationHelp = document.getElementById('eventLocationHelp');

// Status and display elements
export const statusEl = document.getElementById('status');
export const fromEl = document.getElementById('fromDate');
export const toEl = document.getElementById('toDate');
export const fromDateDisplay = document.getElementById('fromDateDisplay');
export const toDateDisplay = document.getElementById('toDateDisplay');

// Control buttons
export const refreshBtn = document.getElementById('refreshBtn');
export const fitBtn = document.getElementById('fitBtn');
export const todayBtn = document.getElementById('todayBtn');
export const monthViewBtn = document.getElementById('monthViewBtn');
export const quarterViewBtn = document.getElementById('quarterViewBtn');
export const zoomInBtn = document.getElementById('zoomInBtn');
export const zoomOutBtn = document.getElementById('zoomOutBtn');
export const showRangeBtn = document.getElementById('showRangeBtn');

// Search elements
export const searchBox = document.getElementById('searchBox');
export const clearSearchBtn = document.getElementById('clearSearch');

// Timeline and map
export const timelineEl = document.getElementById('timeline');

// User authentication
export const userInfoEl = document.getElementById('userInfo');
export const logoutBtn = document.getElementById('logoutBtn');

// Mobile UI elements
export const filtersToggleBtn = document.getElementById('filtersToggle');
export const mapToggleBtn = document.getElementById('mapToggle');
export const mobileBackdrop = document.getElementById('mobileBackdrop');
