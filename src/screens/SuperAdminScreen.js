import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  useWindowDimensions
} from 'react-native';
import {
  ShieldAlert,
  Building2,
  Users,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Edit3,
  CalendarPlus,
  RefreshCw,
  LogOut,
  Sliders,
  DollarSign,
  Phone,
  Mail,
  MapPin,
  X
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme/colors';

export default function SuperAdminScreen({ onOpenDispatcher }) {
  const { user, logout } = useAuth();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isDesktop = width >= 900;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    total_firme: 0,
    active_firme: 0,
    probni_firme: 0,
    istekle_firme: 0,
    total_majstori: 0,
    total_nalozi: 0
  });
  const [firme, setFirme] = useState([]);
  const [paketi, setPaketi] = useState([]);

  // Modal za unos / izmenu firme
  const [showFirmModal, setShowFirmModal] = useState(false);
  const [editingFirm, setEditingFirm] = useState(null);
  const [firmForm, setFirmForm] = useState({
    id: 0,
    naziv: '',
    pib: '',
    maticni_broj: '',
    grad: 'Smederevo',
    adresa: '',
    telefon: '',
    email: '',
    paket: 'STANDARD',
    status_pretplate: 'PROBNI',
    datum_isteka: ''
  });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.getSuperadminDashboard();
      setStats(res.stats || {});
      setFirme(res.firme || []);
      setPaketi(res.paketi || []);
    } catch (err) {
      Alert.alert('Greška', err.message || 'Neuspešno učitavanje superadmin podataka.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenNewFirm = () => {
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 30);
    const dateStr = defaultExpiry.toISOString().split('T')[0];

    setEditingFirm(null);
    setFirmForm({
      id: 0,
      naziv: '',
      pib: '',
      maticni_broj: '',
      grad: 'Smederevo',
      adresa: '',
      telefon: '',
      email: '',
      paket: 'STANDARD',
      status_pretplate: 'PROBNI',
      datum_isteka: dateStr
    });
    setShowFirmModal(true);
  };

  const handleEditFirm = (firm) => {
    setEditingFirm(firm);
    setFirmForm({
      id: firm.id,
      naziv: firm.naziv || '',
      pib: firm.pib || '',
      maticni_broj: firm.maticni_broj || '',
      grad: firm.grad || 'Smederevo',
      adresa: firm.adresa || '',
      telefon: firm.telefon || '',
      email: firm.email || '',
      paket: firm.paket || 'STANDARD',
      status_pretplate: firm.status_pretplate || 'AKTIVAN',
      datum_isteka: firm.datum_isteka || ''
    });
    setShowFirmModal(true);
  };

  const handleSaveFirm = async () => {
    if (!firmForm.naziv.trim()) {
      Alert.alert('Upozorenje', 'Naziv firme je obavezan.');
      return;
    }
    setSaving(true);
    try {
      await api.saveFirm(firmForm);
      Alert.alert('Uspešno', editingFirm ? 'Podaci firme su ažurirani.' : 'Nova firma je kreirana.');
      setShowFirmModal(false);
      loadData();
    } catch (err) {
      Alert.alert('Greška', err.message || 'Neuspešno čuvanje firme.');
    } finally {
      setSaving(false);
    }
  };

  const handleExtendLicense = async (firmId, months) => {
    try {
      await api.extendFirmLicense(firmId, months);
      Alert.alert('Licenca produžena', `Licenca firme je produžena za ${months} mesec(a).`);
      loadData();
    } catch (err) {
      Alert.alert('Greška', err.message || 'Neuspešno produženje licence.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Učitavanje SuperAdmin kontrolne table...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.adminIconBox}>
            <ShieldAlert size={20} color="#FFFFFF" />
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.headerTitle}>SuperAdmin Platforma</Text>
            <Text style={styles.headerSub}>Upravljanje servisima, licencama i SaaS paketima</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={onOpenDispatcher}
            activeOpacity={0.8}
          >
            <Briefcase size={15} color="#475569" style={{ marginRight: 5 }} />
            <Text style={styles.headerActionBtnText}>Dispečerski centar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={loadData}
            activeOpacity={0.8}
          >
            <RefreshCw size={15} color="#475569" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerActionBtn, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}
            onPress={logout}
            activeOpacity={0.8}
          >
            <LogOut size={15} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* KPI Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderLeftColor: '#7C3AED' }]}>
            <Text style={styles.statLabel}>Ukupno servisa</Text>
            <Text style={[styles.statValue, { color: '#7C3AED' }]}>{stats.total_firme}</Text>
          </View>

          <View style={[styles.statCard, { borderLeftColor: colors.success }]}>
            <Text style={styles.statLabel}>Aktivne licence</Text>
            <Text style={[styles.statValue, { color: colors.success }]}>{stats.active_firme}</Text>
          </View>

          <View style={[styles.statCard, { borderLeftColor: colors.primary }]}>
            <Text style={styles.statLabel}>Probni periodi</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.probni_firme}</Text>
          </View>

          <View style={[styles.statCard, { borderLeftColor: '#DC2626' }]}>
            <Text style={styles.statLabel}>Istekle licence</Text>
            <Text style={[styles.statValue, { color: '#DC2626' }]}>{stats.istekle_firme}</Text>
          </View>

          <View style={[styles.statCard, { borderLeftColor: '#D97706' }]}>
            <Text style={styles.statLabel}>Majstori na terenu</Text>
            <Text style={[styles.statValue, { color: '#D97706' }]}>{stats.total_majstori}</Text>
          </View>

          <View style={[styles.statCard, { borderLeftColor: '#0EA5E9' }]}>
            <Text style={styles.statLabel}>Ukupno naloga</Text>
            <Text style={[styles.statValue, { color: '#0EA5E9' }]}>{stats.total_nalozi}</Text>
          </View>
        </View>

        {/* Section: Paketi SaaS Cenovnik */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <DollarSign size={18} color="#7C3AED" style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>SaaS Pretplatnički Paketi (Cenovnik i mogućnosti)</Text>
            </View>
          </View>

          <View style={styles.packagesRow}>
            {paketi.map(p => (
              <View key={p.id} style={styles.packageCard}>
                <View style={styles.packageHeader}>
                  <Text style={styles.packageCode}>{p.kod}</Text>
                  <Text style={styles.packagePrice}>{Number(p.cena_mesecno).toLocaleString('sr-RS')} RSD<Text style={styles.monthSub}>/mes</Text></Text>
                </View>
                <Text style={styles.packageName}>{p.naziv}</Text>
                <Text style={styles.packageDesc}>{p.opis}</Text>
                <View style={styles.packageFeatures}>
                  <Text style={styles.featItem}>• Do <Text style={{ fontWeight: '800' }}>{p.max_majstora}</Text> majstora na terenu</Text>
                  <Text style={styles.featItem}>• Do <Text style={{ fontWeight: '800' }}>{p.max_naloga_mesecno}</Text> naloga mesečno</Text>
                  <Text style={styles.featItem}>• GPS praćenje uživo: {p.gps_pracenje ? '✓ Da' : '✗ Ne'}</Text>
                  <Text style={styles.featItem}>• Dispečerski centar: {p.dispecerski_centar ? '✓ Da' : '✗ Ne'}</Text>
                  <Text style={styles.featItem}>• SMS obaveštenja: {p.sms_obavestenja ? '✓ Da' : '✗ Ne'}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Section: Registar Firmi i Upravljanje Licencama */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Building2 size={18} color="#7C3AED" style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>Registrovani Servisi & Upravljanje Licencama ({firme.length})</Text>
            </View>
            <TouchableOpacity style={styles.addNewFirmBtn} onPress={handleOpenNewFirm} activeOpacity={0.8}>
              <Plus size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.addNewFirmBtnText}>Dodaj novu firmu</Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 12, marginTop: 12 }}>
            {firme.map(f => {
              const isExpired = f.status_pretplate === 'ISTEKAO' || (f.preostalo_dana !== null && f.preostalo_dana < 0);
              const isTrial = f.status_pretplate === 'PROBNI';
              const isBlocked = f.status_pretplate === 'BLOKIRAN';

              let statusColor = colors.success;
              let statusLabel = 'AKTIVNA';
              let statusBg = '#DEF7EC';

              if (isBlocked) {
                statusColor = '#6B7280';
                statusLabel = 'BLOKIRANA';
                statusBg = '#F3F4F6';
              } else if (isExpired) {
                statusColor = '#DC2626';
                statusLabel = 'ISTEKLA LICENCA';
                statusBg = '#FEE2E2';
              } else if (isTrial) {
                statusColor = colors.primary;
                statusLabel = 'PROBNI PERIOD';
                statusBg = '#E0F2FE';
              }

              return (
                <View key={f.id} style={styles.firmCard}>
                  <View style={styles.firmCardTop}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.firmName}>{f.naziv}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                          <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
                        </View>
                        <View style={styles.packagePill}>
                          <Text style={styles.packagePillText}>PAKET: {f.paket}</Text>
                        </View>
                      </View>

                      <View style={styles.firmDetailsRow}>
                        <Text style={styles.firmDetailItem}><MapPin size={12} color="#64748B" /> {f.grad}, {f.adresa}</Text>
                        <Text style={styles.firmDetailItem}><Phone size={12} color="#64748B" /> {f.telefon}</Text>
                        <Text style={styles.firmDetailItem}><Mail size={12} color="#64748B" /> {f.email}</Text>
                        <Text style={styles.firmDetailItem}>PIB: <Text style={{ fontWeight: '700' }}>{f.pib || '-'}</Text></Text>
                      </View>
                    </View>

                    {/* Expiration date countdown */}
                    <View style={styles.expiryBox}>
                      <Text style={styles.expiryLabel}>Licenca važi do:</Text>
                      <Text style={[styles.expiryDate, isExpired && { color: '#DC2626' }]}>
                        {f.datum_isteka || 'Nije podešeno'}
                      </Text>
                      <Text style={[styles.expirySub, isExpired && { color: '#DC2626' }]}>
                        {f.preostalo_dana !== null
                          ? (f.preostalo_dana >= 0 ? `Preostalo: ${f.preostalo_dana} dana` : `Istekla pre ${Math.abs(f.preostalo_dana)} dana`)
                          : ''}
                      </Text>
                    </View>
                  </View>

                  {/* Firm metrics & Action Buttons */}
                  <View style={styles.firmCardBottom}>
                    <View style={styles.firmMetrics}>
                      <Text style={styles.metricItem}>Majstori: <Text style={{ fontWeight: '800' }}>{f.broj_radnika}</Text></Text>
                      <Text style={styles.metricItem}>Ukupno naloga: <Text style={{ fontWeight: '800' }}>{f.broj_naloga}</Text></Text>
                    </View>

                    <View style={styles.firmActions}>
                      <TouchableOpacity
                        style={styles.quickExtendBtn}
                        onPress={() => handleExtendLicense(f.id, 1)}
                        activeOpacity={0.8}
                      >
                        <CalendarPlus size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.quickExtendText}>+30 dana</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.quickExtendBtn, { backgroundColor: '#7C3AED' }]}
                        onPress={() => handleExtendLicense(f.id, 12)}
                        activeOpacity={0.8}
                      >
                        <CalendarPlus size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.quickExtendText}>+1 godina</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => handleEditFirm(f)}
                        activeOpacity={0.8}
                      >
                        <Edit3 size={13} color="#334155" style={{ marginRight: 4 }} />
                        <Text style={styles.editBtnText}>Izmeni</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Modal: Dodavanje / Izmena Firme */}
      <Modal visible={showFirmModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingFirm ? `Izmena firme: ${editingFirm.naziv}` : 'Registracija novog servisa / firme'}
              </Text>
              <TouchableOpacity onPress={() => setShowFirmModal(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ paddingVertical: 10, gap: 10 }}>
              <Text style={styles.inputLabel}>Naziv servisa / preduzeća *</Text>
              <TextInput
                style={styles.input}
                placeholder="Npr. TermoKlima d.o.o."
                value={firmForm.naziv}
                onChangeText={(t) => setFirmForm({ ...firmForm, naziv: t })}
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>PIB</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="108923451"
                    value={firmForm.pib}
                    onChangeText={(t) => setFirmForm({ ...firmForm, pib: t })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Matični broj</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="20938471"
                    value={firmForm.maticni_broj}
                    onChangeText={(t) => setFirmForm({ ...firmForm, maticni_broj: t })}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Grad</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Smederevo"
                    value={firmForm.grad}
                    onChangeText={(t) => setFirmForm({ ...firmForm, grad: t })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Adresa</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Karađorđeva 45"
                    value={firmForm.adresa}
                    onChangeText={(t) => setFirmForm({ ...firmForm, adresa: t })}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Telefon</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="026-612-345"
                    value={firmForm.telefon}
                    onChangeText={(t) => setFirmForm({ ...firmForm, telefon: t })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="info@termoklima.rs"
                    value={firmForm.email}
                    onChangeText={(t) => setFirmForm({ ...firmForm, email: t })}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>SaaS Pretplatnički Paket</Text>
              <View style={styles.pkgPickerRow}>
                {['START', 'STANDARD', 'PRO', 'ENTERPRISE'].map(pkg => (
                  <TouchableOpacity
                    key={pkg}
                    style={[styles.pkgPickBtn, firmForm.paket === pkg && styles.pkgPickBtnActive]}
                    onPress={() => setFirmForm({ ...firmForm, paket: pkg })}
                  >
                    <Text style={[styles.pkgPickBtnText, firmForm.paket === pkg && styles.pkgPickBtnTextActive]}>{pkg}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Status Licence</Text>
              <View style={styles.pkgPickerRow}>
                {[
                  { id: 'AKTIVAN', label: 'Aktivan' },
                  { id: 'PROBNI', label: 'Probni period' },
                  { id: 'ISTEKAO', label: 'Istekao' },
                  { id: 'BLOKIRAN', label: 'Blokiran' }
                ].map(st => (
                  <TouchableOpacity
                    key={st.id}
                    style={[styles.pkgPickBtn, firmForm.status_pretplate === st.id && styles.pkgPickBtnActive]}
                    onPress={() => setFirmForm({ ...firmForm, status_pretplate: st.id })}
                  >
                    <Text style={[styles.pkgPickBtnText, firmForm.status_pretplate === st.id && styles.pkgPickBtnTextActive]}>{st.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Datum isteka licence (GGGG-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="2027-12-31"
                value={firmForm.datum_isteka}
                onChangeText={(t) => setFirmForm({ ...firmForm, datum_isteka: t })}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setShowFirmModal(false)}
              >
                <Text style={styles.cancelModalBtnText}>Otkaži</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveModalBtn, saving && { opacity: 0.7 }]}
                onPress={handleSaveFirm}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveModalBtnText}>Sačuvaj firmu</Text>
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
    backgroundColor: '#F1F5F9'
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC'
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  adminIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A'
  },
  headerSub: {
    fontSize: 11.5,
    color: '#64748B'
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  headerActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155'
  },
  scroll: {
    padding: 16,
    gap: 16
  },

  // KPI Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  statCard: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase'
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4
  },

  // Section
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A'
  },
  addNewFirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  addNewFirmBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },

  // Packages Cards
  packagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12
  },
  packageCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  packageCode: {
    fontSize: 12,
    fontWeight: '900',
    color: '#7C3AED',
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  packagePrice: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A'
  },
  monthSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B'
  },
  packageName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 6
  },
  packageDesc: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16
  },
  packageFeatures: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 3
  },
  featItem: {
    fontSize: 11,
    color: '#334155'
  },

  // Firm Cards
  firmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10
  },
  firmCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12
  },
  firmName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800'
  },
  packagePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  packagePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569'
  },
  firmDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6
  },
  firmDetailItem: {
    fontSize: 12,
    color: '#475569'
  },
  expiryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'flex-end',
    minWidth: 130
  },
  expiryLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700'
  },
  expiryDate: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 1
  },
  expirySub: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.success,
    marginTop: 2
  },
  firmCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  firmMetrics: {
    flexDirection: 'row',
    gap: 14
  },
  metricItem: {
    fontSize: 12,
    color: '#64748B'
  },
  firmActions: {
    flexDirection: 'row',
    gap: 6
  },
  quickExtendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  quickExtendText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155'
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContent: {
    width: '100%',
    maxWidth: 580,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A'
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    marginTop: 4
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
  pkgPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4
  },
  pkgPickBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  pkgPickBtnActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED'
  },
  pkgPickBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569'
  },
  pkgPickBtnTextActive: {
    color: '#FFFFFF'
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  cancelModalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9'
  },
  cancelModalBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B'
  },
  saveModalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#7C3AED'
  },
  saveModalBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF'
  }
});
