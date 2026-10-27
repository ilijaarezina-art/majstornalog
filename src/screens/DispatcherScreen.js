import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
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
  AlertTriangle,
  UserPlus,
  Trash2,
  Key,
  X,
  Check,
  Building2,
  Mail,
  Phone,
  ShieldCheck
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import MapComponent from '../components/MapComponent';

const MARKER_COLORS = [
  { color: '#059669', name: 'Zelena' },
  { color: '#0284C7', name: 'Plava' },
  { color: '#D97706', name: 'Narandžasta' },
  { color: '#7C3AED', name: 'Ljubičasta' },
  { color: '#DC2626', name: 'Crvena' }
];

export default function DispatcherScreen({ onBackToWorker }) {
  const { user, firmId, logout, isAdmin, isOwner, isSuperAdmin } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [orders, setOrders] = useState([]);

  // Modal za dodavanje radnika
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingWorker, setSavingWorker] = useState(false);
  const [workerError, setWorkerError] = useState('');
  const [workerForm, setWorkerForm] = useState({
    ime: '',
    prezime: '',
    telefon: '',
    email: '',
    lozinka: 'majstor123',
    boja_markera: '#059669'
  });

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

  const handleOpenAddWorker = () => {
    setWorkerError('');
    setWorkerForm({
      ime: '',
      prezime: '',
      telefon: '',
      email: '',
      lozinka: 'majstor123',
      boja_markera: '#059669'
    });
    setShowAddModal(true);
  };

  const handleSaveWorker = async () => {
    if (!workerForm.ime.trim()) {
      setWorkerError('Ime radnika je obavezno polje.');
      return;
    }
    if (!workerForm.email.trim()) {
      setWorkerError('Korisničko ime / email adresa je obavezna.');
      return;
    }
    if (!workerForm.telefon.trim()) {
      setWorkerError('Broj telefona radnika je obavezan.');
      return;
    }

    setSavingWorker(true);
    setWorkerError('');
    try {
      // Servis se automatski dodeljuje na osnovu ulogovanog admina (firmId)
      await api.saveWorker({
        ...workerForm,
        firma_id: firmId,
        rola: 'majstor',
        rola_id: 3,
        aktivan: 1
      });

      setShowAddModal(false);
      loadDashboard();
      if (Platform.OS === 'web') {
        window.alert(`Radnik ${workerForm.ime} ${workerForm.prezime} je uspešno dodat servisu.`);
      } else {
        Alert.alert('Uspešno', `Radnik ${workerForm.ime} ${workerForm.prezime} je uspešno dodat.`);
      }
    } catch (err) {
      setWorkerError(err.message || 'Greška pri čuvanju radnika.');
    } finally {
      setSavingWorker(false);
    }
  };

  const handleDeleteWorker = (worker) => {
    const confirmMsg = `Da li ste sigurni da želite da obrišete radnika ${worker.ime} ${worker.prezime}?`;
    const executeDelete = async () => {
      try {
        await api.deleteUser(worker.id);
        loadDashboard();
      } catch (err) {
        if (Platform.OS === 'web') {
          window.alert(err.message || 'Greška pri brisanju radnika.');
        } else {
          Alert.alert('Greška', err.message);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        executeDelete();
      }
    } else {
      Alert.alert('Potvrda brisanja', confirmMsg, [
        { text: 'Odustani', style: 'cancel' },
        { text: 'Obriši', style: 'destructive', onPress: executeDelete }
      ]);
    }
  };

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
              <View style={[styles.sectionTitleRow, { justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Users size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.sectionTitle}>Ekipe na terenu ({workers.length})</Text>
                </View>

                {/* Dugme za unos radnika dostupno Adminu servisa */}
                {(isAdmin || isOwner || isSuperAdmin) && (
                  <TouchableOpacity
                    style={styles.addWorkerTopBtn}
                    onPress={handleOpenAddWorker}
                    activeOpacity={0.8}
                  >
                    <UserPlus size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.addWorkerTopBtnText}>+ Dodaj radnika</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ gap: 8, marginTop: 8 }}>
                {workers.length === 0 ? (
                  <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: '#94A3B8' }}>Nema unetih radnika za ovaj servis.</Text>
                    {(isAdmin || isOwner || isSuperAdmin) && (
                      <TouchableOpacity
                        style={[styles.addWorkerTopBtn, { marginTop: 10 }]}
                        onPress={handleOpenAddWorker}
                        activeOpacity={0.8}
                      >
                        <UserPlus size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.addWorkerTopBtnText}>Unesi prvog radnika</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  workers.map(w => (
                    <View key={w.id} style={styles.workerRow}>
                      <View style={[styles.workerAvatar, { backgroundColor: w.boja_markera || '#059669' }]}>
                        <Text style={styles.workerAvatarText}>{w.ime ? w.ime.charAt(0) : 'R'}{w.prezime ? w.prezime.charAt(0) : ''}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.workerName}>{w.ime} {w.prezime}</Text>
                        </View>
                        <Text style={styles.workerPhone}>📞 {w.telefon}</Text>
                        {/* Prikaz korisničkog imena i lozinke za admina */}
                        {(isAdmin || isOwner || isSuperAdmin) && (
                          <View style={styles.workerCredsRow}>
                            <Text style={styles.workerCredsText}>Login: <Text style={{ fontWeight: '700' }}>{w.email}</Text></Text>
                            <View style={styles.workerPassBadge}>
                              <Key size={10} color="#7C3AED" style={{ marginRight: 3 }} />
                              <Text style={styles.workerPassText}>{w.lozinka_tekst || 'majstor123'}</Text>
                            </View>
                          </View>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <View style={styles.workerStatusPill}>
                          <Text style={styles.workerStatusText}>{w.radni_status || 'SLOBODAN'}</Text>
                        </View>
                        {(isAdmin || isOwner || isSuperAdmin) && (
                          <TouchableOpacity
                            onPress={() => handleDeleteWorker(w)}
                            style={styles.deleteWorkerBtn}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Trash2 size={13} color="#EF4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))
                )}
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

      {/* MODAL: DODAVANJE RADNIKA ZA SERVIS */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Novi radnik servisa</Text>
                <Text style={styles.modalSub}>Unos člana ekipe na terenu</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.closeBtn} activeOpacity={0.7}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Informacija o automatskoj dodeli servisa na osnovu logina */}
            <View style={styles.firmAutoInfoBox}>
              <Building2 size={16} color="#0284C7" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.firmAutoInfoTitle}>Pripadnost servisu (Automatski po loginu):</Text>
                <Text style={styles.firmAutoInfoVal}>{user?.firma_naziv || 'Vaš servis'} (ID #{firmId})</Text>
              </View>
            </View>

            {workerError ? (
              <View style={styles.errBox}>
                <AlertTriangle size={15} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.errText}>{workerError}</Text>
              </View>
            ) : null}

            <ScrollView style={{ maxHeight: 420 }}>
              <View style={styles.formRow2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Ime radnika *</Text>
                  <TextInput
                    style={styles.input}
                    value={workerForm.ime}
                    onChangeText={(t) => setWorkerForm(p => ({ ...p, ime: t }))}
                    placeholder="npr. Nikola"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Prezime radnika *</Text>
                  <TextInput
                    style={styles.input}
                    value={workerForm.prezime}
                    onChangeText={(t) => setWorkerForm(p => ({ ...p, prezime: t }))}
                    placeholder="npr. Petrović"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <Text style={styles.label}>Broj telefona *</Text>
              <TextInput
                style={styles.input}
                value={workerForm.telefon}
                onChangeText={(t) => setWorkerForm(p => ({ ...p, telefon: t }))}
                placeholder="06x-xxx-xxxx"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Korisničko ime / Email za prijavu *</Text>
              <TextInput
                style={styles.input}
                value={workerForm.email}
                onChangeText={(t) => setWorkerForm(p => ({ ...p, email: t }))}
                placeholder="nikola@servis.rs"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text style={styles.label}>Lozinka (vidljiva) *</Text>
              <TextInput
                style={styles.input}
                value={workerForm.lozinka}
                onChangeText={(t) => setWorkerForm(p => ({ ...p, lozinka: t }))}
                placeholder="Unesite lozinku (podrazumevano majstor123)"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />

              {/* Izbor boje markera na mapi */}
              <Text style={styles.label}>Boja markera na mapi terena:</Text>
              <View style={styles.colorPickerRow}>
                {MARKER_COLORS.map(c => {
                  const isSel = workerForm.boja_markera === c.color;
                  return (
                    <TouchableOpacity
                      key={c.color}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: c.color },
                        isSel && styles.colorCircleActive
                      ]}
                      onPress={() => setWorkerForm(p => ({ ...p, boja_markera: c.color }))}
                      activeOpacity={0.8}
                    >
                      {isSel && <Check size={14} color="#FFFFFF" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowAddModal(false)}
                disabled={savingWorker}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Odustani</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, savingWorker && { opacity: 0.7 }]}
                onPress={handleSaveWorker}
                disabled={savingWorker}
                activeOpacity={0.8}
              >
                {savingWorker ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Sačuvaj radnika</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600'
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
  addWorkerTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  addWorkerTopBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700'
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
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
    color: '#64748B',
    marginTop: 1
  },
  workerCredsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
    flexWrap: 'wrap'
  },
  workerCredsText: {
    fontSize: 10.5,
    color: '#64748B'
  },
  workerPassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1.5
  },
  workerPassText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6D28D9'
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
  deleteWorkerBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#FEF2F2'
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

  // Modal stilovi
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 480,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
      android: { elevation: 10 },
      web: { boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)' }
    })
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A'
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  firmAutoInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14
  },
  firmAutoInfoTitle: {
    fontSize: 11,
    color: '#0369A1',
    fontWeight: '700'
  },
  firmAutoInfoVal: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0C4A6E',
    marginTop: 1
  },
  errBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12
  },
  errText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1
  },
  formRow2: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10
  },
  label: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
    marginTop: 6
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A'
  },
  colorPickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 12
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  colorCircleActive: {
    borderWidth: 3,
    borderColor: '#0F172A'
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F1F5F9'
  },
  cancelBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569'
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120
  },
  saveBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
