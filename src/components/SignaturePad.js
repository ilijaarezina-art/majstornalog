import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { RotateCcw, Check, PenTool } from 'lucide-react-native';
import { colors } from '../theme/colors';

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html { width: 100%; height: 100%; overflow: hidden; background: #FFFFFF; }
    canvas { width: 100%; height: 100%; display: block; touch-action: none; }
  </style>
</head>
<body>
  <canvas id="c"></canvas>
  <script>
    var canvas = document.getElementById('c');
    var ctx = canvas.getContext('2d');
    var isDrawing = false;
    var hasSigned = false;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0F172A';
    }
    window.addEventListener('resize', resize);
    resize();

    function getPos(e) {
      var rect = canvas.getBoundingClientRect();
      var t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }

    function start(e) {
      e.preventDefault();
      isDrawing = true;
      var p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }

    function move(e) {
      if (!isDrawing) return;
      e.preventDefault();
      var p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      if (!hasSigned) {
        hasSigned = true;
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SIGNED' }));
        }
      }
    }

    function end() {
      isDrawing = false;
    }

    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);

    window.addEventListener('message', function(e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.action === 'CLEAR') {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          hasSigned = false;
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CLEARED' }));
          }
        } else if (msg.action === 'GET') {
          var dataUrl = canvas.toDataURL('image/png');
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DATA', url: dataUrl }));
          }
        }
      } catch(err) {}
    });
  </script>
</body>
</html>
`;

export default function SignaturePad({ onSave, onCancel, clientName }) {
  const webViewRef = useRef(null);
  const [hasSignature, setHasSignature] = useState(false);

  const handleMessage = (e) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.type === 'SIGNED') {
        setHasSignature(true);
      } else if (data.type === 'CLEARED') {
        setHasSignature(false);
      } else if (data.type === 'DATA' && data.url) {
        if (onSave) onSave(data.url);
      }
    } catch(err) {}
  };

  const handleClear = () => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ action: 'CLEAR' }));
    }
  };

  const handleConfirm = () => {
    if (webViewRef.current && hasSignature) {
      webViewRef.current.postMessage(JSON.stringify({ action: 'GET' }));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <PenTool size={18} color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={styles.title}>Digitalni potpis klijenta</Text>
        </View>
        {clientName ? (
          <Text style={styles.subtitle}>Klijent: <Text style={{ fontWeight: '700' }}>{clientName}</Text></Text>
        ) : null}
      </View>

      <View style={styles.canvasWrapper}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          onMessage={handleMessage}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          scrollEnabled={false}
        />
        <View style={styles.signLine} />
        <Text style={styles.signHint}>Potpišite se prstom iznad linije</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.8}>
          <RotateCcw size={16} color="#64748B" style={{ marginRight: 6 }} />
          <Text style={styles.clearText}>Obriši</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {onCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.cancelText}>Otkaži</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.confirmBtn, !hasSignature && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={!hasSignature}
            activeOpacity={0.8}
          >
            <Check size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.confirmText}>Prihvati potpis</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 8
  },
  header: {
    marginBottom: 12
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A'
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  canvasWrapper: {
    height: 180,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 10,
    position: 'relative',
    overflow: 'hidden'
  },
  signLine: {
    position: 'absolute',
    bottom: 34,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: '#E2E8F0'
  },
  signHint: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 11,
    color: '#94A3B8'
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9'
  },
  clearText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B'
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B'
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: colors.success
  },
  confirmBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.6
  },
  confirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
