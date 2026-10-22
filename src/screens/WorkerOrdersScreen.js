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
  Platform
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
  UserCheck
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme/colors';

export default function WorkerOrdersScreen({ onSelectOrder, onOpenDispatcher }) {
  const { user, logout, isOwner, isDispatcher } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    // Periodično osvežavanje naloga na svakih 15 sekundi
    const timer = setInterval(fetchOrders, 15000);
    return () => clearInterval(timer);
  }, [fetchOrders]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await api.updateOrderStatus(orderId, newStatus, user.id);
      await fetchOrders();
    } catch (err) {
      Alert.alert('Greška', err.message || 'Neuspešna promena statusa.');
    }
  };

  const handleCallClient = (phoneNumber) => {
    if (!phoneNumber) return;
    const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanNumber}`);
  };

  const handleOpenNavigation = (lat, lng, address) => {
    if (!lat || !lng) {
      Alert.alert('Lokacija', 'GPS koordinate adrese nisu definisane.');
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'U_RADU':
        return { label: 'U RADU', bg: colors.warningLight, text: colors.warning, border: colors.warning };
      case 'NA_PUTU':
        return { label: 'NA PUTU', bg: 'rgba(2, 132, 199, 0.12)', text: colors.primary, border: colors.primary };
      case 'ZAVRSENO':
        return { label: 'ZAVRŠENO', bg: colors.successLight, text: colors.success, border: colors.success };
      case 'DODELJENO':
        return { label: 'DODELJENO', bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
      default:
        return { label: status, bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' };
    }
  };

  const totalAssigned = orders.filter(o => o.status !== 'ZAVRSENO' && o.status !== 'STORNO').length;
  const inProgress = orders.filter(o => o.status === 'U_RADU' || o.status === 'NA_PUTU').length;
  const completedToday = orders.filter(o => o.status === 'ZAVRSENO').length;

  const renderOrderItem = ({ item }) => {
    const sb = getStatusBadge(item.status);
    const isUrgent = item.prioritet === 'HITNO';
    const isWorking = item.status === 'U_RADU';
    const isOnTheWay = item.status === 'NA_PUTU';
    const isDone = item.status === 'ZAVRSENO';

    return (
      <View style={[styles.card, isWorking && styles.cardActive, isDone && styles.cardDone]}>
        {/* Card Header: RN number, Priority, Status */}
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
            <Text style={[styles.statusBadgeText, { color: sb.text }]}>{sb.label}</Text>
          </View>
        </View>

        {/* Client Name & Phone */}
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

        {/* Address & Navigation Link */}
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
            <Text style={styles.navHint}>Kliknite za navigaciju ↗</Text>
          </View>
        </TouchableOpacity>

        {/* Appliance Info Box */}
        {item.uredjaj_kategorija ? (
          <View style={styles.applianceBox}>
            <Wrench size={14} color="#0369A1" style={{ marginRight: 6 }} />
            <Text style={styles.applianceText}>
              <Text style={{ fontWeight: '700' }}>{item.uredjaj_kategorija}:</Text>{' '}
              {item.uredjaj_proizvodjac || ''} {item.uredjaj_model || ''}
              {item.uredjaj_sn ? ` (S/N: ${item.uredjaj_sn})` : ''}
            </Text>
          </View>
        ) : null}

        {/* Problem Description */}
        {item.opis_kvara ? (
          <View style={styles.faultBox}>
            <Text style={styles.faultLabel}>Opis kvara / Zahtev:</Text>
            <Text style={styles.faultText}>{item.opis_kvara}</Text>
          </View>
        ) : null}

        {/* Action Buttons Toolbar */}
        <View style={styles.cardActions}>
          {!isDone && (
            <>
              {item.status === 'DODELJENO' && (
                <TouchableOpacity
                  style={styles.onWayBtn}
                  onPress={() => handleUpdateStatus(item.id, 'NA_PUTU')}
                  activeOpacity={0.8}
                >
                  <Truck size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.btnTextWhite}>Krenuo sam ka adresi</Text>
                </TouchableOpacity>
              )}

              {isOnTheWay && (
                <TouchableOpacity
                  style={styles.startWorkBtn}
                  onPress={() => handleUpdateStatus(item.id, 'U_RADU')}
                  activeOpacity={0.8}
                >
                  <Wrench size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.btnTextWhite}>Stigao sam / Započni rad</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          <TouchableOpacity
            style={[styles.detailBtn, isDone && { flex: 1 }]}
            onPress={() => onSelectOrder && onSelectOrder(item.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.detailBtnText}>
              {isDone ? 'Pregled završenog naloga' : (isWorking ? 'Otvori nalog i unesi delove' : 'Detalji naloga')}
            </Text>
            <ChevronRight size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>{user?.firma_naziv || 'MajstorNalog'}</Text>
          <Text style={styles.headerTitle}>
            Majstor: <Text style={{ color: colors.primary }}>{user?.ime} {user?.prezime}</Text>
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {(isOwner || isDispatcher) && onOpenDispatcher && (
            <TouchableOpacity
              style={styles.dispatcherPill}
              onPress={onOpenDispatcher}
              activeOpacity={0.8}
            >
              <UserCheck size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.dispatcherPillText}>Dispečer</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.iconBtn} onPress={fetchOrders} activeOpacity={0.8}>
            <RefreshCw size={18} color="#64748B" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} onPress={logout} activeOpacity={0.8}>
            <LogOut size={18} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Summary Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statPill}>
          <Text style={styles.statNum}>{totalAssigned}</Text>
          <Text style={styles.statText}>Za rad</Text>
        </View>

        <View style={[styles.statPill, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#E2E8F0' }]}>
          <Text style={[styles.statNum, { color: colors.warning }]}>{inProgress}</Text>
          <Text style={styles.statText}>U toku</Text>
        </View>

        <View style={styles.statPill}>
          <Text style={[styles.statNum, { color: colors.success }]}>{completedToday}</Text>
          <Text style={styles.statText}>Završeno</Text>
        </View>
      </View>

      {/* Orders List */}
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Učitavanje današnjih naloga...</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={fetchOrders} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <CheckCircle size={48} color={colors.success} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>Nema zaduženih naloga</Text>
              <Text style={styles.emptySubtitle}>Trenutno nemate aktivnih radnih naloga za današnji dan.</Text>
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
    backgroundColor: '#F8FAFC'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 14,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  headerSub: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2
  },
  dispatcherPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  dispatcherPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
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
    gap: 12
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  cardActive: {
    borderColor: colors.warning,
    borderWidth: 1.8
  },
  cardDone: {
    opacity: 0.85,
    backgroundColor: '#FAFCFF'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A'
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  urgentText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#DC2626'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800'
  },
  clientSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  clientName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1
  },
  callPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  callPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  addressSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  addressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155'
  },
  navHint: {
    fontSize: 10.5,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 3
  },
  applianceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD'
  },
  applianceText: {
    fontSize: 12,
    color: '#0369A1'
  },
  faultBox: {
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7'
  },
  faultLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 2
  },
  faultText: {
    fontSize: 12.5,
    color: '#78350F'
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  onWayBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8
  },
  startWorkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warning,
    paddingVertical: 10,
    borderRadius: 8
  },
  btnTextWhite: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800'
  },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  detailBtnText: {
    color: colors.primary,
    fontSize: 12.5,
    fontWeight: '700',
    marginRight: 4
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  loaderText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600'
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center'
  }
});
