import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const getMapHtml = () => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; background:#F1F5F9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
    .leaflet-popup-content-wrapper { border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.25); padding: 4px; }
    .leaflet-popup-content { margin: 8px 10px; line-height: 1.4; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { attributionControl: false, zoomControl: true }).setView([44.6627, 20.9300], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    var markers = {};
    var routeLine = null;
    var geofenceCircle = null;
    var connectLine = null;
    var pinPickerInit = false;
    var isPinPickerCurrent = false;

    window.parentSelectOrder = function(orderId) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_ORDER', orderId: orderId }));
      } else if (window.parent) {
        window.parent.postMessage(JSON.stringify({ type: 'SELECT_ORDER', orderId: orderId }), '*');
      }
    };

    window.parentFocusOrder = function(orderId) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'FOCUS_ORDER', orderId: orderId }));
      } else if (window.parent) {
        window.parent.postMessage(JSON.stringify({ type: 'FOCUS_ORDER', orderId: orderId }), '*');
      }
    };

    window.parentSelectWorker = function(workerId) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_WORKER', workerId: workerId }));
      } else if (window.parent) {
        window.parent.postMessage(JSON.stringify({ type: 'SELECT_WORKER', workerId: workerId }), '*');
      }
    };

    map.on('moveend', function() {
      var center = map.getCenter();
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PIN_MOVE_END', lat: center.lat, lng: center.lng }));
      } else if (window.parent) {
        window.parent.postMessage(JSON.stringify({ type: 'PIN_MOVE_END', lat: center.lat, lng: center.lng }), '*');
      }
    });

    map.on('click', function(e) {
      if (isPinPickerCurrent) {
        map.panTo(e.latlng);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PIN_MOVE_END', lat: e.latlng.lat, lng: e.latlng.lng }));
        } else if (window.parent) {
          window.parent.postMessage(JSON.stringify({ type: 'PIN_MOVE_END', lat: e.latlng.lat, lng: e.latlng.lng }), '*');
        }
      }
    });

    function renderLayers(payload) {
      isPinPickerCurrent = Boolean(payload.isPinPickerMode);
      Object.values(markers).forEach(function(m) { map.removeLayer(m); });
      markers = {};
      if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
      if (geofenceCircle) { map.removeLayer(geofenceCircle); geofenceCircle = null; }
      if (connectLine) { map.removeLayer(connectLine); connectLine = null; }

      var bounds = [];

      // 1. PIN PICKER MODE
      if (payload.isPinPickerMode) {
        if (!pinPickerInit) {
          if (payload.clientLocation && payload.clientLocation.lat) {
            map.setView([payload.clientLocation.lat, payload.clientLocation.lng], 16);
            pinPickerInit = true;
          }
        }
        return;
      } else {
        pinPickerInit = false;
      }

      // 2. FOCUSED ORDER MODE (Detaljan pregled jedne intervencije)
      if (payload.focusedOrder && (!payload.orders || payload.orders.length === 0)) {
        var fo = payload.focusedOrder;
        var cLat = parseFloat(fo.gpsX);
        var cLng = parseFloat(fo.gpsY);
        if (cLat && cLng) {
          var cPos = [cLat, cLng];
          bounds.push(cPos);
          var cIcon = L.divIcon({
            html: '<div style="background:#EAB308;color:#713F12;width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.4);"><span style="transform:rotate(45deg);font-size:16px;font-weight:900;">📍</span></div>',
            iconSize: [36, 36],
            iconAnchor: [18, 36]
          });
          var cm = L.marker(cPos, { icon: cIcon }).addTo(map);
          cm.bindPopup('<b>📍 Dolazna lokacija: ' + (fo.klijent_ime || '') + '</b><br>' + (fo.adresa || ''));
          markers['focused_client'] = cm;

          geofenceCircle = L.circle(cPos, { radius: 50, color: '#CA8A04', weight: 2, dashArray: '5, 5', fillColor: '#FEF08A', fillOpacity: 0.25 }).addTo(map);

          if (payload.workerLocation && payload.workerLocation.lat) {
            var wPos = [payload.workerLocation.lat, payload.workerLocation.lng];
            bounds.push(wPos);
            var wIcon = L.divIcon({
              html: '<div style="background:#0284C7;color:white;width:36px;height:36px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.4);font-size:17px;">🔧</div>',
              iconSize: [36, 36],
              iconAnchor: [18, 18]
            });
            var wm = L.marker(wPos, { icon: wIcon }).addTo(map);
            wm.bindPopup('<b>Polazna lokacija:</b><br>' + (payload.workerLocation.name || 'Vaša lokacija'));
            markers['focused_worker'] = wm;

            var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' + wPos[1] + ',' + wPos[0] + ';' + cPos[1] + ',' + cPos[0] + '?overview=full&geometries=geojson';
            fetch(osrmUrl).then(function(r){ return r.json(); }).then(function(d){
              if (d.routes && d.routes.length > 0) {
                var coords = d.routes[0].geometry.coordinates.map(function(pt) { return [pt[1], pt[0]]; });
                if (routeLine) map.removeLayer(routeLine);
                routeLine = L.polyline(coords, { color: '#0284C7', weight: 5, opacity: 0.9 }).addTo(map);
              }
            }).catch(function(){});
          }
        }

        if (bounds.length > 1) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        } else if (bounds.length === 1) {
          map.setView(bounds[0], 16);
        }
        return;
      }

      // 3. MAJSTOR: PREGLED SVIH DODELJENIH NALOGA I DOLAZNIH LOKACIJA ZA TAJ DAN
      if (!payload.isDispatcher && payload.orders && payload.orders.length > 0 && !payload.clientLocation) {
        var focusedMarkerToOpen = null;

        (payload.orders || []).forEach(function(o, idx) {
          var oLat = parseFloat(o.gpsX);
          var oLng = parseFloat(o.gpsY);
          if (!oLat || !oLng) return;

          var oPos = [oLat, oLng];
          bounds.push(oPos);

          var isFocused = payload.focusedOrder && Number(payload.focusedOrder.id) === Number(o.id);
          var status = o.status || 'DODELJENO';
          var isUrgent = o.prioritet === 'HITNO';

          // Boje i statusne oznake prema životnom ciklusu naloga
          var pinColor = '#0284C7';
          var statusText = 'Dodeljeno (čeka)';
          var statusBg = '#E0F2FE';
          var statusBorder = '#BAE6FD';

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
            var inGeo = (Number(o.start_u_opsegu) === 1);
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

          var orderNumClean = (o.broj_naloga || '').replace(/^[A-Za-z]+-[0-9]+-/, '');
          var badgeLabel = orderNumClean ? ('#' + orderNumClean) : (idx + 1);

          var pinHtml = '<div style="position:relative;display:flex;align-items:center;justify-content:center;">'
            + '<div style="background:' + pinColor + ';color:white;width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.35);' + (isFocused ? 'box-shadow:0 0 0 3px #F59E0B, 0 4px 14px rgba(0,0,0,0.5);' : '') + '">'
            + '<span style="transform:rotate(45deg);font-size:11px;font-weight:900;">' + badgeLabel + '</span>'
            + '</div>'
            + (isUrgent ? '<div style="position:absolute;top:-5px;right:-5px;background:#DC2626;color:white;width:15px;height:15px;border-radius:50%;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;border:1.5px solid white;">!</div>' : '')
            + '</div>';

          var mIcon = L.divIcon({
            html: pinHtml,
            iconSize: [34, 34],
            iconAnchor: [17, 34],
            popupAnchor: [0, -32]
          });

          var marker = L.marker(oPos, { icon: mIcon }).addTo(map);

          var popupHtml = '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;min-width:210px;padding:2px;">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
            + '<b style="color:#0284C7;font-size:12px;">' + (o.broj_naloga || ('Nalog #' + o.id)) + '</b>'
            + (isUrgent ? '<span style="background:#FEE2E2;color:#DC2626;font-size:10px;font-weight:800;padding:1px 5px;border-radius:4px;">⚡ HITNO</span>' : '')
            + '</div>'
            + '<div style="font-size:13px;font-weight:800;color:#0F172A;margin-bottom:2px;">' + (o.klijent_ime || 'Klijent') + '</div>'
            + '<div style="font-size:11.5px;color:#475569;margin-bottom:4px;">📍 ' + (o.adresa || '') + (o.sprat_stan ? ' (' + o.sprat_stan + ')' : '') + '</div>'
            + '<div style="margin-bottom:6px;"><span style="display:inline-block;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;background:' + statusBg + ';color:' + pinColor + ';border:1px solid ' + statusBorder + ';">' + statusText + '</span></div>'
            + (o.opis_kvara ? '<div style="font-size:10.5px;color:#334155;background:#F8FAFC;padding:5px 7px;border-radius:6px;margin-bottom:6px;border:1px solid #E2E8F0;"><b>Kvar:</b> ' + o.opis_kvara + '</div>' : '')
            + '<button onclick="window.parentSelectOrder(' + o.id + ')" style="width:100%;padding:7px 0;background:#0284C7;color:white;border:none;border-radius:6px;font-size:11.5px;font-weight:800;cursor:pointer;">Otvori radni nalog ↗</button>'
            + '</div>';

          marker.bindPopup(popupHtml);
          markers['order_' + o.id] = marker;

          if (isFocused) {
            focusedMarkerToOpen = marker;
          }
        });

        // Trenutna lokacija majstora
        if (payload.workerLocation && payload.workerLocation.lat) {
          var mwPos = [payload.workerLocation.lat, payload.workerLocation.lng];
          bounds.push(mwPos);
          var mwIcon = L.divIcon({
            html: '<div style="background:#059669;color:white;width:34px;height:34px;border-radius:50%;border:2.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.4);font-size:16px;">🚗</div>',
            iconSize: [34, 34],
            iconAnchor: [17, 17],
            popupAnchor: [0, -16]
          });
          var mwm = L.marker(mwPos, { icon: mwIcon }).addTo(map);
          mwm.bindPopup('<b>🚗 Moja trenutna pozicija</b><br>' + (payload.workerLocation.name || 'Majstor na terenu'));
          markers['my_location'] = mwm;

          // Ako postoji fokusiran nalog sa koordinatama, crtamo rutu
          if (payload.focusedOrder && payload.focusedOrder.gpsX && payload.focusedOrder.gpsY) {
            var fPos = [parseFloat(payload.focusedOrder.gpsX), parseFloat(payload.focusedOrder.gpsY)];
            var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' + mwPos[1] + ',' + mwPos[0] + ';' + fPos[1] + ',' + fPos[0] + '?overview=full&geometries=geojson';
            fetch(osrmUrl).then(function(res){ return res.json(); }).then(function(d){
              if (d.routes && d.routes.length > 0) {
                var coords = d.routes[0].geometry.coordinates.map(function(pt) { return [pt[1], pt[0]]; });
                if (routeLine) map.removeLayer(routeLine);
                routeLine = L.polyline(coords, { color: '#0284C7', weight: 5, opacity: 0.9 }).addTo(map);
              }
            }).catch(function(){});
          }
        }

        if (focusedMarkerToOpen) {
          focusedMarkerToOpen.openPopup();
          map.setView(focusedMarkerToOpen.getLatLng(), 16);
          return;
        }

        if (bounds.length > 1) {
          map.fitBounds(bounds, { padding: [35, 35], maxZoom: 16 });
        } else if (bounds.length === 1) {
          map.setView(bounds[0], 15);
        }
        return;
      }

      // 4. REGULAR WORKER POJEDINACNI NALOG (OrderDetail)
      if (!payload.isDispatcher) {
        var cPos = null;
        if (payload.clientLocation && payload.clientLocation.lat) {
          cPos = [payload.clientLocation.lat, payload.clientLocation.lng];
          bounds.push(cPos);
          var cIcon = L.divIcon({
            html: '<div style="background:#EAB308;color:#713F12;width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.35);"><span style="transform:rotate(45deg);font-size:15px;font-weight:900;">📍</span></div>',
            iconSize: [34, 34],
            iconAnchor: [17, 34]
          });
          var cm = L.marker(cPos, { icon: cIcon }).addTo(map);
          cm.bindPopup('<b>📍 Klijent: ' + (payload.clientLocation.name || '') + '</b><br>' + (payload.clientLocation.address || ''));
          markers['client'] = cm;

          geofenceCircle = L.circle(cPos, { radius: 50, color: '#CA8A04', weight: 2, dashArray: '4, 4', fillColor: '#FEF08A', fillOpacity: 0.25 }).addTo(map);
        }

        if (payload.startLocation && payload.startLocation.lat) {
          var sPos = [payload.startLocation.lat, payload.startLocation.lng];
          bounds.push(sPos);
          var inZone = Boolean(payload.startLocation.inGeofence);
          var dist = payload.startLocation.distance || 0;
          var pinColor = inZone ? '#0284C7' : '#EA580C';
          var labelText = inZone ? ('✓ U opsegu (' + dist + 'm)') : ('⚠️ Van opsega (' + dist + 'm)');
          var sIcon = L.divIcon({
            html: '<div style="background:' + pinColor + ';color:white;padding:4px 8px;border-radius:12px;border:2px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.35);font-size:11px;font-weight:800;white-space:nowrap;">🔧 ' + labelText + '</div>',
            iconSize: [120, 26],
            iconAnchor: [60, 13]
          });
          var sm = L.marker(sPos, { icon: sIcon }).addTo(map);
          markers['startLocation'] = sm;

          if (cPos) {
            connectLine = L.polyline([cPos, sPos], { color: pinColor, weight: 3, dashArray: '5, 5', opacity: 0.85 }).addTo(map);
          }
        }

        if (payload.workerLocation && payload.workerLocation.lat) {
          var wPos = [payload.workerLocation.lat, payload.workerLocation.lng];
          bounds.push(wPos);
          var wIcon = L.divIcon({
            html: '<div style="background:#0284C7;color:white;width:34px;height:34px;border-radius:50%;border:2.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.4);font-size:16px;">🚗</div>',
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          });
          markers['worker'] = L.marker(wPos, { icon: wIcon }).addTo(map);

          if (cPos && (!payload.startLocation || !payload.startLocation.lat)) {
            var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' + payload.workerLocation.lng + ',' + payload.workerLocation.lat + ';' + payload.clientLocation.lng + ',' + payload.clientLocation.lat + '?overview=full&geometries=geojson';
            fetch(osrmUrl).then(function(res){ return res.json(); }).then(function(d){
              if (d.routes && d.routes.length > 0) {
                var coords = d.routes[0].geometry.coordinates.map(function(pt) { return [pt[1], pt[0]]; });
                if (routeLine) map.removeLayer(routeLine);
                routeLine = L.polyline(coords, { color: '#0284C7', weight: 5, opacity: 0.9 }).addTo(map);
              }
            }).catch(function(){});
          }
        }
      } else {
        // Dispečerski pregled terena
        // -------------------------------------------------------------
        // ISKLJUČIVO PRIKAZ ODABRANOG MAJSTORA I SVIH NJEGOVIH DOLAZNIH LOKACIJA (Bez prikaza svih majstora odjednom)
        // -------------------------------------------------------------
        var selId = payload.selectedWorkerId ? Number(payload.selectedWorkerId) : (payload.selectedWorker ? Number(payload.selectedWorker.id) : 0);
        var selWorker = (payload.workers || []).find(function(w) { return Number(w.id) === selId; });
        if (!selWorker && payload.workers && payload.workers.length > 0) {
          selWorker = payload.workers[0];
          selId = Number(selWorker.id);
        }

        var workerPos = null;
        if (selWorker) {
          if (selWorker.gpsX && selWorker.gpsY) {
            workerPos = [parseFloat(selWorker.gpsX), parseFloat(selWorker.gpsY)];
            bounds.push(workerPos);

            var wColor = selWorker.boja_markera || '#059669';
            var wIconHtml = '<div style="background:' + wColor + ';color:white;padding:5px 12px;border-radius:18px;border:2.5px solid white;box-shadow:0 4px 14px rgba(0,0,0,0.35);font-size:12px;font-weight:800;white-space:nowrap;display:flex;align-items:center;gap:4px;">'
              + '<span>🚗</span><span>' + selWorker.ime + (selWorker.prezime ? ' ' + selWorker.prezime : '') + '</span>'
              + '</div>';

            var wm = L.marker(workerPos, {
              icon: L.divIcon({ html: wIconHtml, iconSize: [140, 30], iconAnchor: [70, 15] })
            }).addTo(map);

            wm.bindPopup('<b>🚗 Majstor: ' + selWorker.ime + ' ' + (selWorker.prezime || '') + '</b><br>📞 ' + (selWorker.telefon || '-') + '<br>Status: ' + (selWorker.radni_status || 'Aktivan'));
            markers['selected_worker'] = wm;
          }

          // Nalozi odabranog majstora za odabrani datum
          var workerOrders = (payload.orders || []).filter(function(o) {
            return Number(o.majstor_id) === selId;
          });

          var focusedMarkerToOpen = null;

          workerOrders.forEach(function(o, idx) {
            var oLat = parseFloat(o.gpsX || o.klijent_gpsX || (o.lat ? o.lat : null));
            var oLng = parseFloat(o.gpsY || o.klijent_gpsY || (o.lng ? o.lng : null));
            if (!oLat || !oLng) return;

            var oPos = [oLat, oLng];
            bounds.push(oPos);

            var isFocused = payload.focusedOrder && Number(payload.focusedOrder.id) === Number(o.id);
            var status = o.status || 'DODELJENO';
            var isUrgent = o.prioritet === 'HITNO';

            var pinColor = '#0284C7';
            var statusText = 'Dodeljeno (čeka)';
            var statusBg = '#E0F2FE';
            var statusBorder = '#BAE6FD';

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
              var inGeo = (Number(o.start_u_opsegu) === 1);
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

            var orderNumClean = (o.broj_naloga || '').replace(/^[A-Za-z]+-[0-9]+-/, '');
            var badgeLabel = orderNumClean ? ('#' + orderNumClean) : (idx + 1);

            var pinHtml = '<div style="position:relative;display:flex;align-items:center;justify-content:center;">'
              + '<div style="background:' + pinColor + ';color:white;width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.35);' + (isFocused ? 'box-shadow:0 0 0 3px #F59E0B, 0 4px 14px rgba(0,0,0,0.5);' : '') + '">'
              + '<span style="transform:rotate(45deg);font-size:11px;font-weight:900;">' + badgeLabel + '</span>'
              + '</div>'
              + (isUrgent ? '<div style="position:absolute;top:-5px;right:-5px;background:#DC2626;color:white;width:15px;height:15px;border-radius:50%;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;border:1.5px solid white;">!</div>' : '')
              + '</div>';

            var mIcon = L.divIcon({
              html: pinHtml,
              iconSize: [34, 34],
              iconAnchor: [17, 34],
              popupAnchor: [0, -32]
            });

            var marker = L.marker(oPos, { icon: mIcon }).addTo(map);

            marker.on('click', function() {
              if (window.parentFocusOrder) {
                window.parentFocusOrder(o.id);
              }
            });

            var popupHtml = '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;min-width:220px;padding:2px;">'
              + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">'
              + '<b style="color:#0284C7;font-size:12px;">' + (o.broj_naloga || ('Nalog #' + o.id)) + '</b>'
              + (isUrgent ? '<span style="background:#FEE2E2;color:#DC2626;font-size:10px;font-weight:800;padding:1px 5px;border-radius:4px;">⚡ HITNO</span>' : '')
              + '</div>'
              + '<div style="font-size:13px;font-weight:800;color:#0F172A;margin-bottom:2px;">' + (o.klijent_ime || 'Klijent') + '</div>'
              + '<div style="font-size:11.5px;color:#475569;margin-bottom:4px;">📍 ' + (o.adresa || '') + (o.sprat_stan ? ' (' + o.sprat_stan + ')' : '') + '</div>'
              + '<div style="margin-bottom:6px;"><span style="display:inline-block;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;background:' + statusBg + ';color:' + pinColor + ';border:1px solid ' + statusBorder + ';">' + statusText + '</span></div>'
              + (o.opis_kvara ? '<div style="font-size:10.5px;color:#334155;background:#F8FAFC;padding:5px 7px;border-radius:6px;margin-bottom:6px;border:1px solid #E2E8F0;"><b>Kvar:</b> ' + o.opis_kvara + '</div>' : '')
              + '<button onclick="window.parentFocusOrder(' + o.id + ')" style="width:100%;padding:6px 0;background:#0284C7;color:white;border:none;border-radius:6px;font-size:11px;font-weight:800;cursor:pointer;margin-bottom:5px;">🚗 Prikaži putanju do lokacije</button>'
              + '<button onclick="window.parentSelectOrder(' + o.id + ')" style="width:100%;padding:6px 0;background:#F1F5F9;color:#334155;border:1px solid #CBD5E1;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">Otvori radni nalog ↗</button>'
              + '</div>';

            marker.bindPopup(popupHtml);
            markers['order_' + o.id] = marker;

            if (isFocused) {
              focusedMarkerToOpen = marker;
            }
          });

          // Iscrtavanje rute od lokacije majstora ISKLJUČIVO kada je nalog kliknut / fokusiran
          if (payload.focusedOrder) {
            var fLat = parseFloat(payload.focusedOrder.gpsX || payload.focusedOrder.klijent_gpsX || (payload.focusedOrder.lat ? payload.focusedOrder.lat : null));
            var fLng = parseFloat(payload.focusedOrder.gpsY || payload.focusedOrder.klijent_gpsY || (payload.focusedOrder.lng ? payload.focusedOrder.lng : null));
            if (workerPos && fLat && fLng) {
              var destPos = [fLat, fLng];
              var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' + workerPos[1] + ',' + workerPos[0] + ';' + destPos[1] + ',' + destPos[0] + '?overview=full&geometries=geojson';
              fetch(osrmUrl).then(function(res){ return res.json(); }).then(function(d){
                if (d.routes && d.routes.length > 0) {
                  var coords = d.routes[0].geometry.coordinates.map(function(pt) { return [pt[1], pt[0]]; });
                  if (routeLine) map.removeLayer(routeLine);
                  routeLine = L.polyline(coords, { color: '#0284C7', weight: 5, opacity: 0.9 }).addTo(map);
                }
              }).catch(function(){});
            }
          } else {
            if (routeLine) {
              map.removeLayer(routeLine);
              routeLine = null;
            }
          }

          if (focusedMarkerToOpen) {
            focusedMarkerToOpen.openPopup();
          }
        }
      }

      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 15);
      }
    }

    window.addEventListener('message', function(e) {
      try {
        var payload = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        renderLayers(payload);
      } catch(err){}
    });

    // Obavesti roditelja da je Leaflet spreman
    window.onload = function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
      } else if (window.parent) {
        window.parent.postMessage(JSON.stringify({ type: 'MAP_READY' }), '*');
      }
    };
  </script>
</body>
</html>
`;

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
  const webViewRef = useRef(null);
  const lastPayloadRef = useRef(null);

  const sendPayload = () => {
    const payload = {
      clientLocation,
      workerLocation,
      startLocation,
      orders,
      workers,
      isDispatcher,
      selectedWorkerId,
      selectedWorker,
      focusedOrder,
      isPinPickerMode
    };
    lastPayloadRef.current = payload;

    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify(payload));
    }
  };

  useEffect(() => {
    sendPayload();
  }, [clientLocation, workerLocation, startLocation, orders, workers, isDispatcher, selectedWorkerId, selectedWorker, focusedOrder, isPinPickerMode]);

  // Web event listener za primanje poruka od iframe-a
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleWebMsg = (e) => {
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (data?.type === 'MAP_READY') {
            if (lastPayloadRef.current && webViewRef.current) {
              webViewRef.current.postMessage(JSON.stringify(lastPayloadRef.current));
            }
          } else if (data?.type === 'FOCUS_ORDER' && onFocusOrder) {
            onFocusOrder(data.orderId);
          } else if (data?.type === 'SELECT_ORDER' && onSelectOrder) {
            onSelectOrder(data.orderId);
          } else if (data?.type === 'SELECT_WORKER' && onSelectWorker) {
            onSelectWorker(data.workerId);
          } else if (data?.type === 'PIN_MOVE_END' && onPinCoordsChange) {
            onPinCoordsChange({ lat: data.lat, lng: data.lng, isMoving: false });
          }
        } catch (err) {}
      };
      window.addEventListener('message', handleWebMsg);
      return () => window.removeEventListener('message', handleWebMsg);
    }
  }, [onSelectOrder, onFocusOrder, onSelectWorker, onPinCoordsChange]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: getMapHtml() }}
        style={{ flex: 1 }}
        onLoad={() => {
          setTimeout(sendPayload, 300);
        }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'MAP_READY') {
              sendPayload();
            } else if (data.type === 'PIN_MOVE_END' && onPinCoordsChange) {
              onPinCoordsChange({ lat: data.lat, lng: data.lng, isMoving: false });
            } else if (data.type === 'FOCUS_ORDER' && onFocusOrder) {
              onFocusOrder(data.orderId);
            } else if (data.type === 'SELECT_ORDER' && onSelectOrder) {
              onSelectOrder(data.orderId);
            } else if (data.type === 'SELECT_WORKER' && onSelectWorker) {
              onSelectWorker(data.workerId);
            }
          } catch (e) {}
        }}
      />
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
