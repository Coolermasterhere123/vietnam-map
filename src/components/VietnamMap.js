'use client';

import { useState, useCallback, useRef } from 'react';
import { buildPlaces, haversine, isInVietnam, cityDefaults } from '@/lib/places';

const CITIES = ['All', 'Da Nang', 'Ho chi minh city', 'Hoi An', 'TAM COC NINH BINH', 'Hanoi'];
const CATEGORIES = ['all', 'food', 'coffee', 'sight', 'hotel', 'other'];
const CAT_LABELS = { all: '🗺 All', food: '🍜 Food', coffee: '☕ Coffee', sight: '🏛 Sights', hotel: '🏨 Hotel', other: '📌 Other' };
const CITY_LABELS = {
  'All': 'All Cities',
  'Da Nang': 'Đà Nẵng',
  'Ho chi minh city': 'Ho Chi Minh',
  'Hoi An': 'Hội An',
  'TAM COC NINH BINH': 'Ninh Bình',
  'Hanoi': 'Hà Nội',
};

const ALL_PLACES = buildPlaces();

function openDirections(place, userLat, userLng) {
  const destName = encodeURIComponent(place.title + ' ' + CITY_LABELS[place.city] + ' Vietnam');
  let orgParam;

  if (userLat != null && isInVietnam(userLat, userLng)) {
    // Use actual GPS coords when inside Vietnam
    orgParam = encodeURIComponent(`${userLat},${userLng}`);
  } else {
    // Use hotel name as origin — Google Maps resolves it reliably by name
    const def = cityDefaults[place.city];
    if (def) {
      orgParam = encodeURIComponent(def.hotelName + ' ' + CITY_LABELS[place.city] + ' Vietnam');
    }
  }

  if (orgParam) {
    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=${orgParam}&destination=${destName}&travelmode=walking`,
      '_blank'
    );
  } else {
    window.open(`https://www.google.com/maps/search/?api=1&query=${destName}`, '_blank');
  }
}

function openInMaps(place) {
  if (place.url && place.url.startsWith('http')) {
    window.open(place.url, '_blank');
  } else {
    window.open(`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`, '_blank');
  }
}

export default function VietnamMap() {
  const [userLat, setUserLat] = useState(null);
  const [userLng, setUserLng] = useState(null);
  const [gpsError, setGpsError] = useState('');
  const [locating, setLocating] = useState(false);
  const [city, setCity] = useState('All');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [expanded, setExpanded] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const inVietnam = userLat != null && isInVietnam(userLat, userLng);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) { setGpsError('Geolocation not supported.'); return; }
    setLocating(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setSortBy('distance');
        setLocating(false);
      },
      (err) => { setGpsError('Location unavailable. ' + err.message); setLocating(false); },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, []);

  const places = ALL_PLACES
    .filter((p) => city === 'All' || p.city === city)
    .filter((p) => category === 'all' || p.category === category)
    .filter((p) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.note.toLowerCase().includes(q) || p.comment.toLowerCase().includes(q);
    })
    .map((p) => ({
      ...p,
      distance: userLat != null ? haversine(userLat, userLng, p.lat, p.lng) : Infinity,
    }))
    .sort((a, b) => {
      if (sortBy === 'distance') {
        if (a.distance === Infinity && b.distance === Infinity) return a.title.localeCompare(b.title);
        return a.distance - b.distance;
      }
      return a.title.localeCompare(b.title);
    });

  function formatDist(km) {
    if (km === Infinity) return '';
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)}km`;
  }

  // Get the directions origin label for the currently selected city (or a place's city)
  function getDirectionsLabel(placeCity) {
    if (inVietnam) return 'from your location';
    const def = cityDefaults[placeCity];
    return def ? `from ${def.hotelName}` : '';
  }

  const sidebarContent = (
    <div style={styles.sidebar}>
      <div style={styles.sidebarHeader}>
        <span style={styles.sidebarTitle}>🇻🇳 VietMap</span>
        <button style={styles.closeBtn} onClick={() => setSidebarOpen(false)}>✕</button>
      </div>

      <div style={styles.section}>
        <button style={styles.gpsBtn} onClick={getLocation} disabled={locating}>
          {locating ? '📡 Locating…' : userLat ? (inVietnam ? '✅ In Vietnam' : '📍 Outside Vietnam') : '📍 Use My Location'}
        </button>
        {gpsError && <p style={styles.error}>{gpsError}</p>}
        {userLat && (
          <p style={styles.coordText}>
            {inVietnam ? '✅ Directions from your GPS' : '🏨 Directions from city hotel'}
          </p>
        )}
        {!userLat && (
          <p style={styles.coordText}>🏨 Directions will use city hotel as origin</p>
        )}
      </div>

      <div style={styles.section}>
        <label style={styles.label}>Sort by</label>
        <div style={styles.toggleRow}>
          {['name', 'distance'].map((s) => (
            <button key={s}
              style={{ ...styles.toggleBtn, ...(sortBy === s ? styles.toggleActive : {}) }}
              onClick={() => setSortBy(s)}>
              {s === 'name' ? '🔤 Name' : '📏 Distance'}
            </button>
          ))}
        </div>
        {sortBy === 'distance' && !userLat && (
          <p style={styles.coordText}>⚠️ Tap "Use My Location" above for accurate distances</p>
        )}
      </div>

      <div style={styles.section}>
        <label style={styles.label}>City</label>
        {CITIES.map((c) => (
          <button key={c}
            style={{ ...styles.filterBtn, ...(city === c ? styles.filterActive : {}) }}
            onClick={() => { setCity(c); setExpanded(null); }}>
            {CITY_LABELS[c]}
          </button>
        ))}
      </div>

      <div style={styles.section}>
        <label style={styles.label}>Category</label>
        <div style={styles.catGrid}>
          {CATEGORIES.map((c) => (
            <button key={c}
              style={{ ...styles.catBtn, ...(category === c ? styles.catActive : {}) }}
              onClick={() => { setCategory(c); setExpanded(null); }}>
              {CAT_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.countBadge}>{places.length} place{places.length !== 1 ? 's' : ''}</div>
    </div>
  );

  return (
    <div style={styles.app}>
      <div style={styles.topBar}>
        <button style={styles.menuBtn} onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
        <span style={styles.topTitle}>🇻🇳 VietMap</span>
        <div style={styles.searchWrap}>
          <input
            style={styles.searchInput}
            placeholder="Search places…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button style={styles.clearBtn} onClick={() => setSearch('')}>✕</button>}
        </div>
      </div>

      <div style={styles.body}>
        {sidebarOpen && <div style={styles.overlay} onClick={() => setSidebarOpen(false)} />}
        <div style={{ ...styles.sidebarWrap, transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}>
          {sidebarContent}
        </div>

        <div style={styles.list}>
          {places.length === 0 && (
            <div style={styles.empty}>No places found. Try adjusting filters.</div>
          )}
          {places.map((p, i) => {
            const isOpen = expanded === i;
            const dirLabel = getDirectionsLabel(p.city);
            return (
              <div key={`${p.city}-${p.title}`} style={{ ...styles.card, ...(isOpen ? styles.cardOpen : {}) }}>
                <button style={styles.cardHeader} onClick={() => setExpanded(isOpen ? null : i)}>
                  <div style={styles.cardLeft}>
                    <span style={styles.catDot(p.category)} />
                    <div>
                      <div style={styles.cardTitle}>{p.title}</div>
                      <div style={styles.cardSub}>
                        <span style={styles.cityTag}>{CITY_LABELS[p.city]}</span>
                        {p.distance !== Infinity && (
                          <span style={styles.distTag}>{formatDist(p.distance)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span style={styles.chevron}>{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div style={styles.cardBody}>
                    {p.note && <p style={styles.note}>{p.note}</p>}
                    {p.comment && <p style={styles.comment}>{p.comment}</p>}
                    <div style={styles.cardActions}>
                      <button style={styles.mapBtn} onClick={() => openInMaps(p)}>
                        🗺 View on Map
                      </button>
                      <button style={styles.dirBtn} onClick={() => openDirections(p, userLat, userLng)}>
                        🧭 Directions
                      </button>
                    </div>
                    {dirLabel && (
                      <p style={styles.dirHint}>{dirLabel}</p>
                    )}
                    {p.distance !== Infinity && (
                      <p style={styles.distBadge}>{formatDist(p.distance)} away</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles = {
  app: { fontFamily: "'Segoe UI', system-ui, sans-serif", minHeight: '100vh', background: '#f5f2eb', display: 'flex', flexDirection: 'column' },
  topBar: { background: '#0b3b2b', color: '#fff', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' },
  menuBtn: { background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', padding: '0 4px', flexShrink: 0 },
  topTitle: { fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap', flexShrink: 0 },
  searchWrap: { flex: 1, position: 'relative', display: 'flex', alignItems: 'center' },
  searchInput: { width: '100%', padding: '7px 32px 7px 10px', borderRadius: 20, border: 'none', fontSize: 14, background: 'rgba(255,255,255,0.15)', color: '#fff', outline: 'none', boxSizing: 'border-box' },
  clearBtn: { position: 'absolute', right: 6, background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 14, padding: 2 },
  body: { flex: 1, position: 'relative', display: 'flex' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 199 },
  sidebarWrap: { position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 200, transition: 'transform 0.25s ease', width: 260 },
  sidebar: { width: 260, height: '100%', background: '#0b3b2b', color: '#fff', overflowY: 'auto', padding: '0 0 40px 0', boxSizing: 'border-box' },
  sidebarHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  sidebarTitle: { fontWeight: 700, fontSize: 18 },
  closeBtn: { background: 'none', border: 'none', color: '#ccc', fontSize: 18, cursor: 'pointer', padding: 4 },
  section: { padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  label: { display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#9ec', marginBottom: 8 },
  gpsBtn: { width: '100%', padding: '10px 0', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 600 },
  error: { color: '#f88', fontSize: 12, margin: '6px 0 0' },
  coordText: { color: '#9ec', fontSize: 12, margin: '6px 0 0', lineHeight: 1.4 },
  toggleRow: { display: 'flex', gap: 8 },
  toggleBtn: { flex: 1, padding: '8px 0', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#ccc', fontSize: 13, cursor: 'pointer' },
  toggleActive: { background: '#e8a020', borderColor: '#e8a020', color: '#fff', fontWeight: 700 },
  filterBtn: { display: 'block', width: '100%', padding: '9px 12px', marginBottom: 6, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#ddd', fontSize: 14, textAlign: 'left', cursor: 'pointer' },
  filterActive: { background: '#e8a020', borderColor: '#e8a020', color: '#fff', fontWeight: 700 },
  catGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 },
  catBtn: { padding: '8px 4px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#ddd', fontSize: 12, cursor: 'pointer', textAlign: 'center' },
  catActive: { background: '#e8a020', borderColor: '#e8a020', color: '#fff', fontWeight: 700 },
  countBadge: { textAlign: 'center', padding: '14px', color: '#9ec', fontSize: 13, fontWeight: 600 },
  list: { flex: 1, padding: '12px', overflowY: 'auto', maxWidth: 680, margin: '0 auto', width: '100%', boxSizing: 'border-box' },
  empty: { textAlign: 'center', color: '#888', marginTop: 60, fontSize: 15 },
  card: { background: '#fff', borderRadius: 12, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden', border: '1px solid #e8e4db' },
  cardOpen: { boxShadow: '0 4px 16px rgba(0,0,0,0.12)', border: '1px solid #c8b97a' },
  cardHeader: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', padding: '12px 14px', cursor: 'pointer', textAlign: 'left', gap: 8 },
  cardLeft: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  catDot: (cat) => ({ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: { food: '#e8a020', coffee: '#8b5e3c', sight: '#2a7abf', hotel: '#6b47b8', other: '#888' }[cat] || '#888' }),
  cardTitle: { fontWeight: 600, fontSize: 15, color: '#1a1a1a', lineHeight: 1.3 },
  cardSub: { display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  cityTag: { fontSize: 11, color: '#0b3b2b', background: '#d4ece1', padding: '2px 7px', borderRadius: 10, fontWeight: 600 },
  distTag: { fontSize: 11, color: '#7a5c00', background: '#fef3d0', padding: '2px 7px', borderRadius: 10, fontWeight: 600 },
  chevron: { color: '#aaa', fontSize: 12, flexShrink: 0 },
  cardBody: { padding: '0 14px 14px', borderTop: '1px solid #f0ece4' },
  note: { fontSize: 13, color: '#555', margin: '10px 0 6px', lineHeight: 1.5, fontStyle: 'italic' },
  comment: { fontSize: 13, color: '#555', margin: '6px 0', lineHeight: 1.5 },
  cardActions: { display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  mapBtn: { padding: '9px 14px', borderRadius: 8, border: 'none', background: '#0b3b2b', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  dirBtn: { padding: '9px 14px', borderRadius: 8, border: 'none', background: '#e8a020', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  dirHint: { fontSize: 11, color: '#888', margin: '6px 0 0', fontStyle: 'italic' },
  distBadge: { fontSize: 12, color: '#7a5c00', fontWeight: 600, margin: '4px 0 0' },
};
