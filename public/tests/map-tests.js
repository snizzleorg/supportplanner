function assert(name, cond, details='') {
  const ok = !!cond;
  console.log(JSON.stringify({ name, ok, details }));
  if (!ok) throw new Error(name + ' failed: ' + (details || ''));
}

// Leaflet stub
(function installLeafletStub(){
  const markersCreated = [];
  const layerGroup = {
    _added: [],
    addTo(map) { map._layerGroup = this; return this; },
    clearLayers() { this._added = []; },
    addLayer(marker) { this._added.push(marker); markersCreated.push(marker); }
  };
  const L = {
    _markersCreated: markersCreated,
    map(id){ return { _id: id, _layerGroup: null, setView(){}, fitBounds(){}, }; },
    tileLayer(){ return { addTo(){ return this; } }; },
    layerGroup(){ return Object.assign({}, layerGroup); },
    icon(opts){ return opts; },
    marker(latlon, opts){
      return {
        latlon,
        opts,
        addTo(l){ l.addLayer(this); return this; },
        bindPopup(){ return this; }
      };
    }
  };
  window.L = L;
  window.__markersCreated = markersCreated;
})();

// Enable map testing instrumentation before module import
window.__MAP_TESTING = true;

async function run() {
  try {
    const { renderMapMarkers } = await import('../js/map.js');
    console.log('[map-tests] start');

    // Prepare items: two events at same location but different groups, plus one at another location.
    const items = [
      { location: '52.5200,13.4050', group: 'gA', content: 'A1', start: '2025-01-01', end: '2025-01-02' },
      { location: '52.5200,13.4050', group: 'gA', content: 'A2', start: '2025-01-03', end: '2025-01-04' },
      { location: '52.5200,13.4050', group: 'gB', content: 'B1', start: '2025-01-05', end: '2025-01-06' },
      { location: '48.1372,11.5756', group: 'gC', content: 'C1', start: '2025-02-01', end: '2025-02-02' },
    ];

    // Groups facade with colors
    const groups = new Map([
      ['gA', { bg: '#ff0000', content: 'Alice' }],
      ['gB', { bg: '#00ff00', content: 'Bob' }],
      ['gC', { bg: '#0000ff', content: 'Carol' }],
    ]);

    // Create map container expected by module
    const mapDiv = document.getElementById('map') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'map' }));

    await renderMapMarkers(items, groups);

    const markers = window.__markersCreated || [];
    console.log('[map-tests] markers created:', markers.length);
    // Expect: 3 markers (two for Berlin: groups A and B; one for Munich)
    assert('created expected marker count', markers.length === 3, markers.length);

    // Verify colors plumbed into icon data (different icon objects per group)
    const colors = new Set(markers.map(m => m.opts && m.opts.icon && m.opts.icon.iconUrl || JSON.stringify(m.opts.icon)));
    assert('distinct icons for different group colors', colors.size >= 3, Array.from(colors));

    document.getElementById('summary').textContent = 'Passed map tests';
  } catch (e) {
    console.log('[map-tests] error:', e && (e.stack || e.message || String(e)));
    document.getElementById('summary').textContent = 'Failed: ' + (e && e.message ? e.message : String(e));
  }
}

document.getElementById('runMapTests')?.addEventListener('click', run);
// Auto-run after load
window.addEventListener('load', () => setTimeout(() => { try { run(); } catch (_) {} }, 50));
// Expose for runner
window.__runMapTests = run;
