import { Platform } from 'react-native';

const geoCache = new Map();

/**
 * Normalizuje prepoznati ili uneti tekst adrese:
 * uklanja poštanske brojeve i uobičajene prefikse
 */
export function sanitizeAddressQuery(raw) {
  if (!raw) return '';
  return raw
    .replace(/\b(11300|11311|11000|11320)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pretraga adresa korišćenjem Photon (Komoot/OSM) i Nominatim servisa:
 * Vraća listu prepoznatih lokacija sa tačnim koordinatama (lat, lng).
 * 100% besplatno i open-source rešenje bez API ključeva.
 */
export async function searchAddressSuggestions(query, defaultCity = 'Smederevo') {
  const clean = sanitizeAddressQuery(query);
  if (!clean || clean.length < 2) return [];

  const results = [];
  const seen = new Set();

  // 1. Photon API (veoma brz fuzzy pretraživač sa koordinatnim sidrom oko Smedereva)
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(clean)}&lat=44.6627&lon=20.9300&limit=6`;
    const res = await fetch(photonUrl);
    if (res.ok) {
      const data = await res.json();
      (data.features || []).forEach(f => {
        const p = f.properties || {};
        const cc = p.countrycode || '';
        if (cc && cc !== 'RS' && cc !== 'rs') return;

        const street = p.street || p.name || '';
        const houseNum = p.housenumber || '';
        const city = p.city || p.town || p.village || defaultCity;
        
        let label = street;
        if (houseNum) label += ` ${houseNum}`;
        if (city && !label.toLowerCase().includes(city.toLowerCase())) {
          label += `, ${city}`;
        }

        const lng = f.geometry?.coordinates?.[0];
        const lat = f.geometry?.coordinates?.[1];

        if (lat && lng && !seen.has(label.toLowerCase())) {
          seen.add(label.toLowerCase());
          results.push({
            id: `photon-${p.osm_id || Math.random()}`,
            address: label,
            street: houseNum ? `${street} ${houseNum}` : street,
            city,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            source: 'photon'
          });
        }
      });
    }
  } catch (e) {
    // Tiho ignoriši i pređi na Nominatim
  }

  // 2. Nominatim fallback ili dopuna (odličan za tačne kućne brojeve)
  if (results.length < 3) {
    try {
      let nomQuery = clean;
      if (!clean.toLowerCase().includes(defaultCity.toLowerCase())) {
        nomQuery = `${clean}, ${defaultCity}`;
      }
      const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(nomQuery)}&countrycodes=rs&format=json&limit=5&addressdetails=1`;
      const headers = Platform.OS === 'web' ? {} : { 'User-Agent': 'MajstorNalogApp/1.0 (podrska@majstornalog.rs)' };
      const res = await fetch(nomUrl, { headers });
      if (res.ok) {
        const nomData = await res.json();
        (nomData || []).forEach(item => {
          const a = item.address || {};
          const street = a.road || a.pedestrian || a.suburb || clean;
          const num = a.house_number || '';
          const city = a.city || a.town || a.village || defaultCity;

          let label = street;
          if (num) label += ` ${num}`;
          if (city) label += `, ${city}`;

          if (item.lat && item.lon && !seen.has(label.toLowerCase())) {
            seen.add(label.toLowerCase());
            results.push({
              id: `nom-${item.osm_id || Math.random()}`,
              address: label,
              street: num ? `${street} ${num}` : street,
              city,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              source: 'nominatim'
            });
          }
        });
      }
    } catch (nomErr) {
      // Ignoriši
    }
  }

  return results;
}

/**
 * Reversno geokodiranje: za zadate koordinate vraća naziv ulice i grada
 */
export async function reverseGeocode(lat, lng) {
  if (!lat || !lng) return null;
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (geoCache.has(cacheKey)) return geoCache.get(cacheKey);

  try {
    const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const p = data.features?.[0]?.properties;
      if (p) {
        const street = p.street || p.name || '';
        const houseNum = p.housenumber || '';
        const city = p.city || p.town || p.village || 'Smederevo';
        let addr = street;
        if (houseNum) addr += ` ${houseNum}`;
        if (city) addr += `, ${city}`;

        const ret = {
          address: addr,
          street: houseNum ? `${street} ${houseNum}` : street,
          city,
          lat,
          lng
        };
        geoCache.set(cacheKey, ret);
        return ret;
      }
    }
  } catch (e) {}

  // Fallback na Nominatim reverse
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const headers = Platform.OS === 'web' ? {} : { 'User-Agent': 'MajstorNalogApp/1.0' };
    const res = await fetch(nomUrl, { headers });
    if (res.ok) {
      const data = await res.json();
      const a = data.address || {};
      const street = a.road || a.street || '';
      const num = a.house_number || '';
      const city = a.city || a.town || a.village || 'Smederevo';
      let addr = street;
      if (num) addr += ` ${num}`;
      if (city) addr += `, ${city}`;

      const ret = {
        address: addr || data.display_name,
        street: num ? `${street} ${num}` : street,
        city,
        lat,
        lng
      };
      geoCache.set(cacheKey, ret);
      return ret;
    }
  } catch (e) {}

  return {
    address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    street: '',
    city: 'Smederevo',
    lat,
    lng
  };
}
