import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const getMapHtml = (data) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; background:#F1F5F9; }
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

    function renderLayers(payload) {
      Object.values(markers).forEach(function(m) { map.removeLayer(m); });
      markers = {};
      if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
      if (geofenceCircle) { map.removeLayer(geofenceCircle); geofenceCircle = null; }
      if (connectLine) { map.removeLayer(connectLine); connectLine = null; }

      var bounds = [];
      if (!payload.isDispatcher) {
        var cPos = null;

        // 1. Lokacija klijenta: žuta čioda + 50m geofence krug
        if (payload.clientLocation && payload.clientLocation.lat) {
          cPos = [payload.clientLocation.lat, payload.clientLocation.lng];
          bounds.push(cPos);
          var cIcon = L.divIcon({
            className: 'c-pin',
            html: '<div style="background:#EAB308;color:#713F12;width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.35);"><span style="transform:rotate(45deg);font-size:15px;font-weight:900;">📍</span></div>',
            iconSize: [34, 34],
            iconAnchor: [17, 34]
          });
          var cm = L.marker(cPos, { icon: cIcon }).addTo(map);
          cm.bindPopup('<b>📍 Klijent: ' + (payload.clientLocation.name || '') + '</b><br>' + (payload.clientLocation.address || ''));
          markers['client'] = cm;

          // Geofence krug dolazne stanice od 50 metara oko adrese klijenta
          geofenceCircle = L.circle(cPos, {
            radius: 50,
            color: '#CA8A04',
            weight: 2,
            dashArray: '4, 4',
            fillColor: '#FEF08A',
            fillOpacity: 0.25
          }).addTo(map);
          geofenceCircle.bindPopup('Dozvoljena zona dolaska na adresu (50m)');
        }

        // 2. Lokacija majstora u momentu početka posla (startLocation)
        if (payload.startLocation && payload.startLocation.lat) {
          var sPos = [payload.startLocation.lat, payload.startLocation.lng];
          bounds.push(sPos);
          var inZone = Boolean(payload.startLocation.inGeofence);
          var dist = payload.startLocation.distance || 0;
          var pinColor = inZone ? '#0284C7' : '#EA580C';
          var labelText = inZone ? ('✓ U opsegu (' + dist + 'm)') : ('⚠️ Van opsega (' + dist + 'm)');
          var sIcon = L.divIcon({
            className: 's-pin',
            html: '<div style="background:' + pinColor + ';color:white;padding:4px 8px;border-radius:12px;border:2px solid white;box-shadow:0 3px 8px rgba(0,0,0,0.35);font-size:11px;font-weight:800;white-space:nowrap;">🔧 ' + labelText + '</div>',
            iconSize: [120, 26],
            iconAnchor: [60, 13]
          });
          var sm = L.marker(sPos, { icon: sIcon }).addTo(map);
          sm.bindPopup('<b>Lokacija majstora na početku rada:</b><br>' + labelText + '<br>Razdaljina od klijenta: ' + dist + ' m');
          markers['startLocation'] = sm;

          // Iscrtavanje linije između lokacije klijenta i mesta starta
          if (cPos) {
            connectLine = L.polyline([cPos, sPos], {
              color: pinColor,
              weight: 3,
              dashArray: '5, 5',
              opacity: 0.85
            }).addTo(map);
          }
        }

        // 3. Trenutna lokacija majstora (ako je na putu ili terenu)
        if (payload.workerLocation && payload.workerLocation.lat) {
          var wPos = [payload.workerLocation.lat, payload.workerLocation.lng];
          bounds.push(wPos);
          var wIcon = L.divIcon({
            className: 'w-pin',
            html: '<div style="background:#0284C7;color:white;width:34px;height:34px;border-radius:50%;border:2.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.4);font-size:16px;">🚗</div>',
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          });
          markers['worker'] = L.marker(wPos, { icon: wIcon }).addTo(map);

          // Ruta ako postoji klijent i nalog je još na putu
          if (cPos && (!payload.startLocation || !payload.startLocation.lat)) {
            var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' + payload.workerLocation.lng + ',' + payload.workerLocation.lat + ';' + payload.clientLocation.lng + ',' + payload.clientLocation.lat + '?overview=full&geometries=geojson';
            fetch(osrmUrl)
              .then(function(res) { return res.json(); })
              .then(function(d) {
                if (d.routes && d.routes.length > 0) {
                  var coords = d.routes[0].geometry.coordinates.map(function(pt) { return [pt[1], pt[0]]; });
                  if (routeLine) map.removeLayer(routeLine);
                  routeLine = L.polyline(coords, { color: '#0284C7', weight: 5, opacity: 0.9 }).addTo(map);
                }
              }).catch(function(){});
          }
        }
      } else {
        // Dispečerski prikaz: Ekipe na terenu
        (payload.workers || []).forEach(function(w) {
          if (w.gpsX && w.gpsY) {
            var pos = [w.gpsX, w.gpsY];
            bounds.push(pos);
            var icon = L.divIcon({
              html: '<div style="background:' + (w.boja_markera || '#059669') + ';color:white;padding:3px 8px;border-radius:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-size:11px;font-weight:700;white-space:nowrap;">🚗 ' + w.ime + '</div>',
              iconSize: [80, 26],
              iconAnchor: [40, 13]
            });
            markers['w_' + w.id] = L.marker(pos, { icon: icon }).addTo(map);
          }
        });

        // Dispečerski prikaz: Radni nalozi (Pravila boja):
        // 1. ZAVRŠENI = ZELENA (#059669)
        // 2. NIJE KLIKNUTO U OPSEGU 50m = CRVENA (#DC2626)
        // 3. NEZAVRŠENI / U TOKU U OPSEGU = PLAVA (#0284C7)
        (payload.orders || []).forEach(function(o) {
          if (o.gpsX && o.gpsY) {
            var pos = [o.gpsX, o.gpsY];
            bounds.push(pos);
            var sColor;
            var statusDesc;

            if (o.status === 'ZAVRSENO') {
              sColor = '#059669'; // Zelena: završeni nalozi
              statusDesc = 'ZAVRŠENO ✓';
            } else if (Number(o.start_u_opsegu) === 0) {
              sColor = '#DC2626'; // Crvena: startovan van opsega 50m!
              statusDesc = 'START VAN OPSEGA (' + (o.start_udaljenost_m || '?') + 'm) ⚠️';
            } else {
              sColor = '#0284C7'; // Plava: aktivne nezavršene lokacije u opsegu
              statusDesc = o.status === 'U_RADU' ? 'U RADU (U OPSEGU)' : (o.status === 'NA_PUTU' ? 'NA PUTU' : 'ČEKA');
            }

            var icon = L.divIcon({
              html: '<div style="background:' + sColor + ';color:white;width:30px;height:30px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 7px rgba(0,0,0,0.4);font-size:12px;font-weight:900;">' + (o.broj_naloga ? o.broj_naloga.split('-').pop() : 'N') + '</div>',
              iconSize: [30, 30],
              iconAnchor: [15, 15]
            });
            var m = L.marker(pos, { icon: icon }).addTo(map);
            m.bindPopup('<b>' + (o.broj_naloga || '') + ' - ' + (o.klijent_ime || '') + '</b><br>' + (o.adresa || '') + '<br><span style="color:' + sColor + ';font-weight:800;">' + statusDesc + '</span>');
            markers['o_' + o.id] = m;
          }
        });
      }

      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 15);
      }
    }

    window.addEventListener('resize', function() {
      if (map) {
        setTimeout(function() { map.invalidateSize(); }, 200);
      }
    });

    window.addEventListener('message', function(e) {
      try {
        var payload = JSON.parse(e.data);
        renderLayers(payload);
      } catch(err){}
    });
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
  height = 320
}) {
  const webViewRef = useRef(null);

  const payload = {
    clientLocation,
    workerLocation,
    startLocation,
    orders,
    workers,
    isDispatcher
  };

  useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify(payload));
    }
  }, [clientLocation, workerLocation, startLocation, orders, workers, isDispatcher]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: getMapHtml(payload) }}
        style={{ flex: 1, backgroundColor: '#F1F5F9' }}
        onLoadEnd={() => {
          if (webViewRef.current) {
            webViewRef.current.postMessage(JSON.stringify(payload));
          }
        }}
        scrollEnabled={false}
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
    backgroundColor: '#F1F5F9',
    elevation: 3
  }
});
