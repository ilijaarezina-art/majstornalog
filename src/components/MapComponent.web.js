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
  selectedWorkerId = null,
  selectedWorker = null,
  focusedOrder = null,
  isPinPickerMode = false,
  onPinCoordsChange = null,
  onSelectOrder = null,
  onFocusOrder = null,
  onSelectWorker = null,
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
  const onSelectOrderRef = useRef(onSelectOrder);
  const onFocusOrderRef = useRef(onFocusOrder);
  const onSelectWorkerRef = useRef(onSelectWorker);

  useEffect(() => {
    onPinCoordsChangeRef.current = onPinCoordsChange;
    isPinPickerModeRef.current = isPinPickerMode;
    onSelectOrderRef.current = onSelectOrder;
    onFocusOrderRef.current = onFocusOrder;
    onSelectWorkerRef.current = onSelectWorker;
  }, [onPinCoordsChange, isPinPickerMode, onSelectOrder, onFocusOrder, onSelectWorker]);

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
    // 3. MAJSTOR: PREGLED SVIH DODELJENIH NALOGA I DOLAZNIH LOKACIJA ZA TAJ DAN
    // ==========================================================
    if (!isDispatcher && orders && orders.length > 0 && !clientLocation) {
      let focusedMarkerToOpen = null;

      orders.forEach((o, idx) => {
        const oLat = parseFloat(o.gpsX || o.klijent_gpsX || (o.lat ? o.lat : null));
        const oLng = parseFloat(o.gpsY || o.klijent_gpsY || (o.lng ? o.lng : null));
        if (!oLat || !oLng) return;

        const oPos = [oLat, oLng];
        bounds.push(oPos);

        const isFocused = focusedOrder && Number(focusedOrder.id) === Number(o.id);
        const status = o.status || 'DODELJENO';
        const isUrgent = o.prioritet === 'HITNO';

        let pinColor = '#0284C7';
        let statusText = 'Dodeljeno (čeka)';
        let statusBg = '#E0F2FE';
        let statusBorder = '#BAE6FD';

        if (status === 'U_RADU') {
          pinColor = '#D97706';
          statusText = 'U radu na lokaciji';
          statusBg = '#FEF3C7';
          statusBorder = '#FDE68A';
        } else if (status === 'NA_PUTU') {
          pinColor = '#4F46E5';
          statusText = 'Na putu ka adresi';
          statusBg = '#EEF2FF';
          statusBorder = '#C7D2FE';
        } else if (status === 'PRIHVACENO') {
          pinColor = '#0284C7';
          statusText = 'Prihvaćeno (spremno)';
          statusBg = '#E0F2FE';
          statusBorder = '#BAE6FD';
        } else if (status === 'ZAVRSENO') {
          const inGeo = Number(o.start_u_opsegu) === 1;
          pinColor = inGeo ? '#059669' : '#DC2626';
          statusText = inGeo ? 'Završeno i overeno' : 'Završeno (van opsega)';
          statusBg = inGeo ? '#DEF7EC' : '#FEE2E2';
          statusBorder = inGeo ? '#BCF0DA' : '#FECACA';
        } else if (status === 'ODLOZENO') {
          pinColor = '#DC2626';
          statusText = 'Odloženo';
          statusBg = '#FEE2E2';
          statusBorder = '#FECACA';
        }

        const orderNumClean = (o.broj_naloga || '').replace(/^[A-Za-z]+-[0-9]+-/, '');
        const badgeLabel = orderNumClean ? (`#${orderNumClean}`) : (idx + 1);

        const pinHtml = `<div style="position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;">`
          + `<div style="background:${pinColor};color:white;width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.35);${isFocused ? 'box-shadow:0 0 0 3px #F59E0B, 0 4px 14px rgba(0,0,0,0.5);' : ''}">`
          + `<span style="transform:rotate(45deg);font-size:11px;font-weight:900;">${badgeLabel}</span>`
          + `</div>`
          + (isUrgent ? `<div style="position:absolute;top:-5px;right:-5px;background:#DC2626;color:white;width:15px;height:15px;border-radius:50%;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;border:1.5px solid white;">!</div>` : '')
          + `</div>`;

        const mIcon = L.divIcon({
          className: '',
          html: pinHtml,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
          popupAnchor: [0, -32]
        });

        const marker = L.marker(oPos, { icon: mIcon }).addTo(map);

        marker.on('click', () => {
          if (onFocusOrderRef.current) {
            onFocusOrderRef.current(o.id);
          }
        });

        const popupContent = document.createElement('div');
        popupContent.style.cssText = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-width:220px;padding:2px;";
        popupContent.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <b style="color:#0284C7;font-size:12px;">${o.broj_naloga || ('Nalog #' + o.id)}</b>
            ${isUrgent ? '<span style="background:#FEE2E2;color:#DC2626;font-size:10px;font-weight:800;padding:1px 5px;border-radius:4px;">⚡ HITNO</span>' : ''}
          </div>
          <div style="font-size:13px;font-weight:800;color:#0F172A;margin-bottom:2px;">${o.klijent_ime || 'Klijent'}</div>
          <div style="font-size:11.5px;color:#475569;margin-bottom:4px;">📍 ${o.adresa || ''}${o.sprat_stan ? ' (' + o.sprat_stan + ')' : ''}</div>
          <div style="margin-bottom:6px;"><span style="display:inline-block;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;background:${statusBg};color:${pinColor};border:1px solid ${statusBorder};">${statusText}</span></div>
          ${o.opis_kvara ? `<div style="font-size:10.5px;color:#334155;background:#F8FAFC;padding:5px 7px;border-radius:6px;margin-bottom:6px;border:1px solid #E2E8F0;"><b>Kvar:</b> ${o.opis_kvara}</div>` : ''}
          <button id="btn-majstor-focus-${o.id}" style="width:100%;padding:6px 0;background:#0284C7;color:white;border:none;border-radius:6px;font-size:11px;font-weight:800;cursor:pointer;margin-bottom:5px;">🚗 Prikaži putanju do lokacije</button>
          <button id="btn-majstor-open-${o.id}" style="width:100%;padding:6px 0;background:#F1F5F9;color:#334155;border:1px solid #CBD5E1;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">Otvori radni nalog ↗</button>
        `;

        marker.bindPopup(popupContent);
        marker.on('popupopen', () => {
          const btnF = document.getElementById(`btn-majstor-focus-${o.id}`);
          if (btnF) {
            btnF.onclick = () => {
              if (onFocusOrderRef.current) onFocusOrderRef.current(o.id);
            };
          }
          const btnO = document.getElementById(`btn-majstor-open-${o.id}`);
          if (btnO) {
            btnO.onclick = () => {
              if (onSelectOrderRef.current) onSelectOrderRef.current(o.id);
            };
          }
        });

        markersRef.current[`order_${o.id}`] = marker;

        if (isFocused) {
          focusedMarkerToOpen = marker;
        }
      });

      // Trenutna lokacija majstora
      if (workerLocation && workerLocation.lat && workerLocation.lng) {
        const mwPos = [parseFloat(workerLocation.lat), parseFloat(workerLocation.lng)];
        bounds.push(mwPos);
        const mwIcon = L.divIcon({
          className: '',
          html: '<div style="background:#059669;color:white;width:34px;height:34px;border-radius:50%;border:2.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.4);font-size:16px;">🚗</div>',
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        });
        const mwm = L.marker(mwPos, { icon: mwIcon }).addTo(map);
        mwm.bindPopup(`<b>🚗 Moja trenutna pozicija</b><br>${workerLocation.name || 'Majstor na terenu'}`);
        markersRef.current['my_location'] = mwm;

        if (focusedOrder) {
          const fLat = parseFloat(focusedOrder.gpsX || focusedOrder.klijent_gpsX || (focusedOrder.lat ? focusedOrder.lat : null));
          const fLng = parseFloat(focusedOrder.gpsY || focusedOrder.klijent_gpsY || (focusedOrder.lng ? focusedOrder.lng : null));
          if (fLat && fLng) {
            const fPos = [fLat, fLng];
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${mwPos[1]},${mwPos[0]};${fPos[1]},${fPos[0]}?overview=full&geometries=geojson`;
            fetch(osrmUrl)
              .then(res => res.json())
              .then(d => {
                if (d.routes && d.routes.length > 0) {
                  const coords = d.routes[0].geometry.coordinates.map(pt => [pt[1], pt[0]]);
                  if (routeLineRef.current) map.removeLayer(routeLineRef.current);
                  routeLineRef.current = L.polyline(coords, { color: '#0284C7', weight: 5, opacity: 0.9 }).addTo(map);
                }
              })
              .catch(() => {});
          }
        }
      }

      if (focusedMarkerToOpen) {
        focusedMarkerToOpen.openPopup();
      }

      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 15);
      }

      setTimeout(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      }, 150);
      return;
    }

    // ==========================================================
    // 4. REGULAR WORKER DETAIL VIEW
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
    // 4. DISPATCHER OVERVIEW (ODABRANI MAJSTOR I SVI NJEGOVI NALOZI)
    // ==========================================================
    else {
      const selId = selectedWorkerId ? Number(selectedWorkerId) : (selectedWorker ? Number(selectedWorker.id) : 0);
      let selWorker = (workers || []).find(w => Number(w.id) === selId);
      if (!selWorker && workers && workers.length > 0) {
        selWorker = workers[0];
      }

      let workerPos = null;
      if (selWorker) {
        if (selWorker.gpsX && selWorker.gpsY) {
          workerPos = [parseFloat(selWorker.gpsX), parseFloat(selWorker.gpsY)];
          bounds.push(workerPos);

          const wColor = selWorker.boja_markera || '#059669';
          const wIconHtml = `<div style="background:${wColor};color:white;padding:5px 12px;border-radius:18px;border:2.5px solid white;box-shadow:0 4px 14px rgba(0,0,0,0.35);font-size:12px;font-weight:800;white-space:nowrap;display:flex;align-items:center;gap:4px;cursor:pointer;">`
            + `<span>🚗</span><span>${selWorker.ime} ${selWorker.prezime || ''}</span>`
            + `</div>`;

          const wm = L.marker(workerPos, {
            icon: L.divIcon({ className: '', html: wIconHtml, iconSize: [140, 30], iconAnchor: [70, 15] })
          }).addTo(map);

          wm.bindPopup(`<b>🚗 Majstor: ${selWorker.ime} ${selWorker.prezime || ''}</b><br>📞 ${selWorker.telefon || '-'}<br>Status: ${selWorker.radni_status || 'Aktivan'}`);
          markersRef.current['selected_worker'] = wm;
        }

        // Nalozi odabranog majstora za odabrani datum
        const targetWorkerId = Number(selWorker.id);
        const workerOrders = (orders || []).filter(o => Number(o.majstor_id) === targetWorkerId);

        let focusedMarkerToOpen = null;

        workerOrders.forEach((o, idx) => {
          const oLat = parseFloat(o.gpsX || o.klijent_gpsX || (o.lat ? o.lat : null));
          const oLng = parseFloat(o.gpsY || o.klijent_gpsY || (o.lng ? o.lng : null));
          if (!oLat || !oLng) return;

          const oPos = [oLat, oLng];
          bounds.push(oPos);

          const isFocused = focusedOrder && Number(focusedOrder.id) === Number(o.id);
          const status = o.status || 'DODELJENO';
          const isUrgent = o.prioritet === 'HITNO';

          let pinColor = '#0284C7';
          let statusText = 'Dodeljeno (čeka)';
          let statusBg = '#E0F2FE';
          let statusBorder = '#BAE6FD';

          if (status === 'U_RADU') {
            pinColor = '#D97706';
            statusText = 'U radu na lokaciji';
            statusBg = '#FEF3C7';
            statusBorder = '#FDE68A';
          } else if (status === 'NA_PUTU') {
            pinColor = '#4F46E5';
            statusText = 'Na putu ka adresi';
            statusBg = '#EEF2FF';
            statusBorder = '#C7D2FE';
          } else if (status === 'PRIHVACENO') {
            pinColor = '#0284C7';
            statusText = 'Prihvaćeno (spremno)';
            statusBg = '#E0F2FE';
            statusBorder = '#BAE6FD';
          } else if (status === 'ZAVRSENO') {
            const inGeo = Number(o.start_u_opsegu) === 1;
            pinColor = inGeo ? '#059669' : '#DC2626';
            statusText = inGeo ? 'Završeno i overeno' : 'Završeno (van opsega)';
            statusBg = inGeo ? '#DEF7EC' : '#FEE2E2';
            statusBorder = inGeo ? '#BCF0DA' : '#FECACA';
          } else if (status === 'ODLOZENO') {
            pinColor = '#DC2626';
            statusText = 'Odloženo';
            statusBg = '#FEE2E2';
            statusBorder = '#FECACA';
          }

          const orderNumClean = (o.broj_naloga || '').replace(/^[A-Za-z]+-[0-9]+-/, '');
          const badgeLabel = orderNumClean ? (`#${orderNumClean}`) : (idx + 1);

          const pinHtml = `<div style="position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;">`
            + `<div style="background:${pinColor};color:white;width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.35);${isFocused ? 'box-shadow:0 0 0 3px #F59E0B, 0 4px 14px rgba(0,0,0,0.5);' : ''}">`
            + `<span style="transform:rotate(45deg);font-size:11px;font-weight:900;">${badgeLabel}</span>`
            + `</div>`
            + (isUrgent ? `<div style="position:absolute;top:-5px;right:-5px;background:#DC2626;color:white;width:15px;height:15px;border-radius:50%;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;border:1.5px solid white;">!</div>` : '')
            + `</div>`;

          const mIcon = L.divIcon({
            className: '',
            html: pinHtml,
            iconSize: [34, 34],
            iconAnchor: [17, 34],
            popupAnchor: [0, -32]
          });

          const marker = L.marker(oPos, { icon: mIcon }).addTo(map);

          marker.on('click', () => {
            if (onFocusOrderRef.current) {
              onFocusOrderRef.current(o.id);
            }
          });

          const popupContent = document.createElement('div');
          popupContent.style.cssText = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-width:220px;padding:2px;";
          popupContent.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <b style="color:#0284C7;font-size:12px;">${o.broj_naloga || ('Nalog #' + o.id)}</b>
              ${isUrgent ? '<span style="background:#FEE2E2;color:#DC2626;font-size:10px;font-weight:800;padding:1px 5px;border-radius:4px;">⚡ HITNO</span>' : ''}
            </div>
            <div style="font-size:13px;font-weight:800;color:#0F172A;margin-bottom:2px;">${o.klijent_ime || 'Klijent'}</div>
            <div style="font-size:11.5px;color:#475569;margin-bottom:4px;">📍 ${o.adresa || ''}${o.sprat_stan ? ' (' + o.sprat_stan + ')' : ''}</div>
            <div style="margin-bottom:6px;"><span style="display:inline-block;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;background:${statusBg};color:${pinColor};border:1px solid ${statusBorder};">${statusText}</span></div>
            ${o.opis_kvara ? `<div style="font-size:10.5px;color:#334155;background:#F8FAFC;padding:5px 7px;border-radius:6px;margin-bottom:6px;border:1px solid #E2E8F0;"><b>Kvar:</b> ${o.opis_kvara}</div>` : ''}
            <button id="btn-focus-${o.id}" style="width:100%;padding:6px 0;background:#0284C7;color:white;border:none;border-radius:6px;font-size:11px;font-weight:800;cursor:pointer;margin-bottom:5px;">🚗 Prikaži putanju do lokacije</button>
            <button id="btn-open-${o.id}" style="width:100%;padding:6px 0;background:#F1F5F9;color:#334155;border:1px solid #CBD5E1;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">Otvori radni nalog ↗</button>
          `;

          marker.bindPopup(popupContent);
          marker.on('popupopen', () => {
            const btnF = document.getElementById(`btn-focus-${o.id}`);
            if (btnF) {
              btnF.onclick = () => {
                if (onFocusOrderRef.current) onFocusOrderRef.current(o.id);
              };
            }
            const btnO = document.getElementById(`btn-open-${o.id}`);
            if (btnO) {
              btnO.onclick = () => {
                if (onSelectOrderRef.current) onSelectOrderRef.current(o.id);
              };
            }
          });

          markersRef.current[`order_${o.id}`] = marker;

          if (isFocused) {
            focusedMarkerToOpen = marker;
          }
        });

        // Iscrtavanje rute od lokacije majstora ISKLJUČIVO kada je nalog kliknut / fokusiran
        if (focusedOrder) {
          const fLat = parseFloat(focusedOrder.gpsX || focusedOrder.klijent_gpsX || (focusedOrder.lat ? focusedOrder.lat : null));
          const fLng = parseFloat(focusedOrder.gpsY || focusedOrder.klijent_gpsY || (focusedOrder.lng ? focusedOrder.lng : null));
          if (workerPos && fLat && fLng) {
            const destPos = [fLat, fLng];
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${workerPos[1]},${workerPos[0]};${destPos[1]},${destPos[0]}?overview=full&geometries=geojson`;
            fetch(osrmUrl)
              .then(res => res.json())
              .then(data => {
                if (data.routes && data.routes.length > 0) {
                  const coords = data.routes[0].geometry.coordinates.map(pt => [pt[1], pt[0]]);
                  if (routeLineRef.current) map.removeLayer(routeLineRef.current);
                  routeLineRef.current = L.polyline(coords, { color: '#0284C7', weight: 5, opacity: 0.9 }).addTo(map);
                }
              })
              .catch(() => {});
          }
        } else {
          if (routeLineRef.current) {
            map.removeLayer(routeLineRef.current);
            routeLineRef.current = null;
          }
        }

        if (focusedMarkerToOpen) {
          focusedMarkerToOpen.openPopup();
        }
      }
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 16 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    }

    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);
  };

  useEffect(() => {
    updateMapLayers();
  }, [clientLocation, workerLocation, startLocation, orders, workers, isDispatcher, selectedWorkerId, selectedWorker, focusedOrder, isPinPickerMode]);

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
