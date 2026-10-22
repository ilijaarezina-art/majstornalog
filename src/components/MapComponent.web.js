import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';

export default function MapComponent({
  clientLocation,
  workerLocation,
  orders = [],
  workers = [],
  isDispatcher = false,
  height = 320
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const routeLineRef = useRef(null);

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

    return () => {
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

    // Clear old markers
    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};

    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }

    const bounds = [];

    // Worker mode: show worker + client + route
    if (!isDispatcher) {
      if (workerLocation && workerLocation.lat && workerLocation.lng) {
        const workerPos = [workerLocation.lat, workerLocation.lng];
        bounds.push(workerPos);

        const workerIcon = L.divIcon({
          className: 'custom-worker-pin',
          html: '<div style="background:#0284C7;color:white;width:34px;height:34px;border-radius:50%;border:2.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.4);font-size:16px;">🚐</div>',
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });
        markersRef.current['worker'] = L.marker(workerPos, { icon: workerIcon }).addTo(map).bindPopup("<b>Vaša lokacija</b>");
      }

      if (clientLocation && clientLocation.lat && clientLocation.lng) {
        const clientPos = [clientLocation.lat, clientLocation.lng];
        bounds.push(clientPos);

        const clientIcon = L.divIcon({
          className: 'custom-client-pin',
          html: '<div style="background:#DC2626;color:white;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.4);"><span style="transform:rotate(45deg);font-size:14px;font-weight:900;">📍</span></div>',
          iconSize: [32, 32],
          iconAnchor: [16, 32]
        });
        markersRef.current['client'] = L.marker(clientPos, { icon: clientIcon }).addTo(map).bindPopup(`<b>Klijent:</b><br/>${clientLocation.name || clientLocation.address || 'Adresa intervencije'}`);
      }

      // Draw OSRM route if both exist
      if (workerLocation?.lat && workerLocation?.lng && clientLocation?.lat && clientLocation?.lng) {
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
    // Dispatcher mode: show all workers and all orders of the day
    else {
      (workers || []).forEach(w => {
        if (w.gpsX && w.gpsY) {
          const pos = [w.gpsX, w.gpsY];
          bounds.push(pos);
          const icon = L.divIcon({
            className: 'custom-dispatcher-worker',
            html: `<div style="background:${w.boja_markera || '#059669'};color:white;padding:3px 8px;border-radius:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-size:11px;font-weight:700;white-space:nowrap;">🔧 ${w.ime}</div>`,
            iconSize: [80, 26],
            iconAnchor: [40, 13]
          });
          markersRef.current[`worker_${w.id}`] = L.marker(pos, { icon }).addTo(map).bindPopup(`<b>Majstor: ${w.ime} ${w.prezime}</b><br/>Tel: ${w.telefon}<br/>Status: <b>${w.radni_status || 'NA TERENU'}</b>`);
        }
      });

      (orders || []).forEach(o => {
        if (o.gpsX && o.gpsY) {
          const pos = [o.gpsX, o.gpsY];
          bounds.push(pos);
          const statusColor = o.status === 'ZAVRSENO' ? '#059669' : (o.status === 'U_RADU' ? '#D97706' : '#0284C7');
          const icon = L.divIcon({
            className: 'custom-dispatcher-order',
            html: `<div style="background:${statusColor};color:white;width:28px;height:28px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.35);font-size:12px;font-weight:900;">${o.broj_naloga ? o.broj_naloga.split('-').pop() : 'N'}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });
          markersRef.current[`order_${o.id}`] = L.marker(pos, { icon }).addTo(map).bindPopup(`<b>${o.broj_naloga}</b> - ${o.klijent_ime}<br/>Adresa: ${o.adresa}<br/>Kvar: ${o.opis_kvara || 'Nije navedeno'}<br/>Status: <b>${o.status}</b>`);
        }
      });
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    }
  };

  useEffect(() => {
    updateMapLayers();
  }, [clientLocation, workerLocation, orders, workers, isDispatcher]);

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
