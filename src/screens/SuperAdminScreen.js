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
  X,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme/colors';

// ==========================================================
// INTERAKTIVNI KALENDAR MODAL ZA IZBOR DATUMA ISTEKA LICENCE
// ==========================================================
function CalendarModal({ visible, initialDate, onSelect, onClose }) {
  const parseDate = (dStr) => {
    if (!dStr) return new Date();
    const parts = dStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m, d);
      }
    }
    return new Date();
  };

  const [currentMonth, setCurrentMonth] = useState(() => parseDate(initialDate));
  const [selected, setSelected] = useState(initialDate || '');

  useEffect(() => {
    if (visible) {
      setSelected(initialDate || '');
      setCurrentMonth(parseDate(initialDate));
    }
  }, [visible, initialDate]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth(); // 0-11

  const monthNames = [
    'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun',
    'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
  ];

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  // Računanje dana: ponedeljak = 0 ... nedelja = 6
  const firstDayRaw = new Date(year, month, 1).getDay();
  const startDayOffset = (firstDayRaw + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysGrid = [];
  for (let i = 0; i < startDayOffset; i++) {
    daysGrid.push({ empty: true, id: `empty-${i}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    daysGrid.push({ day: d, dateStr: dStr, empty: false, id: `day-${d}` });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const handlePick = (dStr) => {
    setSelected(dStr);
    onSelect(dStr);
  };

  const handleQuickAdd = (months) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    const s = d.toISOString().split('T')[0];
    handlePick(s);
  };

  const handleSetEndOfYear = (y) => {
    handlePick(`${y}-12-31`);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.calendarOverlay}>
        <View style={styles.calendarModalBox}>
          {/* Header */}
          <View style={styles.calendarHeaderRow}>
            <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn} activeOpacity={0.7}>
              <ChevronLeft size={20} color="#1E293B" />
            </TouchableOpacity>

            <View style={{ alignItems: 'center' }}>
              <Text style={styles.calMonthText}>{monthNames[month]} {year}</Text>
              <Text style={styles.calHelpSub}>Kliknite na dan za definisanje licence DO</Text>
            </View>

            <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn} activeOpacity={0.7}>
              <ChevronRight size={20} color="#1E293B" />
            </TouchableOpacity>
          </View>

          {/* Nazivi dana */}
          <View style={styles.calWeekdaysRow}>
            {['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'].map((wd, i) => (
              <Text key={i} style={[styles.calWeekdayText, (i === 5 || i === 6) && { color: '#DC2626' }]}>
                {wd}
              </Text>
            ))}
          </View>

          {/* Mreža dana */}
          <View style={styles.calGrid}>
            {daysGrid.map((item) => {
              if (item.empty) {
                return <View key={item.id} style={styles.calDayCell} />;
              }
              const isSelected = selected === item.dateStr;
              const isToday = todayStr === item.dateStr;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.calDayCell,
                    isToday && styles.calDayToday,
                    isSelected && styles.calDaySelected
                  ]}
                  onPress={() => handlePick(item.dateStr)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.calDayText,
                      isToday && styles.calDayTodayText,
                      isSelected && styles.calDaySelectedText
                    ]}
                  >
                    {item.day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Brzi izbor trajanja */}
          <Text style={styles.calPresetsLabel}>Brzi skok trajanja licence:</Text>
          <View style={styles.calPresetsRow}>
            <TouchableOpacity style={styles.calPresetBtn} onPress={() => handleQuickAdd(1)} activeOpacity={0.7}>
              <Text style={styles.calPresetBtnText}>+30 dana</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.calPresetBtn} onPress={() => handleQuickAdd(3)} activeOpacity={0.7}>
              <Text style={styles.calPresetBtnText}>+3 meseca</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.calPresetBtn} onPress={() => handleQuickAdd(6)} activeOpacity={0.7}>
              <Text style={styles.calPresetBtnText}>+6 meseci</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.calPresetBtn} onPress={() => handleQuickAdd(12)} activeOpacity={0.7}>
              <Text style={styles.calPresetBtnText}>+1 godina</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.calPresetBtn} onPress={() => handleSetEndOfYear(new Date().getFullYear())} activeOpacity={0.7}>
              <Text style={styles.calPresetBtnText}>31.12.{new Date().getFullYear()}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.calPresetBtn} onPress={() => handleSetEndOfYear(new Date().getFullYear() + 1)} activeOpacity={0.7}>
              <Text style={styles.calPresetBtnText}>31.12.{new Date().getFullYear() + 1}</Text>
            </TouchableOpacity>
          </View>

          {/* Izabrani datum i dugme za zatvaranje */}
          <View style={styles.calFooter}>
            <View style={{ flex: 1 }}>
              <Text style={styles.calSelectedInfoLabel}>Izabrano važenje do:</Text>
              <Text style={styles.calSelectedInfoValue}>{selected || 'Nije izabrano'}</Text>
            </View>
            <TouchableOpacity style={styles.calCloseBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.calCloseBtnText}>Potvrdi i zatvori</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ==========================================================
// GLAVNI SUPERADMIN EKRAN
// ==========================================================
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
    istekle_firme: 0
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

  // Kalendar modal stanje
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarTargetFirmId, setCalendarTargetFirmId] = useState(null);
  const [calendarInitialDate, setCalendarInitialDate] = useState('');

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
      status_pretplate: firm.status_pretplate === 'BLOKIRAN' ? 'ISTEKAO' : (firm.status_pretplate || 'AKTIVAN'),
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
      Alert.alert('Uspešno', editingFirm ? 'Podaci firme i paketa su uspešno ažurirani.' : 'Nova firma je uspešno kreirana.');
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
      Alert.alert('Licenca produžena', `Licenca firme je uspešno produžena za ${months} mesec(a).`);
      loadData();
    } catch (err) {
      Alert.alert('Greška', err.message || 'Neuspešno produženje licence.');
    }
  };

  // Otvaranje kalendara direktno sa kartice servisa
  const handleOpenCalendarForFirm = (firm) => {
    setCalendarTargetFirmId(firm.id);
    setCalendarInitialDate(firm.datum_isteka || new Date().toISOString().split('T')[0]);
    setCalendarVisible(true);
  };

  // Otvaranje kalendara iz forme za izmenu/unos
  const handleOpenCalendarForForm = () => {
    setCalendarTargetFirmId(null);
    setCalendarInitialDate(firmForm.datum_isteka || new Date().toISOString().split('T')[0]);
    setCalendarVisible(true);
  };

  // Odabir datuma iz kalendara
  const handleDateSelected = async (selectedDateStr) => {
    if (calendarTargetFirmId) {
      // Direktna promena datuma za firmu sa kartice
      const targetFirm = firme.find(f => f.id === calendarTargetFirmId);
      if (targetFirm) {
        try {
          await api.saveFirm({
            ...targetFirm,
            datum_isteka: selectedDateStr
          });
          loadData();
        } catch (err) {
          Alert.alert('Greška', 'Neuspešna promena datuma licence: ' + err.message);
        }
      }
    } else {
      // Promena unutar forme za unos/izmenu
      setFirmForm(prev => ({
        ...prev,
        datum_isteka: selectedDateStr
      }));
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
        {/* KPI Stats Grid - Isključivo globalni status licenci servisa */}
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

          <View style={{ gap: 14, marginTop: 12 }}>
            {firme.map(f => {
              const isExpired = f.status_pretplate === 'ISTEKAO' || (f.preostalo_dana !== null && f.preostalo_dana < 0);
              const isTrial = f.status_pretplate === 'PROBNI';

              let statusColor = colors.success;
              let statusLabel = 'AKTIVAN';
              let statusBg = '#DEF7EC';

              if (isExpired) {
                statusColor = '#DC2626';
                statusLabel = 'ISTEKAO (BLOKIRAN)';
                statusBg = '#FEE2E2';
              } else if (isTrial) {
                statusColor = colors.primary;
                statusLabel = 'PROBNI PERIOD';
                statusBg = '#E0F2FE';
              }

              const isMajstoriFull = (f.broj_majstora || 0) >= (f.max_majstora || 5);
              const isNaloziFull = (f.broj_naloga_mesec || 0) >= (f.max_naloga_mesecno || 500);

              return (
                <View key={f.id} style={styles.firmCard}>
                  {/* Top Bar: Naziv, Bedževi i Podaci o preduzeću */}
                  <View style={styles.firmCardTop}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
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
                  </View>

                  {/* PREGLED PO SERVISU: Važenje Licence DO, Majstori na terenu i Nalozi u mesecu */}
                  <View style={styles.serviceMetricsBanner}>
                    {/* 1. Licenca važi DO sa mogućnošću klika na kalendar */}
                    <TouchableOpacity
                      style={[styles.metricTile, isExpired && styles.metricTileDanger]}
                      onPress={() => handleOpenCalendarForFirm(f)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                        <Calendar size={13} color={isExpired ? '#DC2626' : '#7C3AED'} style={{ marginRight: 4 }} />
                        <Text style={[styles.metricTileLabel, isExpired && { color: '#991B1B' }]}>Licenca važi DO:</Text>
                      </View>
                      <Text style={[styles.metricTileValue, isExpired && { color: '#DC2626' }]}>
                        {f.datum_isteka || 'Nije podešeno'}
                      </Text>
                      <Text style={[styles.metricTileSub, isExpired && { color: '#B91C1C' }]}>
                        {f.preostalo_dana !== null
                          ? (f.preostalo_dana >= 0 ? `Još ${f.preostalo_dana} dana` : `Istekla pre ${Math.abs(f.preostalo_dana)} dana`)
                          : 'Klik za kalendar'}
                      </Text>
                    </TouchableOpacity>

                    {/* 2. Majstori na terenu (Definisano u servisu vs Max limit paketa) */}
                    <View style={[styles.metricTile, isMajstoriFull && styles.metricTileWarning]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                        <Users size={13} color={isMajstoriFull ? '#D97706' : '#2563EB'} style={{ marginRight: 4 }} />
                        <Text style={[styles.metricTileLabel, isMajstoriFull && { color: '#92400E' }]}>Majstori na terenu:</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                        <Text style={[styles.metricTileValue, isMajstoriFull && { color: '#B45309' }]}>
                          {f.broj_majstora || 0}
                        </Text>
                        <Text style={styles.metricTileMax}> / max {f.max_majstora || 5}</Text>
                      </View>
                      <Text style={[styles.metricTileSub, isMajstoriFull && { color: '#B45309' }]}>
                        {isMajstoriFull ? 'Popunjen limit paketa' : `Definisano ${f.broj_majstora || 0} majstora`}
                      </Text>
                    </View>

                    {/* 3. Nalozi ovog meseca (od 01. u mesecu do danas vs Max mesečni limit) */}
                    <View style={[styles.metricTile, isNaloziFull && styles.metricTileDanger]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                        <Briefcase size={13} color={isNaloziFull ? '#DC2626' : '#059669'} style={{ marginRight: 4 }} />
                        <Text style={[styles.metricTileLabel, isNaloziFull && { color: '#991B1B' }]}>Nalozi ovog meseca:</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                        <Text style={[styles.metricTileValue, isNaloziFull && { color: '#DC2626' }]}>
                          {f.broj_naloga_mesec || 0}
                        </Text>
                        <Text style={styles.metricTileMax}> / max {f.max_naloga_mesecno || 500}</Text>
                      </View>
                      <Text style={[styles.metricTileSub, isNaloziFull && { color: '#B91C1C' }]}>
                        (od 01. u mesecu • ukupno: {f.broj_naloga_ukupno || 0})
                      </Text>
                    </View>
                  </View>

                  {/* Donji red sa akcijama */}
                  <View style={styles.firmCardBottom}>
                    <TouchableOpacity
                      style={styles.calendarQuickBtn}
                      onPress={() => handleOpenCalendarForFirm(f)}
                      activeOpacity={0.8}
                    >
                      <Calendar size={13} color="#7C3AED" style={{ marginRight: 4 }} />
                      <Text style={styles.calendarQuickBtnText}>Promeni datum DO</Text>
                    </TouchableOpacity>

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

      {/* MODAL: KALENDAR ZA IZBOR DATUMA ISTEKA LICENCE */}
      <CalendarModal
        visible={calendarVisible}
        initialDate={calendarInitialDate}
        onSelect={handleDateSelected}
        onClose={() => setCalendarVisible(false)}
      />

      {/* MODAL: DODAVANJE / IZMENA FIRME */}
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

              {/* Dinamički izbor SaaS pretplatničkog paketa */}
              <Text style={styles.inputLabel}>SaaS Pretplatnički Paket (Izbor paketa i limita)</Text>
              <View style={{ gap: 6, marginTop: 2 }}>
                {(paketi.length > 0 ? paketi : [
                  { kod: 'START', naziv: 'Start Paket', cena_mesecno: 2990, max_majstora: 2, max_naloga_mesecno: 100 },
                  { kod: 'STANDARD', naziv: 'Standard Paket', cena_mesecno: 5990, max_majstora: 6, max_naloga_mesecno: 500 },
                  { kod: 'PRO', naziv: 'Pro Servis Paket', cena_mesecno: 9990, max_majstora: 15, max_naloga_mesecno: 2000 },
                  { kod: 'ENTERPRISE', naziv: 'Enterprise Paket', cena_mesecno: 19990, max_majstora: 999, max_naloga_mesecno: 99999 }
                ]).map(pkg => {
                  const isSelected = firmForm.paket === pkg.kod;
                  return (
                    <TouchableOpacity
                      key={pkg.kod}
                      style={[styles.pkgSelectCard, isSelected && styles.pkgSelectCardActive]}
                      onPress={() => setFirmForm({ ...firmForm, paket: pkg.kod })}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={[styles.pkgRadioOuter, isSelected && styles.pkgRadioOuterActive]}>
                            {isSelected && <View style={styles.pkgRadioInner} />}
                          </View>
                          <View style={{ marginLeft: 8 }}>
                            <Text style={[styles.pkgSelectName, isSelected && { color: '#7C3AED' }]}>
                              {pkg.kod} – {pkg.naziv}
                            </Text>
                            <Text style={styles.pkgSelectLimits}>
                              Limit: do {pkg.max_majstora} majstora • do {pkg.max_naloga_mesecno} naloga/mes
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.pkgSelectPrice}>
                          {Number(pkg.cena_mesecno).toLocaleString('sr-RS')} RSD/m
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Status licence (bez BLOKIRAN, samo AKTIVAN, PROBNI, ISTEKAO) */}
              <Text style={styles.inputLabel}>Status Licence</Text>
              <View style={styles.pkgPickerRow}>
                {[
                  { id: 'AKTIVAN', label: 'Aktivan' },
                  { id: 'PROBNI', label: 'Probni period' },
                  { id: 'ISTEKAO', label: 'Istekao (Blokiran pristup)' }
                ].map(st => (
                  <TouchableOpacity
                    key={st.id}
                    style={[styles.pkgPickBtn, firmForm.status_pretplate === st.id && styles.pkgPickBtnActive]}
                    onPress={() => setFirmForm({ ...firmForm, status_pretplate: st.id })}
                  >
                    <Text style={[styles.pkgPickBtnText, firmForm.status_pretplate === st.id && styles.pkgPickBtnTextActive]}>
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Datum isteka licence sa kalendar dugmetom */}
              <Text style={styles.inputLabel}>Datum isteka licence (DO)</Text>
              <TouchableOpacity
                style={styles.datePickerInputBox}
                onPress={handleOpenCalendarForForm}
                activeOpacity={0.8}
              >
                <Calendar size={18} color="#7C3AED" style={{ marginRight: 8 }} />
                <Text style={styles.datePickerInputText}>
                  {firmForm.datum_isteka || 'Izaberite datum iz kalendara'}
                </Text>
                <View style={styles.openCalBadge}>
                  <Text style={styles.openCalBadgeText}>📅 Otvori kalendar</Text>
                </View>
              </TouchableOpacity>
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
                  <Text style={styles.saveModalBtnText}>Sačuvaj izmene</Text>
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
    minWidth: 140,
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
    gap: 12
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

  // PREGLED PO SERVISU: Tri ključne pločice
  serviceMetricsBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  metricTile: {
    flex: 1,
    minWidth: 170,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  metricTileDanger: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FECACA'
  },
  metricTileWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A'
  },
  metricTileLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B'
  },
  metricTileValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2
  },
  metricTileMax: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B'
  },
  metricTileSub: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 3
  },

  // Donji red sa akcijama na kartici servisa
  firmCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexWrap: 'wrap',
    gap: 8
  },
  calendarQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  calendarQuickBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#7C3AED'
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
    paddingVertical: 6,
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
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155'
  },

  // Modal za unos / izmenu
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

  // Package select cards in modal
  pkgSelectCard: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC'
  },
  pkgSelectCardActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#FAF5FF'
  },
  pkgRadioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center'
  },
  pkgRadioOuterActive: {
    borderColor: '#7C3AED'
  },
  pkgRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7C3AED'
  },
  pkgSelectName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1E293B'
  },
  pkgSelectLimits: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  pkgSelectPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7C3AED'
  },

  // Status buttons
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

  // Date picker input box
  datePickerInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#7C3AED',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 2
  },
  datePickerInputText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A'
  },
  openCalBadge: {
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E9D5FF'
  },
  openCalBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED'
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
  },

  // KALENDAR MODAL STILOVI
  calendarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  calendarModalBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  calNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  calMonthText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A'
  },
  calHelpSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2
  },
  calWeekdaysRow: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 6
  },
  calWeekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B'
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  calDayCell: {
    width: `${100 / 7}%`,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2
  },
  calDayToday: {
    borderWidth: 1.5,
    borderColor: '#7C3AED'
  },
  calDayTodayText: {
    color: '#7C3AED',
    fontWeight: '800'
  },
  calDaySelected: {
    backgroundColor: '#7C3AED'
  },
  calDaySelectedText: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  calDayText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1E293B'
  },
  calPresetsLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 12,
    marginBottom: 6
  },
  calPresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  calPresetBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6
  },
  calPresetBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155'
  },
  calFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  calSelectedInfoLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700'
  },
  calSelectedInfoValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#7C3AED'
  },
  calCloseBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  calCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800'
  }
});
