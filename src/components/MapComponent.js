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
    var pinPickerInit = false;

    var isPinPickerCurrent = false;

    map.on('moveend', function() {
      var center = map.getCenter();
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PIN_MOVE_END', lat: center.lat, lng: center.lng }));
      }
    });

    map.on('click', function(e) {
      if (isPinPickerCurrent) {
        map.panTo(e.latlng);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PIN_MOVE_END', lat: e.latlng.lat, lng: e.latlng.lng }));
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

      // 2. FOCUSED ORDER MODE
      if (payload.focusedOrder) {
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

      // 3. REGULAR WORKER / DISPATCHER
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
        // Dispečerski pregled terena (Prikaz samo aktivnih majstora i pozicije ulogovanog korisnika)
        // Radni nalog se na mapi prikazuje TEK KADA SE KLIKNE NA NJEGA!
        (payload.workers || []).forEach(function(w) {
          var isFree = !w.radni_status || w.radni_status === 'SLOBODAN' || w.radni_status === 'NEAKTIVAN';
          if (w.gpsX && w.gpsY && !isFree) {
            var pos = [parseFloat(w.gpsX), parseFloat(w.gpsY)];
            bounds.push(pos);
            var icon = L.divIcon({
              html: '<div style="background:' + (w.boja_markera || '#059669') + ';color:white;padding:3px 8px;border-radius:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-size:11px;font-weight:700;white-space:nowrap;">🚗 ' + w.ime + '</div>',
              iconSize: [80, 26],
              iconAnchor: [40, 13]
            });
            markers['w_' + w.id] = L.marker(pos, { icon: icon }).addTo(map);
          }
        });

        if (payload.workerLocation && payload.workerLocation.lat) {
          var uPos = [parseFloat(payload.workerLocation.lat), parseFloat(payload.workerLocation.lng)];
          bounds.push(uPos);
          var uIcon = L.divIcon({
            html: '<div style="background:#0284C7;color:white;width:34px;height:34px;border-radius:50%;border:2.5px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.4);font-size:16px;">🏢</div>',
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          });
          markers['dispatcher_me'] = L.marker(uPos, { icon: uIcon }).addTo(map);
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
  focusedOrder = null,
  isPinPickerMode = false,
  onPinCoordsChange = null,
  height = 320
}) {
  const webViewRef = useRef(null);

  useEffect(() => {
    if (webViewRef.current) {
      const payload = {
        clientLocation,
        workerLocation,
        startLocation,
        orders,
        workers,
        isDispatcher,
        focusedOrder,
        isPinPickerMode
      };
      webViewRef.current.postMessage(JSON.stringify(payload));
    }
  }, [clientLocation, workerLocation, startLocation, orders, workers, isDispatcher, focusedOrder, isPinPickerMode]);

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: getMapHtml() }}
        style={{ flex: 1 }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'PIN_MOVE_END' && onPinCoordsChange) {
              onPinCoordsChange({ lat: data.lat, lng: data.lng, isMoving: false });
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
