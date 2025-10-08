// Search and filter module for vis-timeline items
// Handles search input wiring and DOM-based dimming/highlighting

let itemsRef = null;
export let currentSearch = '';

function itemMatchesQuery(item, q) {
  if (!q) return true;
  const hay = [item.content, item.title, item.description, item.location];
  const meta = item.meta || {};
  hay.push(meta.orderNumber, meta.systemType, meta.ticketLink);
  return hay.filter(Boolean).some(v => String(v).toLowerCase().includes(q));
}

export function applySearchFilter() {
  const q = (currentSearch || '').trim().toLowerCase();
  try {
    const els = document.querySelectorAll('.vis-timeline .vis-item');
    els.forEach(el => {
      const id = el.getAttribute('data-id');
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
      } else {
        const txt = (el.textContent || '').toLowerCase();
        match = txt.includes(q);
      }
      el.classList.toggle('dimmed', !!q && !match);
      el.classList.toggle('search-match', !!q && match);
    });
  } catch (_) {}
}

export function setSearchQuery(q) {
  currentSearch = q || '';
  applySearchFilter();
}

export function initSearch(items) {
  itemsRef = items;
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
