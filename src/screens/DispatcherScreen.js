import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  useWindowDimensions
} from 'react-native';
import {
  Users,
  Briefcase,
  MapPin,
  RefreshCw,
  LogOut,
  ArrowLeft,
  Clock,
  CheckCircle,
  Truck,
  Wrench,
  AlertTriangle
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import MapComponent from '../components/MapComponent';

export default function DispatcherScreen({ onBackToWorker }) {
  const { user, firmId, logout } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [orders, setOrders] = useState([]);

  const loadDashboard = useCallback(async () => {
    try {
      const data = await api.getDispatcherDashboard(firmId);
      setWorkers(data.workers || []);
      setOrders(data.orders || []);
    } catch (err) {
      console.warn('Greška dispečera:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [firmId]);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 10000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'U_RADU':
        return { label: 'U RADU', color: colors.warning };
      case 'NA_PUTU':
        return { label: 'NA PUTU', color: colors.primary };
      case 'ZAVRSENO':
        return { label: 'ZAVRŠENO', color: colors.success };
      default:
        return { label: 'ČEKA RED', color: '#64748B' };
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {onBackToWorker && (
            <TouchableOpacity style={styles.backBtn} onPress={onBackToWorker} activeOpacity={0.8}>
              <ArrowLeft size={18} color="#0F172A" />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerSub}>{user?.firma_naziv || 'MajstorNalog'} • Dispečerska tabla</Text>
            <Text style={styles.headerTitle}>Pregled terena i radnih naloga</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity style={styles.iconBtn} onPress={loadDashboard} activeOpacity={0.8}>
            <RefreshCw size={18} color="#64748B" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={logout} activeOpacity={0.8}>
            <LogOut size={18} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Body */}
      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Učitavanje dispečerske table...</Text>
        </View>
      ) : (
        <View style={[styles.mainBody, isDesktop && styles.mainBodyDesktop]}>
          {/* Left Column: Interactive Map */}
          <View style={[styles.mapCol, isDesktop && { flex: 1.2 }]}>
            <View style={styles.mapCard}>
              <View style={styles.mapHeaderBar}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
                  <View>
                    <Text style={styles.mapHeaderTitle}>Karta terena uživo (Majstori i intervencije)</Text>
                    <Text style={styles.mapHeaderSub}>{workers.length} majstora • {orders.length} naloga danas</Text>
                  </View>
                  {/* Legenda boja na mapi */}
                  <View style={styles.mapLegendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#059669' }]} />
                      <Text style={styles.legendText}>Završeno</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#0284C7' }]} />
                      <Text style={styles.legendText}>U opsegu (50m)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
                      <Text style={styles.legendText}>Van opsega (&gt;50m)</Text>
                    </View>
                  </View>
                </View>
              </View>

              <MapComponent
                isDispatcher={true}
                workers={workers}
                orders={orders}
                height={isDesktop ? 550 : 280}
              />
            </View>
          </View>

          {/* Right Column: Workers & Orders lists */}
          <ScrollView
            style={[styles.listCol, isDesktop && { flex: 1 }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadDashboard} />}
          >
            {/* Active Workers List */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Users size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>Ekipe na terenu ({workers.length})</Text>
              </View>

              <View style={{ gap: 8, marginTop: 8 }}>
                {workers.map(w => (
                  <View key={w.id} style={styles.workerRow}>
                    <View style={[styles.workerAvatar, { backgroundColor: w.boja_markera || '#059669' }]}>
                      <Text style={styles.workerAvatarText}>{w.ime.charAt(0)}{w.prezime.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.workerName}>{w.ime} {w.prezime}</Text>
                      <Text style={styles.workerPhone}>{w.telefon}</Text>
                    </View>
                    <View style={styles.workerStatusPill}>
                      <Text style={styles.workerStatusText}>{w.radni_status || 'SLOBODAN'}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Daily Orders List */}
            <View style={[styles.sectionCard, { marginTop: 12 }]}>
              <View style={styles.sectionTitleRow}>
                <Briefcase size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>Radni nalozi za danas ({orders.length})</Text>
              </View>

              <View style={{ gap: 10, marginTop: 10 }}>
                {orders.map(o => {
                  const sb = getStatusBadge(o.status);
                  const hasGeo = o.start_u_opsegu !== null && o.start_u_opsegu !== undefined;
                  const inZone = Number(o.start_u_opsegu) === 1;

                  return (
                    <View key={o.id} style={styles.orderCardSmall}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.orderSmallRn}>{o.broj_naloga}</Text>
                        <Text style={[styles.orderSmallStatus, { color: sb.color }]}>{sb.label}</Text>
                      </View>
                      <Text style={styles.orderSmallClient}>{o.klijent_ime}</Text>
                      <Text style={styles.orderSmallAddress}>{o.adresa}</Text>
                      {o.opis_kvara ? (
                        <Text style={styles.orderSmallFault} numberOfLines={2}>Kvar: {o.opis_kvara}</Text>
                      ) : null}

                      {/* GPS Geofence status bedž */}
                      {hasGeo && (
                        <View style={[
                          styles.geoBadge,
                          inZone ? styles.geoBadgeIn : styles.geoBadgeOut
                        ]}>
                          <Text style={[
                            styles.geoBadgeText,
                            inZone ? styles.geoBadgeTextIn : styles.geoBadgeTextOut
                          ]}>
                            {inZone
                              ? `✓ Start u opsegu (${o.start_udaljenost_m || 0}m)`
                              : `⚠️ Start van opsega (${o.start_udaljenost_m || 0}m)`}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </View>
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
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase'
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
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
  mainBody: {
    flex: 1,
    padding: 12,
    gap: 12
  },
  mainBodyDesktop: {
    flexDirection: 'row'
  },
  mapCol: {
    width: '100%'
  },
  mapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12
  },
  mapHeaderBar: {
    marginBottom: 10
  },
  mapHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A'
  },
  mapHeaderSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2
  },
  mapLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  legendText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B'
  },
  listCol: {
    flex: 1
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A'
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC'
  },
  workerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center'
  },
  workerAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13
  },
  workerName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A'
  },
  workerPhone: {
    fontSize: 11,
    color: '#64748B'
  },
  workerStatusPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  workerStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#475569'
  },
  orderCardSmall: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  orderSmallRn: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A'
  },
  orderSmallStatus: {
    fontSize: 10.5,
    fontWeight: '800'
  },
  orderSmallClient: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4
  },
  orderSmallAddress: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 2
  },
  orderSmallFault: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    fontStyle: 'italic'
  },
  geoBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 2.5,
    paddingHorizontal: 7,
    borderRadius: 6
  },
  geoBadgeIn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BAE6FD'
  },
  geoBadgeOut: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  geoBadgeText: {
    fontSize: 10.5,
    fontWeight: '800'
  },
  geoBadgeTextIn: {
    color: '#0369A1'
  },
  geoBadgeTextOut: {
    color: '#DC2626'
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600'
  }
});
