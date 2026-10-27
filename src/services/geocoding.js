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
 * Reversno geokodiranje: za zadate koordinate vraća naziv ulice, kućni broj i grad.
 * Koristi provereni algoritam iz taxi aplikacije (Nominatim kao primarni, Photon kao fallback).
 * NIKADA ne upisuje koordinate u polje ulice ili grada!
 */
export async function reverseGeocode(latitude, longitude) {
  if (!latitude || !longitude) {
    return { address: '', street: '', houseNumber: '', city: 'Smederevo', lat: 0, lng: 0 };
  }

  const latNum = parseFloat(latitude);
  const lngNum = parseFloat(longitude);
  const cacheKey = `${latNum.toFixed(5)},${lngNum.toFixed(5)}`;

  if (geoCache.has(cacheKey)) {
    return geoCache.get(cacheKey);
  }

  let formattedAddress = '';
  let street = '';
  let houseNumber = '';
  let city = 'Smederevo';

  // 1. Nominatim OpenStreetMap (najprecizniji za kućne brojeve u Srbiji)
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 2500) : null;
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latNum}&lon=${lngNum}&format=json&addressdetails=1`;
    const headers = Platform.OS === 'web' ? {} : { 'User-Agent': 'MajstorNalogApp/1.0 (kontakt@majstornalog.rs)' };
    const response = await fetch(url, { headers, signal: controller?.signal });
    if (timeoutId) clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.address) {
        const addr = data.address;
        const streetName = addr.road || addr.street || addr.pedestrian || addr.footway || addr.path || addr.suburb || '';
        houseNumber = addr.house_number || '';
        city = addr.city || addr.town || addr.village || addr.municipality || 'Smederevo';
        const poiName = addr.amenity || addr.building || addr.tourism || addr.historic || '';

        const primaryStreet = streetName || poiName || '';
        if (primaryStreet && houseNumber) {
          street = `${primaryStreet} ${houseNumber}`;
          formattedAddress = `${street}, ${city}`;
        } else if (primaryStreet) {
          street = primaryStreet;
          formattedAddress = `${primaryStreet}, ${city}`;
        } else if (data.display_name) {
          const parts = data.display_name.split(',');
          street = parts[0] ? parts[0].trim() : '';
          formattedAddress = street ? `${street}, ${city}` : city;
        }
      }
    }
  } catch (nomErr) {
    // Tiho nastavi na Photon fallback
  }

  // 2. Photon (Komoot) fallback ako Nominatim nije vratio adresu
  if (!street) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 2500) : null;
      const url = `https://photon.komoot.io/reverse?lat=${latNum}&lon=${lngNum}`;
      const response = await fetch(url, { signal: controller?.signal });
      if (timeoutId) clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data && data.features && data.features.length > 0) {
          const p = data.features[0].properties || {};
          const streetName = p.street || p.name || '';
          houseNumber = p.housenumber || '';
          city = p.city || p.town || p.village || city || 'Smederevo';

          if (streetName && houseNumber) {
            street = `${streetName} ${houseNumber}`;
            formattedAddress = `${street}, ${city}`;
          } else if (streetName) {
            street = streetName;
            formattedAddress = `${streetName}, ${city}`;
          }
        }
      }
    } catch (photonErr) {
      // Ignoriši
    }
  }

  const result = {
    address: formattedAddress || (street ? `${street}, ${city}` : `Odabrana lokacija (${city})`),
    street: street.trim(),
    houseNumber: houseNumber.trim(),
    city: city.trim(),
    lat: latNum,
    lng: lngNum
  };

  geoCache.set(cacheKey, result);
  return result;
}

/**
 * Pronalazi adrese u neposrednoj blizini zadatih koordinata (lat, lng).
 * Vraća listu prepoznatih adresa sa kućnim brojevima i ulicama sa te lokacije
 * kako bi korisnik mogao da izabere tačnu adresu i kućni broj.
 */
export async function getNearbyAddresses(latitude, longitude) {
  if (!latitude || !longitude) return [];
  const latNum = parseFloat(latitude);
  const lngNum = parseFloat(longitude);

  const candidates = [];
  const seen = new Set();

  let primaryStreet = '';
  let primaryCity = 'Smederevo';

  // 1. Reversno geokodiranje same tačke čiode
  try {
    const rev = await reverseGeocode(latNum, lngNum);
    if (rev && rev.street) {
      primaryStreet = rev.street;
      primaryCity = rev.city || 'Smederevo';
      const key = `${rev.street}, ${primaryCity}`.toLowerCase();
      seen.add(key);
      candidates.push({
        id: 'primary-exact',
        street: rev.street,
        city: primaryCity,
        address: `${rev.street}, ${primaryCity}`,
        lat: latNum,
        lng: lngNum,
        isExact: true
      });
    }
  } catch (e) {}

  // 2. Pretraga obližnjih adresa i kućnih brojeva u istoj ulici
  if (primaryStreet) {
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

            if (dist < 450) {
              candidates.push({
                id: s.id || `sug-${streetStr}`,
                street: streetStr,
                city: cityStr,
                address: `${streetStr}, ${cityStr}`,
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
    candidates.push({
      id: 'fallback-pin',
      street: primaryStreet || 'Odabrana lokacija na mapi',
      city: primaryCity,
      address: primaryStreet ? `${primaryStreet}, ${primaryCity}` : `Lokacija (${primaryCity})`,
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

  return candidates.slice(0, 5);
}
