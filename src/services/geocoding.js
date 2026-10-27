import { Platform } from 'react-native';
import { api } from './api';

const geoCache = new Map();

/**
 * Normalizuje prepoznati ili uneti tekst adrese:
 * uklanja poštanske brojeve i uobičajene prefikse
 */
export function sanitizeAddressQuery(raw) {
  if (!raw) return '';
  return raw
    .replace(/\b(11300|11311|11000|11320|12000|12300|26000|34000|18000)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pretraga adresa korišćenjem Photon (Komoot/OSM) i Nominatim servisa:
 * Vraća listu prepoznatih lokacija sa tačnim koordinatama (lat, lng).
 * Podržava sve gradove u Srbiji (Požarevac, Smederevo, Kovin, Beograd, Niš...).
 * 100% besplatno i open-source rešenje bez API ključeva.
 */
export async function searchAddressSuggestions(query, defaultCity = '') {
  const clean = sanitizeAddressQuery(query);
  if (!clean || clean.length < 2) return [];

  const results = [];
  const seen = new Set();

  // 1. Photon API
  try {
    const fullQuery = (defaultCity && !clean.toLowerCase().includes(defaultCity.toLowerCase()))
      ? `${clean}, ${defaultCity}`
      : clean;

    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(fullQuery)}&limit=6`;
    const res = await fetch(photonUrl);
    if (res.ok) {
      const data = await res.json();
      (data.features || []).forEach(f => {
        const p = f.properties || {};
        const cc = p.countrycode || '';
        if (cc && cc !== 'RS' && cc !== 'rs') return;

        const street = p.street || p.name || '';
        const houseNum = p.housenumber || '';
        const city = p.city || p.town || p.village || defaultCity || '';
        
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
      if (defaultCity && !clean.toLowerCase().includes(defaultCity.toLowerCase())) {
        nomQuery = `${clean}, ${defaultCity}`;
      }
      const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(nomQuery)}&countrycodes=rs&format=json&limit=5&addressdetails=1&accept-language=sr-Latn,sr,en`;
      const headers = Platform.OS === 'web' ? {} : { 'User-Agent': 'MajstorNalogApp/1.0 (podrska@majstornalog.rs)' };
      const res = await fetch(nomUrl, { headers });
      if (res.ok) {
        const nomData = await res.json();
        (nomData || []).forEach(item => {
          const a = item.address || {};
          const street = a.road || a.pedestrian || a.suburb || clean;
          const num = a.house_number || '';
          const city = a.city || a.town || a.village || a.municipality || defaultCity || '';

          let label = street;
          if (num) label += ` ${num}`;
          if (city && !label.toLowerCase().includes(city.toLowerCase())) {
            label += `, ${city}`;
          }

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
 * Reversno geokodiranje: za zadate koordinate vraća naziv ulice, kućni broj i grad.
 * Prvo pita naš pouzdani backend proxy (server-side cURL koji rešava CORS i rate limit),
 * a zatim ima fallback na javni Nominatim i Photon.
 * NIKADA ne upisuje koordinate u polje ulice ili grada!
 */
export async function reverseGeocode(latitude, longitude) {
  if (!latitude || !longitude) {
    return { address: '', street: '', houseNumber: '', city: '', lat: 0, lng: 0, candidates: [] };
  }

  const latNum = parseFloat(latitude);
  const lngNum = parseFloat(longitude);
  const cacheKey = `${latNum.toFixed(5)},${lngNum.toFixed(5)}`;

  if (geoCache.has(cacheKey)) {
    return geoCache.get(cacheKey);
  }

  // 1. PRIMARNO: Poziv našeg backend PHP proxy-ja
  try {
    const data = await api.reverseGeocode(latNum, lngNum);
    if (data && (data.street || data.address || data.city)) {
      const result = {
        address: data.address || '',
        street: data.street || '',
        houseNumber: data.houseNumber || '',
        city: data.city || '',
        lat: latNum,
        lng: lngNum,
        candidates: data.candidates || []
      };
      geoCache.set(cacheKey, result);
      return result;
    }
  } catch (apiErr) {
    // Server proxy nedostupan (offline ili lokalni test bez backend servera), nastavi sa direktnim klijentskim fallback-om
  }

  let formattedAddress = '';
  let street = '';
  let houseNumber = '';
  let city = '';

  // 2. Klijentski Nominatim fallback sa podrškom za latinicu i sve gradove u Srbiji
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 4000) : null;
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latNum}&lon=${lngNum}&format=json&addressdetails=1&accept-language=sr-Latn,sr,en`;
    const headers = Platform.OS === 'web' ? {} : { 'User-Agent': 'MajstorNalogApp/1.0 (kontakt@majstornalog.rs)' };
    const response = await fetch(url, { headers, signal: controller?.signal });
    if (timeoutId) clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.address) {
        const addr = data.address;
        const streetName = addr.road || addr.street || addr.pedestrian || addr.footway || addr.path || addr.suburb || '';
        houseNumber = addr.house_number || '';
        city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
        city = city.replace(/^Grad\s+/i, '').replace(/^Gradska\s+opština\s+/i, '').replace(/\s+upravni\s+okrug/i, '').trim();
        const poiName = addr.amenity || addr.building || addr.tourism || addr.historic || '';

        const primaryStreet = streetName || poiName || '';
        if (primaryStreet && houseNumber) {
          street = `${primaryStreet} ${houseNumber}`;
          formattedAddress = city ? `${street}, ${city}` : street;
        } else if (primaryStreet) {
          street = primaryStreet;
          formattedAddress = city ? `${primaryStreet}, ${city}` : primaryStreet;
        } else if (data.display_name) {
          const parts = data.display_name.split(',');
          street = parts[0] ? parts[0].trim() : '';
          formattedAddress = city ? (street ? `${street}, ${city}` : city) : street;
        }
      }
    }
  } catch (nomErr) {
    // Tiho nastavi na Photon fallback
  }

  // 3. Photon (Komoot) fallback ako Nominatim nije vratio adresu
  if (!street && !city) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;
      const url = `https://photon.komoot.io/reverse?lat=${latNum}&lon=${lngNum}`;
      const response = await fetch(url, { signal: controller?.signal });
      if (timeoutId) clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data && data.features && data.features.length > 0) {
          const p = data.features[0].properties || {};
          const streetName = p.street || p.name || '';
          houseNumber = p.housenumber || '';
          city = p.city || p.town || p.village || p.county || '';
          city = city.replace(/^Grad\s+/i, '').replace(/^Gradska\s+opština\s+/i, '').replace(/\s+upravni\s+okrug/i, '').trim();

          if (streetName && houseNumber) {
            street = `${streetName} ${houseNumber}`;
            formattedAddress = city ? `${street}, ${city}` : street;
          } else if (streetName) {
            street = streetName;
            formattedAddress = city ? `${streetName}, ${city}` : streetName;
          }
        }
      }
    } catch (photonErr) {
      // Ignoriši
    }
  }

  const result = {
    address: formattedAddress || (street ? (city ? `${street}, ${city}` : street) : (city ? `Lokacija (${city})` : 'Odabrana lokacija')),
    street: street.trim(),
    houseNumber: houseNumber.trim(),
    city: city.trim(),
    lat: latNum,
    lng: lngNum,
    candidates: []
  };

  geoCache.set(cacheKey, result);
  return result;
}

/**
 * Pronalazi adrese u neposrednoj blizini zadatih koordinata (lat, lng).
 * Vraća listu prepoznatih adresa sa kućnim brojevima i ulicama sa te lokacije
 * kako bi korisnik mogao da izabere tačnu adresu i kućni broj.
 * Podržava Požarevac, Smederevo, Kovin, Beograd i celu Srbiju.
 */
export async function getNearbyAddresses(latitude, longitude) {
  if (!latitude || !longitude) return [];
  const latNum = parseFloat(latitude);
  const lngNum = parseFloat(longitude);

  try {
    const rev = await reverseGeocode(latNum, lngNum);
    // Ako je backend proxy već vratio kompletne kandidate, koristi ih odmah!
    if (rev && rev.candidates && rev.candidates.length > 0) {
      return rev.candidates;
    }

    const candidates = [];
    const seen = new Set();
    const primaryStreet = rev?.street || '';
    const primaryCity = rev?.city || '';

    // 1. Reversno geokodiranje same tačke čiode
    if (primaryStreet) {
      const key = `${primaryStreet}, ${primaryCity}`.toLowerCase();
      seen.add(key);
      candidates.push({
        id: 'primary-exact',
        street: primaryStreet,
        city: primaryCity,
        address: primaryCity ? `${primaryStreet}, ${primaryCity}` : primaryStreet,
        lat: latNum,
        lng: lngNum,
        isExact: true
      });

      // 2. Pretraga obližnjih adresa i kućnih brojeva u istoj ulici
      const baseStreet = primaryStreet.replace(/\s+\d+[a-zA-Z]?(\/\d+)?$/, '').trim();
      if (baseStreet.length >= 2) {
        try {
          const suggestions = await searchAddressSuggestions(baseStreet, primaryCity);
          (suggestions || []).forEach(s => {
            const streetStr = (s.street || s.address.split(',')[0]).trim();
            const cityStr = s.city || primaryCity;
            const key = `${streetStr}, ${cityStr}`.toLowerCase();

            if (!seen.has(key) && streetStr.toLowerCase().includes(baseStreet.toLowerCase())) {
              seen.add(key);
              const dLat = (s.lat - latNum) * 111000;
              const dLng = (s.lng - lngNum) * 85000;
              const dist = Math.sqrt(dLat * dLat + dLng * dLng);

              if (dist < 600) {
                candidates.push({
                  id: s.id || `sug-${streetStr}`,
                  street: streetStr,
                  city: cityStr,
                  address: cityStr ? `${streetStr}, ${cityStr}` : streetStr,
                  lat: s.lat,
                  lng: s.lng,
                  distance: dist
                });
              }
            }
          });
        } catch (sugErr) {}
      }
    }

    // 3. Ako baza nije našla brojeve, ostavi tačnu adresu sa čiode
    if (candidates.length === 0) {
      const fallbackStreet = primaryStreet || 'Odabrana lokacija na mapi';
      candidates.push({
        id: 'fallback-pin',
        street: fallbackStreet,
        city: primaryCity,
        address: primaryCity ? `${fallbackStreet}, ${primaryCity}` : fallbackStreet,
        lat: latNum,
        lng: lngNum,
        isExact: true
      });
    }

    candidates.sort((a, b) => {
      if (a.isExact) return -1;
      if (b.isExact) return 1;
      return (a.distance || 0) - (b.distance || 0);
    });

    return candidates.slice(0, 6);
  } catch (e) {
    return [{
      id: 'fallback-err',
      street: 'Odabrana lokacija na mapi',
      city: '',
      address: 'Odabrana lokacija na mapi',
      lat: latNum,
      lng: lngNum,
      isExact: true
    }];
  }
}
