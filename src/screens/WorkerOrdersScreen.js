import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
  Platform,
  useWindowDimensions
} from 'react-native';
import {
  Phone,
  MapPin,
  Clock,
  Wrench,
  CheckCircle,
  Truck,
  AlertTriangle,
  LogOut,
  RefreshCw,
  ChevronRight,
  UserCheck,
  CheckCheck,
  Navigation,
  Inbox,
  Play,
  RotateCcw,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  Compass
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import MapComponent from '../components/MapComponent';

export default function WorkerOrdersScreen({ onSelectOrder }) {
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // GPS praćenje lokacije majstora na mapi
  const [myLocation, setMyLocation] = useState(null);
  const [focusedOrder, setFocusedOrder] = useState(null);
  const [mapExpanded, setMapExpanded] = useState(true);

  // Preuzimanje i slanje GPS lokacije majstora na server
  useEffect(() => {
    if (!user?.id) return;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      let lastSent = 0;
      const handlePos = (pos) => {
        if (!pos || !pos.coords) return;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMyLocation({
          lat,
          lng,
          name: `${user?.ime || 'Majstor'} (Moja lokacija)`
        });

        const now = Date.now();
        if (now - lastSent >= 10000) {
          lastSent = now;
          api.updateLocation(user.id, user.firma_id, {
            x_koordinata: lat,
            y_koordinata: lng,
            lat,
            lng,
            speed: pos.coords.speed || 0,
            heading: pos.coords.heading || 0,
            log_in_out: 1
          }).catch(() => {});
        }
      };

      navigator.geolocation.getCurrentPosition(handlePos, () => {}, {
        enableHighAccuracy: true,
        timeout: 10000
      });

      const watchId = navigator.geolocation.watchPosition(handlePos, () => {}, {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      });

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [user?.id, user?.firma_id, user?.ime]);

  const fetchOrders = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await api.getMyOrders(user.id);
      setOrders(data || []);
    } catch (err) {
      console.warn('Greška pri dohvatanju naloga:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchOrders();
    const timer = setInterval(fetchOrders, 15000);
    return () => clearInterval(timer);
  }, [fetchOrders]);

  const handleUpdateStatus = async (orderId, newStatus, reason = '') => {
    setActionLoading(orderId);
    try {
      await api.updateOrderStatus(orderId, newStatus, user.id, '', reason);
      await fetchOrders();
    } catch (err) {
      Alert.alert('Greška', err.message || 'Neuspešna promena statusa.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCallClient = (phoneNumber) => {
    if (!phoneNumber) return;
    const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanNumber}`);
  };

  const handleOpenNavigation = (lat, lng, address) => {
    if (!lat || !lng) {
      Alert.alert('Lokacija', 'GPS koordinate adrese nisu unete.');
      return;
    }
    const label = encodeURIComponent(address || 'Klijent');
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `google.navigation:q=${lat},${lng}`,
      web: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    });
    Linking.openURL(url);
  };

  // Standardizovana značka statusa sa bojom i ikonicom
  const getStatusBadge = (status, item = null) => {
    switch (status) {
      case 'DODELJENO':
        return {
          step: 1,
          label: '1. ČEKA PRIHVATANJE',
          bg: '#F1F5F9',
          color: '#475569',
          border: '#CBD5E1',
          icon: Inbox
        };
      case 'PRIHVACENO':
        return {
          step: 2,
          label: '2. PRIHVAĆENO (SPREMAN)',
          bg: '#E0F2FE',
          color: '#0284C7',
          border: '#BAE6FD',
          icon: CheckCheck
        };
      case 'NA_PUTU':
        return {
          step: 3,
          label: '3. NA PUTU KA ADRESI',
          bg: '#EEF2FF',
          color: '#4F46E5',
          border: '#C7D2FE',
          icon: Truck
        };
      case 'U_RADU':
        return {
          step: 4,
          label: '4. U RADU NA LOKACIJI',
          bg: '#FEF3C7',
          color: '#D97706',
          border: '#FDE68A',
          icon: Wrench
        };
      case 'ODLOZENO':
        return {
          step: 0,
          label: 'ODLOŽEN NALOG',
          bg: '#FEE2E2',
          color: '#DC2626',
          border: '#FECACA',
          icon: AlertTriangle
        };
      case 'ZAVRSENO': {
        const inGeofence = item ? (Number(item.start_u_opsegu) === 1) : true;
        if (!inGeofence) {
          return {
            step: 5,
            label: '5. ZAVRŠENO I OVERENO',
            bg: '#DC2626',
            color: '#FFFFFF',
            border: '#B91C1C',
            icon: CheckCircle
          };
        }
        return {
          step: 5,
          label: '5. ZAVRŠENO I OVERENO',
          bg: '#DEF7EC',
          color: colors.success,
          border: '#BCF0DA',
          icon: CheckCircle
        };
      }
      default:
        return {
          step: 0,
          label: status,
          bg: '#F1F5F9',
          color: '#64748B',
          border: '#E2E8F0',
          icon: Clock
        };
    }
  };

  const totalOrders = orders.length;
  const inProgress = orders.filter(o => ['PRIHVACENO', 'NA_PUTU', 'U_RADU'].includes(o.status)).length;
  const completedToday = orders.filter(o => o.status === 'ZAVRSENO').length;
  const ordersWithGps = orders.filter(o => parseFloat(o.gpsX) && parseFloat(o.gpsY));

  const renderOrderItem = ({ item }) => {
    const sb = getStatusBadge(item.status, item);
    const StatusIcon = sb.icon;
    const isUrgent = item.prioritet === 'HITNO';
    const isDone = item.status === 'ZAVRSENO';
    const isBusy = actionLoading === item.id;
    const hasGps = Boolean(parseFloat(item.gpsX) && parseFloat(item.gpsY));
    const isFocused = focusedOrder && Number(focusedOrder.id) === Number(item.id);

    return (
      <View style={[styles.card, isFocused && styles.cardFocused]}>
        {/* Card Header: RN Number, Priority, Status */}
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.orderNumber}>{item.broj_naloga}</Text>
            {isUrgent && (
              <View style={styles.urgentBadge}>
                <AlertTriangle size={11} color="#DC2626" style={{ marginRight: 3 }} />
                <Text style={styles.urgentText}>HITNO</Text>
              </View>
            )}
          </View>

          <View style={[styles.statusBadge, { backgroundColor: sb.bg, borderColor: sb.border }]}>
            <StatusIcon size={12} color={sb.color} style={{ marginRight: 4 }} />
            <Text style={[styles.statusBadgeText, { color: sb.color }]}>{sb.label}</Text>
          </View>
        </View>

        {/* Client & Phone */}
        <View style={styles.clientSection}>
          <Text style={styles.clientName}>{item.klijent_ime}</Text>
          <TouchableOpacity
            style={styles.callPill}
            onPress={() => handleCallClient(item.klijent_telefon)}
            activeOpacity={0.8}
          >
            <Phone size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.callPillText}>{item.klijent_telefon}</Text>
          </TouchableOpacity>
        </View>

        {/* Address & Navigation */}
        <View style={styles.addressContainer}>
          <TouchableOpacity
            style={styles.addressSection}
            onPress={() => handleOpenNavigation(item.gpsX, item.gpsY, item.adresa)}
            activeOpacity={0.7}
          >
            <MapPin size={16} color={colors.primary} style={{ marginRight: 6, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressText} numberOfLines={2}>
                {item.adresa}
                {item.sprat_stan ? ` (${item.sprat_stan})` : ''}
              </Text>
              <Text style={styles.navHint}>Kliknite za GPS navigaciju ↗</Text>
            </View>
          </TouchableOpacity>

          {hasGps && (
            <TouchableOpacity
              style={[styles.mapFocusBtn, isFocused && styles.mapFocusBtnActive]}
              onPress={() => {
                if (isFocused) {
                  setFocusedOrder(null);
                } else {
                  setFocusedOrder(item);
                  setMapExpanded(true);
                }
              }}
              activeOpacity={0.8}
            >
              <Compass size={13} color={isFocused ? '#FFFFFF' : '#0284C7'} style={{ marginRight: 4 }} />
              <Text style={[styles.mapFocusBtnText, isFocused && styles.mapFocusBtnTextActive]}>
                {isFocused ? 'Označen na mapi' : 'Prikaži na mapi'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Appliance info */}
        {item.uredjaj_kategorija ? (
          <View style={styles.applianceBox}>
            <Wrench size={13} color="#0369A1" style={{ marginRight: 6 }} />
            <Text style={styles.applianceText}>
              <Text style={{ fontWeight: '700' }}>{item.uredjaj_kategorija}:</Text>{' '}
              {item.uredjaj_proizvodjac || ''} {item.uredjaj_model || ''}
              {item.uredjaj_sn ? ` (S/N: ${item.uredjaj_sn})` : ''}
            </Text>
          </View>
        ) : null}

        {/* Fault description */}
        {item.opis_kvara ? (
          <View style={styles.faultBox}>
            <Text style={styles.faultLabel}>Prijavljeni kvar od klijenta:</Text>
            <Text style={styles.faultText}>{item.opis_kvara}</Text>
          </View>
        ) : null}

        {/* Standardized Action Toolbar */}
        <View style={styles.cardActions}>
          {/* Primary Action Button according to Lifecycle */}
          {item.status === 'DODELJENO' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={() => handleUpdateStatus(item.id, 'PRIHVACENO')}
              disabled={isBusy}
              activeOpacity={0.8}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <CheckCheck size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.btnTextWhite}>Prihvati nalog</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {item.status === 'PRIHVACENO' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.onWayBtn]}
              onPress={() => handleUpdateStatus(item.id, 'NA_PUTU')}
              disabled={isBusy}
              activeOpacity={0.8}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Truck size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.btnTextWhite}>Kreni ka adresi</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {item.status === 'NA_PUTU' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.startWorkBtn]}
              onPress={() => handleUpdateStatus(item.id, 'U_RADU')}
              disabled={isBusy}
              activeOpacity={0.8}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Play size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.btnTextWhite}>Stigao sam / Započni rad</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {item.status === 'U_RADU' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.workingBtn]}
              onPress={() => onSelectOrder && onSelectOrder(item.id)}
              activeOpacity={0.8}
            >
              <Wrench size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnTextWhite}>Otvori / Unesi delove</Text>
            </TouchableOpacity>
          )}

          {item.status === 'ODLOZENO' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={() => handleUpdateStatus(item.id, 'PRIHVACENO', 'Ponovno pokretanje')}
              disabled={isBusy}
              activeOpacity={0.8}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <RotateCcw size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.btnTextWhite}>Ponovo prihvati</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Secondary Details Button */}
          <TouchableOpacity
            style={[styles.detailBtn, isDone && { flex: 1 }]}
            onPress={() => onSelectOrder && onSelectOrder(item.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.detailBtnText}>
              {isDone ? 'Pregled završenog naloga' : 'Detalji naloga'}
            </Text>
            <ChevronRight size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Sekcija sa mapom dolaznih lokacija za majstora
  const renderMapSection = () => {
    return (
      <View style={styles.mapCard}>
        <View style={styles.mapHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <MapPin size={17} color="#0284C7" />
            <Text style={styles.mapCardTitle}>
              Dolazne lokacije za danas ({ordersWithGps.length})
            </Text>
          </View>

          {focusedOrder && (
            <TouchableOpacity
              style={styles.clearFocusBtn}
              onPress={() => setFocusedOrder(null)}
              activeOpacity={0.7}
            >
              <X size={12} color="#DC2626" style={{ marginRight: 3 }} />
              <Text style={styles.clearFocusText}>Poništi fokus: {focusedOrder.broj_naloga}</Text>
            </TouchableOpacity>
          )}

          {!isDesktop && (
            <TouchableOpacity
              style={styles.mapToggleBtn}
              onPress={() => setMapExpanded(!mapExpanded)}
              activeOpacity={0.7}
            >
              {mapExpanded ? <ChevronUp size={16} color="#64748B" /> : <ChevronDown size={16} color="#64748B" />}
            </TouchableOpacity>
          )}
        </View>

        {(mapExpanded || isDesktop) && (
          <View style={styles.mapWrapper}>
            <MapComponent
              orders={orders}
              workerLocation={myLocation}
              focusedOrder={focusedOrder}
              onSelectOrder={onSelectOrder}
              height={isDesktop ? 520 : 260}
            />

            {/* Legenda statusa na mapi */}
            <View style={styles.mapLegendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#0284C7' }]} />
                <Text style={styles.legendText}>Dodeljeno/Prihvaćeno</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#4F46E5' }]} />
                <Text style={styles.legendText}>Na putu</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#D97706' }]} />
                <Text style={styles.legendText}>U radu</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#059669' }]} />
                <Text style={styles.legendText}>Završeno</Text>
              </View>
              {myLocation && (
                <View style={styles.legendItem}>
                  <Text style={{ fontSize: 11 }}>🚗</Text>
                  <Text style={[styles.legendText, { fontWeight: '700', color: '#059669' }]}>Moja pozicija</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Bar majstora (potpuno odvojena forma bez dispečerskih opcija) */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Moji radni nalozi</Text>
          <Text style={styles.headerSub}>
            Majstor: <Text style={{ fontWeight: '800', color: '#0F172A' }}>{user?.ime} {user?.prezime}</Text> • {user?.firma_naziv || 'Servisna služba'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.iconBtn} onPress={fetchOrders} activeOpacity={0.7}>
            <RefreshCw size={17} color="#475569" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#FEE2E2' }]} onPress={logout} activeOpacity={0.7}>
            <LogOut size={17} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Counter Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statPill}>
          <Text style={styles.statNum}>{totalOrders}</Text>
          <Text style={styles.statText}>Dodeljeno danas</Text>
        </View>
        <View style={[styles.statPill, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#E2E8F0' }]}>
          <Text style={[styles.statNum, { color: '#0284C7' }]}>{inProgress}</Text>
          <Text style={styles.statText}>U radu / Na putu</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={[styles.statNum, { color: colors.success }]}>{completedToday}</Text>
          <Text style={styles.statText}>Završeno</Text>
        </View>
      </View>

      {/* Sadržaj naloga: Desktop dvokolonski prikaz ili Mobilni vertikalni raspored */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Učitavanje dodeljenih radnih naloga...</Text>
        </View>
      ) : isDesktop ? (
        <View style={styles.desktopLayout}>
          {/* Leva kolona: Mapa dolaznih lokacija */}
          <View style={styles.desktopMapCol}>
            {renderMapSection()}
          </View>

          {/* Desna kolona: Lista naloga */}
          <View style={styles.desktopListCol}>
            <FlatList
              data={orders}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderOrderItem}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={fetchOrders} />
              }
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <CheckCircle size={48} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>Nemate dodeljenih naloga za danas</Text>
                  <Text style={styles.emptySub}>Čim dispečer dodeli novi nalog, on će se automatski pojaviti na mapi i u listi.</Text>
                </View>
              }
            />
          </View>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderMapSection}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={fetchOrders} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <CheckCircle size={48} color="#94A3B8" />
              <Text style={styles.emptyTitle}>Nemate dodeljenih naloga za danas</Text>
              <Text style={styles.emptySub}>Čim dispečer dodeli novi nalog, on će se automatski pojaviti na mapi i u listi.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A'
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statNum: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A'
  },
  statText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600'
  },
  listContent: {
    padding: 14,
    gap: 12,
    paddingBottom: 28
  },

  // Desktop raspored u 2 kolone
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
    padding: 14,
    gap: 14
  },
  desktopMapCol: {
    flex: 1.1
  },
  desktopListCol: {
    flex: 1
  },

  // Mapa dolaznih lokacija
  mapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  mapHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  mapCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A'
  },
  clearFocusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6
  },
  clearFocusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626'
  },
  mapToggleBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  mapWrapper: {
    padding: 10
  },
  mapLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 8,
    paddingHorizontal: 4,
    alignItems: 'center'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5
  },
  legendText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600'
  },

  // Kartica radnog naloga majstora
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  cardFocused: {
    borderColor: '#0284C7',
    borderWidth: 2,
    backgroundColor: '#F0F9FF'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.slate900
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  urgentText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626'
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800'
  },
  clientSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  clientName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1
  },
  callPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20
  },
  callPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  addressContainer: {
    marginBottom: 10
  },
  addressSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  addressText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155'
  },
  navHint: {
    fontSize: 10.5,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 2
  },
  mapFocusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD'
  },
  mapFocusBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7'
  },
  mapFocusBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7'
  },
  mapFocusBtnTextActive: {
    color: '#FFFFFF'
  },
  applianceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E0F2FE'
  },
  applianceText: {
    fontSize: 12,
    color: '#0369A1',
    flex: 1
  },
  faultBox: {
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B'
  },
  faultLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2
  },
  faultText: {
    fontSize: 12,
    color: '#334155'
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4
  },
  actionBtn: {
    flex: 1.2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 8
  },
  acceptBtn: {
    backgroundColor: '#0284C7'
  },
  onWayBtn: {
    backgroundColor: '#4F46E5'
  },
  startWorkBtn: {
    backgroundColor: '#D97706'
  },
  workingBtn: {
    backgroundColor: '#059669'
  },
  btnTextWhite: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800'
  },
  detailBtn: {
    flex: 0.9,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  detailBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginRight: 4
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B'
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 10
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155'
  },
  emptySub: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 280
  }
});