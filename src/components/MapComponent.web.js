import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';

export default function MapComponent({
  clientLocation,
  workerLocation,
  startLocation,
  orders = [],
  workers = [],
  isDispatcher = false,
  height = 320
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const routeLineRef = useRef(null);
  const geofenceCircleRef = useRef(null);
  const connectLineRef = useRef(null);

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
      // Default center: Smederevo center
      const defaultCenter = [44.6627, 20.9300];
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView(defaultCenter, 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

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

    // Worker mode: show client (yellow pin + geofence 50m), start location if recorded, worker, and route
    if (!isDispatcher) {
      let clientPos = null;

      // 1. Lokacija klijenta: žuta čioda + 50m geofence krug
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

        // Geofence krug 50m oko lokacije klijenta
        geofenceCircleRef.current = L.circle(clientPos, {
          radius: 50,
          color: '#CA8A04',
          weight: 2,
          dashArray: '4, 4',
          fillColor: '#FEF08A',
          fillOpacity: 0.25
        }).addTo(map);
        geofenceCircleRef.current.bindPopup('Dozvoljena zona dolaska na adresu (50m)');
      }

      // 2. Lokacija majstora na početku rada (startLocation)
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

        // Iscrtavanje linije spajanja klijent <-> start
        if (clientPos) {
          connectLineRef.current = L.polyline([clientPos, startPos], {
            color: pinColor,
            weight: 3,
            dashArray: '5, 5',
            opacity: 0.85
          }).addTo(map);
        }
      }

      // 3. Trenutna lokacija majstora
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

        // Ruta ako postoji klijent i nalog je još na putu (nije startovan)
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
    // Dispatcher mode: prikaz ekipa i naloga sa semaforskim bojama
    else {
      (workers || []).forEach(w => {
        if (w.gpsX && w.gpsY) {
          const pos = [w.gpsX, w.gpsY];
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

      // Pravila boja na mapi dispečera:
      // 1. ZAVRŠENO = Zelena (#059669)
      // 2. START VAN OPSEGA 50m = Crvena (#DC2626)
      // 3. AKTIVNO U OPSEGU / ČEKA = Plava (#0284C7)
      (orders || []).forEach(o => {
        if (o.gpsX && o.gpsY) {
          const pos = [o.gpsX, o.gpsY];
          bounds.push(pos);

          let sColor;
          let statusDesc;

          if (o.status === 'ZAVRSENO') {
            sColor = '#059669'; // Zelena
            statusDesc = 'ZAVRŠENO ✓';
          } else if (Number(o.start_u_opsegu) === 0) {
            sColor = '#DC2626'; // Crvena: startovan van opsega
            statusDesc = `START VAN OPSEGA (${o.start_udaljenost_m || '?'}m) ⚠️`;
          } else {
            sColor = '#0284C7'; // Plava: u opsegu ili čeka
            statusDesc = o.status === 'U_RADU' ? 'U RADU (U OPSEGU)' : (o.status === 'NA_PUTU' ? 'NA PUTU' : 'ČEKA');
          }

          const icon = L.divIcon({
            className: 'custom-dispatcher-order',
            html: `<div style="background:${sColor};color:white;width:30px;height:30px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 7px rgba(0,0,0,0.4);font-size:12px;font-weight:900;">${o.broj_naloga ? o.broj_naloga.split('-').pop() : 'N'}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });
          markersRef.current[`order_${o.id}`] = L.marker(pos, { icon })
            .addTo(map)
            .bindPopup(`<b>${o.broj_naloga}</b> - ${o.klijent_ime || ''}<br/>Adresa: ${o.adresa || ''}<br/>Kvar: ${o.opis_kvara || 'Nije navedeno'}<br/><span style="color:${sColor};font-weight:800;">${statusDesc}</span>`);
        }
      });
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
  }, [clientLocation, workerLocation, startLocation, orders, workers, isDispatcher]);

  return (
    <View style={[styles.container, { height }]}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
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
    backgroundColor: '#F1F5F9'
  }
});
