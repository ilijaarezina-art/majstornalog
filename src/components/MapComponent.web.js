import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import { MapPin, Navigation, Crosshair, Plus, Minus } from 'lucide-react-native';

export default function MapComponent({
  clientLocation,
  workerLocation,
  startLocation,
  orders = [],
  workers = [],
  isDispatcher = false,
  focusedOrder = null,
  isPinPickerMode = false,
  onPinCoordsChange = null,
  height = 320
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const routeLineRef = useRef(null);
  const geofenceCircleRef = useRef(null);
  const connectLineRef = useRef(null);
  const pinPickerInitRef = useRef(false);
  const onPinCoordsChangeRef = useRef(onPinCoordsChange);
  const isPinPickerModeRef = useRef(isPinPickerMode);

  useEffect(() => {
    onPinCoordsChangeRef.current = onPinCoordsChange;
    isPinPickerModeRef.current = isPinPickerMode;
  }, [onPinCoordsChange, isPinPickerMode]);

  useEffect(() => {
    // Inject Leaflet CSS & JS if not already loaded
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const initMap = () => {
      if (!mapContainerRef.current || mapInstanceRef.current) return;
      if (typeof window.L === 'undefined') {
        setTimeout(initMap, 100);
        return;
      }

      const L = window.L;
      const defaultCenter = [44.6627, 20.9300];
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView(defaultCenter, 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      // Listener for moving map in Pin Picker mode
      map.on('move', () => {
        if (mapInstanceRef.current && onPinCoordsChangeRef.current && isPinPickerModeRef.current) {
          const center = map.getCenter();
          onPinCoordsChangeRef.current({ lat: center.lat, lng: center.lng, isMoving: true });
        }
      });

      map.on('moveend', () => {
        if (mapInstanceRef.current && onPinCoordsChangeRef.current && isPinPickerModeRef.current) {
          const center = map.getCenter();
          onPinCoordsChangeRef.current({ lat: center.lat, lng: center.lng, isMoving: false });
        }
      });

      // Klik na mapu u Pin Picker režimu: odmah centrira mapu na kliknutu tačku i pokreće geokodiranje
      map.on('click', (e) => {
        if (mapInstanceRef.current && onPinCoordsChangeRef.current && isPinPickerModeRef.current) {
          map.panTo(e.latlng);
          onPinCoordsChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng, isMoving: false });
        }
      });

      mapInstanceRef.current = map;
      updateMapLayers();
    };

    if (typeof window.L === 'undefined' && !document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      initMap();
    }

    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const updateMapLayers = () => {
    const map = mapInstanceRef.current;
    if (!map || typeof window.L === 'undefined') return;
    const L = window.L;

    // Clear old layers
    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};

    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
    if (geofenceCircleRef.current) {
      map.removeLayer(geofenceCircleRef.current);
      geofenceCircleRef.current = null;
    }
    if (connectLineRef.current) {
      map.removeLayer(connectLineRef.current);
      connectLineRef.current = null;
    }

    const bounds = [];

    // ==========================================================
    // 1. PIN PICKER MODE (DEFINISANJE LOKACIJE ČIODOM)
    // ==========================================================
    if (isPinPickerMode) {
      // Postavi pogled samo prvi put pri otvaranju; NE resetuj zum kada korisnik odzumira ili zumira mapu!
      if (!pinPickerInitRef.current) {
        if (clientLocation && clientLocation.lat && clientLocation.lng) {
          map.setView([clientLocation.lat, clientLocation.lng], 16);
          pinPickerInitRef.current = true;
        }
      }
      return;
    } else {
      pinPickerInitRef.current = false;
    }

    // ==========================================================
    // 2. FOCUSED ORDER MODE (Kliknut je radni nalog na tabli!)
    // Prikazuje se:
    // - Dolazna lokacija klijenta (Žuta/crvena čioda + 50m geofence)
    // - Polazna lokacija ulogovanog korisnika / dodeljenog majstora
    // - OSRM ruta između njih
    // ==========================================================
    if (focusedOrder) {
      const cLat = parseFloat(focusedOrder.gpsX);
      const cLng = parseFloat(focusedOrder.gpsY);

      if (cLat && cLng) {
        const clientPos = [cLat, cLng];
        bounds.push(clientPos);

        const clientIcon = L.divIcon({
          className: 'focused-client-pin',
          html: '<div style="background:#EAB308;color:#713F12;width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.4);"><span style="transform:rotate(45deg);font-size:16px;font-weight:900;">📍</span></div>',
          iconSize: [36, 36],
          iconAnchor: [18, 36]
        });

        markersRef.current['focused_client'] = L.marker(clientPos, { icon: clientIcon })
          .addTo(map)
          .bindPopup(`<b>📍 DOLAZNA LOKACIJA KLIJENTA:</b><br/><b>${focusedOrder.klijent_ime || ''}</b><br/>${focusedOrder.adresa || ''}<br/><i>Radni nalog: ${focusedOrder.broj_naloga}</i>`)
          .openPopup();

        // 50m geofence krug dolazne lokacije
        geofenceCircleRef.current = L.circle(clientPos, {
          radius: 50,
          color: '#CA8A04',
          weight: 2,
          dashArray: '5, 5',
          fillColor: '#FEF08A',
          fillOpacity: 0.25
        }).addTo(map);

        // Polazna lokacija: ulogovani korisnik ili dodeljeni majstor
        const workerPos = workerLocation?.lat && workerLocation?.lng
          ? [workerLocation.lat, workerLocation.lng]
          : null;

        if (workerPos) {
          bounds.push(workerPos);
          const wIcon = L.divIcon({
            className: 'focused-worker-pin',
            html: '<div style="background:#0284C7;color:white;width:36px;height:36px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.4);font-size:17px;">🔧</div>',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
          });

          markersRef.current['focused_worker'] = L.marker(workerPos, { icon: wIcon })
            .addTo(map)
            .bindPopup(`<b>🏢 POLAZNA LOKACIJA:</b><br/>${workerLocation.name || 'Dispečerski centar / Polazna stanica'}`);

          // Iscrtavanje rute preko OSRM-a
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${workerPos[1]},${workerPos[0]};${clientPos[1]},${clientPos[0]}?overview=full&geometries=geojson`;
          fetch(osrmUrl)
            .then(res => res.json())
            .then(data => {
              if (data.routes && data.routes.length > 0) {
                const coords = data.routes[0].geometry.coordinates.map(pt => [pt[1], pt[0]]);
                if (routeLineRef.current) map.removeLayer(routeLineRef.current);
                routeLineRef.current = L.polyline(coords, {
                  color: '#0284C7',
                  weight: 5,
                  opacity: 0.9
                }).addTo(map);
              }
            })
            .catch(() => {});
        }
      }

      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 16);
      }
      return;
    }

    // ==========================================================
    // 3. REGULAR WORKER DETAIL VIEW
    // ==========================================================
    if (!isDispatcher) {
      let clientPos = null;

      if (clientLocation && clientLocation.lat && clientLocation.lng) {
        clientPos = [clientLocation.lat, clientLocation.lng];
        bounds.push(clientPos);

        const clientIcon = L.divIcon({
          className: 'custom-client-pin',
          html: '<div style="background:#EAB308;color:#713F12;width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.35);"><span style="transform:rotate(45deg);font-size:15px;font-weight:900;">📍</span></div>',
          iconSize: [34, 34],
          iconAnchor: [17, 34]
        });
        markersRef.current['client'] = L.marker(clientPos, { icon: clientIcon })
          .addTo(map)
          .bindPopup(`<b>📍 Klijent: ${clientLocation.name || ''}</b><br/>${clientLocation.address || 'Adresa intervencije'}`);

        geofenceCircleRef.current = L.circle(clientPos, {
          radius: 50,
          color: '#CA8A04',
          weight: 2,
          dashArray: '4, 4',
          fillColor: '#FEF08A',
          fillOpacity: 0.25
        }).addTo(map);
      }

      if (startLocation && startLocation.lat && startLocation.lng) {
        const startPos = [startLocation.lat, startLocation.lng];
        bounds.push(startPos);
        const inZone = Boolean(startLocation.inGeofence);
        const dist = startLocation.distance || 0;
        const pinColor = inZone ? '#0284C7' : '#EA580C';
        const labelText = inZone ? `✓ U opsegu (${dist}m)` : `⚠️ Van opsega (${dist}m)`;

        const startIcon = L.divIcon({
          className: 'custom-start-pin',
          html: `<div style="background:${pinColor};color:white;padding:4px 8px;border-radius:12px;border:2px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.35);font-size:11px;font-weight:800;white-space:nowrap;">🔧 ${labelText}</div>`,
          iconSize: [120, 26],
          iconAnchor: [60, 13]
        });

        markersRef.current['startLocation'] = L.marker(startPos, { icon: startIcon })
          .addTo(map)
          .bindPopup(`<b>Lokacija majstora na početku rada:</b><br/>${labelText}<br/>Razdaljina od klijenta: ${dist} m`);

        if (clientPos) {
          connectLineRef.current = L.polyline([clientPos, startPos], {
            color: pinColor,
            weight: 3,
            dashArray: '5, 5',
            opacity: 0.85
          }).addTo(map);
        }
      }

      if (workerLocation && workerLocation.lat && workerLocation.lng) {
        const workerPos = [workerLocation.lat, workerLocation.lng];
        bounds.push(workerPos);

        const workerIcon = L.divIcon({
          className: 'custom-worker-pin',
          html: '<div style="background:#0284C7;color:white;width:34px;height:34px;border-radius:50%;border:2.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.4);font-size:16px;">🚗</div>',
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });
        markersRef.current['worker'] = L.marker(workerPos, { icon: workerIcon })
          .addTo(map)
          .bindPopup('<b>Vaša lokacija</b>');

        if (clientPos && (!startLocation || !startLocation.lat)) {
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${workerLocation.lng},${workerLocation.lat};${clientLocation.lng},${clientLocation.lat}?overview=full&geometries=geojson`;
          fetch(osrmUrl)
            .then(res => res.json())
            .then(data => {
              if (data.routes && data.routes.length > 0) {
                const coords = data.routes[0].geometry.coordinates.map(pt => [pt[1], pt[0]]);
                if (routeLineRef.current) map.removeLayer(routeLineRef.current);
                routeLineRef.current = L.polyline(coords, {
                  color: '#0284C7',
                  weight: 5,
                  opacity: 0.9
                }).addTo(map);
              }
            })
            .catch(() => {});
        }
      }
    } 
    // ==========================================================
    // 4. DISPATCHER OVERVIEW (EKIPE I LOKACIJA KORISNIKA)
    // Prikazuje samo aktivne majstore i poziciju ulogovanog korisnika.
    // Nalozi se na mapi prikazuju ISKLJUČIVO kada se klikne na radni nalog!
    // ==========================================================
    else {
      // Prikaz majstora na mapi (SAMO ako su aktivni na terenu, NIKADA ako su SLOBODAN ili bez stvarne lokacije)
      (workers || []).forEach(w => {
        const isFree = !w.radni_status || w.radni_status === 'SLOBODAN' || w.radni_status === 'NEAKTIVAN';
        if (w.gpsX && w.gpsY && !isFree) {
          const pos = [parseFloat(w.gpsX), parseFloat(w.gpsY)];
          bounds.push(pos);
          const icon = L.divIcon({
            className: 'custom-dispatcher-worker',
            html: `<div style="background:${w.boja_markera || '#059669'};color:white;padding:3px 8px;border-radius:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-size:11px;font-weight:700;white-space:nowrap;">🚗 ${w.ime}</div>`,
            iconSize: [80, 26],
            iconAnchor: [40, 13]
          });
          markersRef.current[`worker_${w.id}`] = L.marker(pos, { icon })
            .addTo(map)
            .bindPopup(`<b>Majstor: ${w.ime} ${w.prezime}</b><br/>Tel: ${w.telefon}<br/>Status: <b>${w.radni_status || 'NA TERENU'}</b>`);
        }
      });

      // Prikaz polazne lokacije ulogovanog korisnika
      if (workerLocation && workerLocation.lat && workerLocation.lng) {
        const uPos = [parseFloat(workerLocation.lat), parseFloat(workerLocation.lng)];
        bounds.push(uPos);
        const uIcon = L.divIcon({
          className: 'custom-dispatcher-me',
          html: '<div style="background:#0284C7;color:white;width:34px;height:34px;border-radius:50%;border:2.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.4);font-size:16px;">🏢</div>',
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });
        markersRef.current['dispatcher_me'] = L.marker(uPos, { icon: uIcon })
          .addTo(map)
          .bindPopup(`<b>Vaša lokacija:</b><br/>${workerLocation.name || 'Dispečerski centar'}`);
      }
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    }

    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 200);
  };

  useEffect(() => {
    updateMapLayers();
  }, [clientLocation, workerLocation, startLocation, orders, workers, isDispatcher, focusedOrder, isPinPickerMode]);

  return (
    <View style={[styles.container, { height }]}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Centered Floating Pin Picker Indicator (When in Pin Mode) */}
      {isPinPickerMode && (
        <View style={styles.pinOverlayContainer} pointerEvents="none">
          <View style={styles.pinAnchor}>
            <View style={styles.pinHead}>
              <MapPin size={26} color="#FFFFFF" />
            </View>
            <View style={styles.pinTail} />
            <View style={styles.pinShadow} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F1F5F9',
    position: 'relative'
  },
  pinOverlayContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  },
  pinAnchor: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40
  },
  pinHead: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#EA580C',
    marginTop: -1
  },
  pinShadow: {
    width: 14,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginTop: 4
  }
});
