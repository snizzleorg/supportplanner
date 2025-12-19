/**
 * Search and Filter Module
 * 
 * Handles search functionality for timeline items and groups.
 * Implements DOM-based dimming/highlighting for search results.
 * 
 * @module search
 */

/**
 * Reference to timeline items DataSet
 * @type {Object|null}
 */
let itemsRef = null;

/**
 * Reference to timeline groups DataSet
 * @type {Object|null}
 */
let groupsRef = null;

/**
 * Current search query
 * @type {string}
 */
export let currentSearch = '';

/**
 * Checks if an item matches the search query
 * @private
 * @param {Object} item - Timeline item to check
 * @param {string} q - Search query (lowercase)
 * @returns {boolean} True if item matches query
 */
function itemMatchesQuery(item, q) {
  if (!q) return true;
  
  const hay = [item.content, item.title, item.description, item.location, item.calendarName, item.calendarUrl];
  const meta = item.meta || {};
  hay.push(meta.orderNumber, meta.systemType, meta.ticketLink, meta.locationCountry, meta.locationCountryCode, meta.locationCity);
  // Also include calendar name and url via group lookup
  try {
    if (groupsRef && item && item.group) {
      const g = groupsRef.get(item.group);
      if (g) {
        hay.push(g.content); // calendar display name
        if (g.displayName) hay.push(g.displayName);
        if (g.calendarUrl) hay.push(g.calendarUrl);
        if (g.url) hay.push(g.url);
      }
    }
  } catch (_) {}
  return hay.filter(Boolean).some(v => String(v).toLowerCase().includes(q));
}

/**
 * Applies the current search filter to timeline items
 * Dims non-matching items and highlights matching ones
 * @returns {void}
 */
export function applySearchFilter() {
  const q = (currentSearch || '').trim().toLowerCase();
  try {
    // Pre-compute matching groups (calendars) by name/url when a query is present
    let matchingGroupIds = null;
    let idToGroupId = null;
    if (q && groupsRef) {
      try {
        const allGroups = groupsRef.get(); // array of all groups
        matchingGroupIds = new Set(
          allGroups
            .filter(g => {
              const hay = [g.content, g.displayName, g.calendarUrl, g.url]
                .filter(Boolean)
                .map(v => String(v).toLowerCase());
              return hay.some(s => s.includes(q));
            })
            .map(g => g.id)
        );
      } catch (_) { matchingGroupIds = null; }
    }
    // Also consider the visible label text in the DOM (left calendar column)
    if (q) {
      try {
        const labelNodes = document.querySelectorAll('.vis-timeline .vis-labelset .vis-label');
        labelNodes.forEach(node => {
          const text = (node.textContent || '').toLowerCase();
          const gid = node.getAttribute('data-groupid') || node.getAttribute('data-group');
          if (text && text.includes(q) && gid) {
            if (!matchingGroupIds) matchingGroupIds = new Set();
            matchingGroupIds.add(gid);
          }
        });
      } catch (_) { /* ignore */ }
    }
    if (q && itemsRef) {
      try {
        idToGroupId = new Map();
        const allItems = itemsRef.get();
        // Map item id (string) -> group id as used by vis-timeline dataset
        allItems.forEach(it => {
          if (!it) return;
          const key = String(it.id);
          const gid = it.group != null ? String(it.group) : null;
          if (gid) idToGroupId.set(key, gid);
        });
      } catch (_) { idToGroupId = null; }
    }

    const els = document.querySelectorAll('.vis-timeline .vis-item');
    if (q) {
      try {
        console.debug('[search] query:', q, {
          matchingGroupIds: matchingGroupIds ? Array.from(matchingGroupIds) : null,
          totalGroups: groupsRef ? groupsRef.length || (groupsRef.get && groupsRef.get().length) : null,
          totalItems: itemsRef ? (itemsRef.length || (itemsRef.get && itemsRef.get().length)) : null
        });
      } catch (_) {}
    }
    els.forEach(el => {
      const id = el.getAttribute('data-id');
      let groupId = el.getAttribute('data-group') || el.getAttribute('data-groupid');
      // Fallback #1: read from class list like `group-cal-7`
      if (!groupId) {
        const m = (el.className || '').match(/\bgroup-(cal-\d+)\b/);
        if (m) groupId = m[1];
      }
      // Fallback: resolve group id via itemsRef map if DOM attribute is missing
      if ((!groupId || groupId === 'null' || groupId === 'undefined') && idToGroupId && id) {
        const mapped = idToGroupId.get(id);
        if (mapped) groupId = mapped;
      }
      let it = null;
      if (id && itemsRef) {
        it = itemsRef.get(id);
        if (!it && !Number.isNaN(Number(id))) {
          it = itemsRef.get(Number(id));
        }
      }
      let match = false;
      if (it) {
        match = itemMatchesQuery(it, q);
        // If item doesn't match itself, allow a group (calendar) name match to keep it
        if (!match && q && matchingGroupIds && it.group && matchingGroupIds.has(it.group)) {
          match = true;
        }
      } else {
        const txt = (el.textContent || '').toLowerCase();
        match = txt.includes(q);
        // If DOM text doesn't match, allow group name match via DOM attribute
        if (!match && q && matchingGroupIds && groupId && matchingGroupIds.has(groupId)) {
          match = true;
        }
      }
      el.classList.toggle('dimmed', !!q && !match);
      el.classList.toggle('search-match', !!q && match);
      if (q && typeof __DEV__ !== 'undefined' && __DEV__) {
        try { el.setAttribute('data-search-match', match ? '1' : '0'); if (groupId) el.setAttribute('data-search-group', groupId); } catch (_) {}
      }
    });
  } catch (_) {}
}

/**
 * Sets the search query and applies the filter
 * @param {string} q - Search query string
 * @returns {void}
 */
export function setSearchQuery(q) {
  currentSearch = q || '';
  applySearchFilter();
}

/**
 * Initializes the search module with timeline data and DOM event listeners
 * @param {Object} items - vis-timeline items DataSet
 * @param {Object} groups - vis-timeline groups DataSet
 * @returns {void}
 */
export function initSearch(items, groups) {
  itemsRef = items;
  groupsRef = groups;
  const searchBox = document.getElementById('searchBox');
  const clearSearchBtn = document.getElementById('clearSearch');
  if (searchBox) {
    searchBox.addEventListener('input', () => {
      currentSearch = searchBox.value || '';
      applySearchFilter();
    });
  }
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchBox) searchBox.value = '';
      currentSearch = '';
      applySearchFilter();
    });
  }
}
