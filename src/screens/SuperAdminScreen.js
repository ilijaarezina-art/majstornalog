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
  Trash2,
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
  Check,
  Key,
  Search,
  UserCheck,
  UserPlus,
  ShieldCheck,
  User
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme/colors';

// Pomoćna funkcija za sigurno parsiranje datuma (garantuje godinu >= 2024)
const safeParseDate = (dStr) => {
  const now = new Date();
  if (!dStr || typeof dStr !== 'string') return now;
  const clean = dStr.trim();
  if (clean === '' || clean.startsWith('0000')) return now;

  const parts = clean.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d) && y >= 2024 && y <= 2100 && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      const dt = new Date(y, m, d);
      if (!isNaN(dt.getTime())) return dt;
    }
  }
  return now;
};

// ==========================================================
// INLINE KALENDAR KOMPONENTA DIREKTNO UNUTAR EDIT FORME
// ==========================================================
function InlineCalendarPicker({ value, onChange }) {
  const [currentMonth, setCurrentMonth] = useState(() => safeParseDate(value));

  useEffect(() => {
    if (value) {
      setCurrentMonth(safeParseDate(value));
    }
  }, [value]);

  const year = Math.max(2024, currentMonth.getFullYear());
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

  const handlePickDate = (dStr) => {
    onChange(dStr);
  };

  const handleQuickAdd = (months) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    const s = d.toISOString().split('T')[0];
    onChange(s);
    setCurrentMonth(safeParseDate(s));
  };

  const handleSetEndOfYear = (targetYear) => {
    const s = `${targetYear}-12-31`;
    onChange(s);
    setCurrentMonth(safeParseDate(s));
  };

  return (
    <View style={styles.inlineCalContainer}>
      <View style={styles.inlineCalHeader}>
        <TouchableOpacity onPress={prevMonth} style={styles.inlineCalNavBtn} activeOpacity={0.7}>
          <ChevronLeft size={18} color="#0F172A" />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={styles.inlineCalMonthTitle}>{monthNames[month]} {year}</Text>
          <Text style={styles.inlineCalMonthSub}>Kliknite na dan za izbor datuma isteka DO</Text>
        </View>

        <TouchableOpacity onPress={nextMonth} style={styles.inlineCalNavBtn} activeOpacity={0.7}>
          <ChevronRight size={18} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <View style={styles.inlineCalWeekdaysRow}>
        {['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'].map((wd, i) => (
          <Text key={i} style={[styles.inlineCalWeekdayText, (i === 5 || i === 6) && { color: '#DC2626' }]}>
            {wd}
          </Text>
        ))}
      </View>

      <View style={styles.inlineCalDaysGrid}>
        {daysGrid.map((item) => {
          if (item.empty) {
            return <View key={item.id} style={styles.inlineCalEmptyCell} />;
          }

          const isSelected = value === item.dateStr;
          const isToday = todayStr === item.dateStr;

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.inlineCalDayCell,
                isSelected && styles.inlineCalDayCellSelected,
                isToday && !isSelected && styles.inlineCalDayCellToday
              ]}
              onPress={() => handlePickDate(item.dateStr)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.inlineCalDayNumber,
                  isSelected && styles.inlineCalDayNumberSelected,
                  isToday && !isSelected && styles.inlineCalDayNumberToday
                ]}
              >
                {item.day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.inlineCalShortcutsLabel}>Brzo definisanje trajanja licence:</Text>
      <View style={styles.inlineCalShortcutsRow}>
        <TouchableOpacity style={styles.inlineCalShortcutBtn} onPress={() => handleQuickAdd(1)} activeOpacity={0.7}>
          <Text style={styles.inlineCalShortcutText}>+30 dana</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.inlineCalShortcutBtn} onPress={() => handleQuickAdd(3)} activeOpacity={0.7}>
          <Text style={styles.inlineCalShortcutText}>+3 meseca</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.inlineCalShortcutBtn} onPress={() => handleQuickAdd(6)} activeOpacity={0.7}>
          <Text style={styles.inlineCalShortcutText}>+6 meseci</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.inlineCalShortcutBtn} onPress={() => handleQuickAdd(12)} activeOpacity={0.7}>
          <Text style={styles.inlineCalShortcutText}>+1 godina</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.inlineCalShortcutBtn} onPress={() => handleSetEndOfYear(new Date().getFullYear())} activeOpacity={0.7}>
          <Text style={styles.inlineCalShortcutText}>31.12.{new Date().getFullYear()}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.inlineCalShortcutBtn} onPress={() => handleSetEndOfYear(new Date().getFullYear() + 1)} activeOpacity={0.7}>
          <Text style={styles.inlineCalShortcutText}>31.12.{new Date().getFullYear() + 1}</Text>
        </TouchableOpacity>
      </View>
    </View>
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

  // Glavni tabovi: 'firms' (Servisi i licence) | 'users' (Korisnici i dodele servisa)
  const [activeTab, setActiveTab] = useState('firms');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    total_firme: 0,
    active_firme: 0,
    probni_firme: 0,
    istekle_firme: 0,
    total_korisnici: 0
  });
  const [firme, setFirme] = useState([]);
  const [paketi, setPaketi] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);

  // Filteri za korisnike
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | '1' | '2' | '3'

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
  const [deletingId, setDeletingId] = useState(null);

  // Modal za unos / izmenu korisnika i dodelu role & servisa
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    id: 0,
    ime: '',
    prezime: '',
    email: '',
    telefon: '',
    lozinka: '',
    rola_id: 3, // Default: ID 3 (Običan korisnik)
    firma_id: null,
    aktivan: 1
  });
  const [savingUser, setSavingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const res = await api.getSuperadminDashboard();
      setStats(res.stats || {});
      setFirme(res.firme || []);
      setPaketi(res.paketi || []);
      setUsers(res.users || []);
      setRoles(res.roles || []);
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

  // BRISANJE FIRME
  const executeDelete = async (firmId) => {
    setDeletingId(firmId);
    try {
      const res = await api.deleteFirm(firmId);
      Alert.alert('Uspešno', res?.poruka || 'Servis je uspešno obrisan.');
      if (showFirmModal && editingFirm?.id === firmId) {
        setShowFirmModal(false);
      }
      loadData();
    } catch (err) {
      Alert.alert('Greška', err.message || 'Neuspešno brisanje servisa.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteFirm = (firm) => {
    const confirmMessage = `Da li ste sigurni da želite trajno da obrišete servis "${firm.naziv}"?\n\nPažnja: Biće trajno obrisani svi radni nalozi, klijenti, uređaji i korisnički nalozi ovog servisa!`;

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        executeDelete(firm.id);
      }
    } else {
      Alert.alert(
        'Potvrda trajnog brisanja',
        confirmMessage,
        [
          { text: 'Otkaži', style: 'cancel' },
          { text: 'Obriši servis', style: 'destructive', onPress: () => executeDelete(firm.id) }
        ]
      );
    }
  };

  // OTVARANJE MODALA ZA NOVU FIRMU
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

  // OTVARANJE MODALA ZA IZMENU FIRME
  const handleEditFirm = (firm) => {
    let cleanDate = firm.datum_isteka;
    if (!cleanDate || cleanDate.startsWith('0000') || cleanDate < '2024-01-01') {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + 30);
      cleanDate = fallback.toISOString().split('T')[0];
    }

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
      datum_isteka: cleanDate
    });
    setShowFirmModal(true);
  };

  // ČUVANJE FIRME
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

  // ==========================================================
  // METODE ZA UPRAVLJANJE KORISNICIMA (TAB 2)
  // ==========================================================
  const handleOpenNewUser = () => {
    setEditingUser(null);
    setUserForm({
      id: 0,
      ime: '',
      prezime: '',
      email: '',
      telefon: '',
      lozinka: 'majstor123',
      rola_id: 3, // ID 3: Običan korisnik
      firma_id: null,
      aktivan: 1
    });
    setShowUserModal(true);
  };

  const handleEditUser = (u) => {
    setEditingUser(u);
    setUserForm({
      id: u.id,
      ime: u.ime || '',
      prezime: u.prezime || '',
      email: u.email || '',
      telefon: u.telefon || '',
      lozinka: u.lozinka_tekst || 'majstor123',
      rola_id: Number(u.rola_id) || 3,
      firma_id: u.firma_id ? Number(u.firma_id) : null,
      aktivan: Number(u.aktivan) === 1 ? 1 : 0
    });
    setShowUserModal(true);
  };

  const handleSaveUser = async () => {
    if (!userForm.ime.trim() || !userForm.email.trim()) {
      Alert.alert('Upozorenje', 'Ime i email korisnika su obavezni.');
      return;
    }
    setSavingUser(true);
    try {
      const res = await api.saveUser(userForm);
      Alert.alert('Uspešno', res?.poruka || 'Korisnik je uspešno sačuvan.');
      setShowUserModal(false);
      loadData();
    } catch (err) {
      Alert.alert('Greška', err.message || 'Neuspešno čuvanje korisnika.');
    } finally {
      setSavingUser(false);
    }
  };

  const executeDeleteUser = async (userId) => {
    setDeletingUserId(userId);
    try {
      const res = await api.deleteUser(userId);
      Alert.alert('Uspešno', res?.poruka || 'Korisnik je uspešno obrisan.');
      loadData();
    } catch (err) {
      Alert.alert('Greška', err.message || 'Neuspešno brisanje korisnika.');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleDeleteUser = (u) => {
    if (Number(u.rola_id) === 1 || u.email === 'admin@majstornalog.rs') {
      Alert.alert('Zabranjeno', 'Nije dozvoljeno brisanje glavnog SuperAdministratora.');
      return;
    }

    const confirmMsg = `Da li ste sigurni da želite trajno da obrišete korisnika "${u.ime} ${u.prezime}" (${u.email})?`;
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        executeDeleteUser(u.id);
      }
    } else {
      Alert.alert(
        'Potvrda brisanja korisnika',
        confirmMsg,
        [
          { text: 'Otkaži', style: 'cancel' },
          { text: 'Obriši korisnika', style: 'destructive', onPress: () => executeDeleteUser(u.id) }
        ]
      );
    }
  };

  // Filtriranje korisnika za prikaz
  const filteredUsers = users.filter((u) => {
    const q = userSearchQuery.toLowerCase().trim();
    const matchQuery = !q || (
      (u.ime && u.ime.toLowerCase().includes(q)) ||
      (u.prezime && u.prezime.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.telefon && u.telefon.toLowerCase().includes(q)) ||
      (u.firma_naziv && u.firma_naziv.toLowerCase().includes(q))
    );

    const matchRole = roleFilter === 'all' || String(u.rola_id) === String(roleFilter);
    return matchQuery && matchRole;
  });

  const unassignedCount = users.filter(u => Number(u.rola_id) === 3 || !u.firma_id).length;
  const adminUsersCount = users.filter(u => Number(u.rola_id) === 2).length;
  const regularUsersCount = users.filter(u => Number(u.rola_id) === 3).length;
  const superadminUsersCount = users.filter(u => Number(u.rola_id) === 1).length;

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
            <Text style={styles.headerSub}>Upravljanje servisima, licencama i korisnicima</Text>
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

      {/* GLAVNI TAB SWITCHER: 1. SERVISI & LICENCE | 2. KORISNICI & DODELA SERVISA */}
      <View style={styles.mainTabBar}>
        <TouchableOpacity
          style={[styles.mainTabBtn, activeTab === 'firms' && styles.mainTabBtnActive]}
          onPress={() => setActiveTab('firms')}
          activeOpacity={0.8}
        >
          <Building2 size={16} color={activeTab === 'firms' ? '#7C3AED' : '#64748B'} style={{ marginRight: 6 }} />
          <Text style={[styles.mainTabBtnText, activeTab === 'firms' && styles.mainTabBtnTextActive]}>
            Registrovani servisi & Licence ({firme.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.mainTabBtn, activeTab === 'users' && styles.mainTabBtnActive]}
          onPress={() => setActiveTab('users')}
          activeOpacity={0.8}
        >
          <Users size={16} color={activeTab === 'users' ? '#7C3AED' : '#64748B'} style={{ marginRight: 6 }} />
          <Text style={[styles.mainTabBtnText, activeTab === 'users' && styles.mainTabBtnTextActive]}>
            Korisnici & Dodeljivanje servisa ({users.length})
          </Text>
          {unassignedCount > 0 && (
            <View style={styles.unassignedBadge}>
              <Text style={styles.unassignedBadgeText}>{unassignedCount} neraspoređenih</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ==================================================== */}
      {/* TAB 1: SERVISI & LICENCE & SAAS CENOVNIK              */}
      {/* ==================================================== */}
      {activeTab === 'firms' && (
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
                const isMajstoriFull = f.broj_majstora >= f.max_majstora;
                const isNaloziFull = f.broj_naloga_mesec >= f.max_naloga_mesecno;

                return (
                  <View key={f.id} style={styles.firmCard}>
                    {/* Gornji red: Naziv, PIB, Grad i Bedž paketa */}
                    <View style={styles.firmCardTop}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          <Text style={styles.firmName}>{f.naziv}</Text>
                          <View style={[
                            styles.statusBadge,
                            isExpired ? { backgroundColor: '#FEE2E2' } : (isTrial ? { backgroundColor: '#EFF6FF' } : { backgroundColor: '#DCFCE7' })
                          ]}>
                            <Text style={[
                              styles.statusBadgeText,
                              isExpired ? { color: '#DC2626' } : (isTrial ? { color: colors.primary } : { color: colors.success })
                            ]}>
                              {isExpired ? 'ISTEKAO' : (isTrial ? 'PROBNI PERIOD' : 'AKTIVNA LICENCA')}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.firmSubInfo}>
                          PIB: <Text style={{ fontWeight: '700' }}>{f.pib || 'N/A'}</Text> • MB: <Text style={{ fontWeight: '700' }}>{f.maticni_broj || 'N/A'}</Text> • Grad: <Text style={{ fontWeight: '700' }}>{f.grad || 'Smederevo'}</Text>
                        </Text>
                      </View>

                      <View style={styles.firmCardRightCol}>
                        <View style={styles.firmPackageBadge}>
                          <Text style={styles.firmPackageBadgeText}>{f.paket_naziv || f.paket}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Srednji red: Metrike servisa */}
                    <View style={styles.metricsGrid}>
                      <View style={[styles.metricTile, isExpired && styles.metricTileExpired]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                          <Calendar size={13} color={isExpired ? '#DC2626' : '#7C3AED'} style={{ marginRight: 4 }} />
                          <Text style={[styles.metricTileLabel, isExpired && { color: '#DC2626' }]}>Licenca važi do:</Text>
                        </View>
                        <Text style={[styles.metricTileValue, isExpired && { color: '#DC2626' }]}>
                          {f.datum_isteka ? f.datum_isteka.split('-').reverse().join('.') : '30 dana'}
                        </Text>
                        <Text style={[styles.metricTileSub, isExpired && { color: '#DC2626' }]}>
                          {isExpired ? 'ISTEKLA LICENCA (Blokiran pristup)' : `Još ${f.preostalo_dana !== null ? f.preostalo_dana : 30} dana`}
                        </Text>
                      </View>

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

                    {/* Donji red: Izmeni i Obriši */}
                    <View style={styles.firmCardBottom}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.firmBottomHint}>
                          Upravljanje servisom i licencom:
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <TouchableOpacity
                          style={styles.deleteFirmBtn}
                          onPress={() => handleDeleteFirm(f)}
                          disabled={deletingId === f.id}
                          activeOpacity={0.8}
                        >
                          {deletingId === f.id ? (
                            <ActivityIndicator size="small" color="#DC2626" />
                          ) : (
                            <>
                              <Trash2 size={13} color="#DC2626" style={{ marginRight: 4 }} />
                              <Text style={styles.deleteFirmBtnText}>Obriši servis</Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.editFirmBtn}
                          onPress={() => handleEditFirm(f)}
                          activeOpacity={0.8}
                        >
                          <Edit3 size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.editFirmBtnText}>Izmeni servis i licencu</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}

      {/* ==================================================== */}
      {/* TAB 2: SPISAK KORISNIKA, LOZINKE, ROLE I DODELE     */}
      {/* ==================================================== */}
      {activeTab === 'users' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header sekcije sa pretragom i filterima */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Users size={18} color="#7C3AED" style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>
                  Spisak registrovanih korisnika & Dodeljivanje servisa ({filteredUsers.length})
                </Text>
              </View>
              <TouchableOpacity style={styles.addNewFirmBtn} onPress={handleOpenNewUser} activeOpacity={0.8}>
                <UserPlus size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.addNewFirmBtnText}>Dodaj novog korisnika</Text>
              </TouchableOpacity>
            </View>

            {/* Traka za brzu pretragu */}
            <View style={styles.searchBarWrap}>
              <Search size={16} color="#64748B" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchBarInput}
                placeholder="Pretraži po imenu, mejlu, telefonu, roli ili servisu..."
                placeholderTextColor="#94A3B8"
                value={userSearchQuery}
                onChangeText={setUserSearchQuery}
              />
              {userSearchQuery ? (
                <TouchableOpacity onPress={() => setUserSearchQuery('')}>
                  <X size={16} color="#64748B" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Filter po ID ulogama */}
            <View style={styles.roleFilterRow}>
              <TouchableOpacity
                style={[styles.roleFilterChip, roleFilter === 'all' && styles.roleFilterChipActive]}
                onPress={() => setRoleFilter('all')}
              >
                <Text style={[styles.roleFilterText, roleFilter === 'all' && styles.roleFilterTextActive]}>
                  Sve uloge ({users.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleFilterChip, roleFilter === '2' && styles.roleFilterChipActive]}
                onPress={() => setRoleFilter('2')}
              >
                <Text style={[styles.roleFilterText, roleFilter === '2' && styles.roleFilterTextActive]}>
                  [ID 2] Admini servisa ({adminUsersCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleFilterChip, roleFilter === '3' && styles.roleFilterChipActive]}
                onPress={() => setRoleFilter('3')}
              >
                <Text style={[styles.roleFilterText, roleFilter === '3' && styles.roleFilterTextActive]}>
                  [ID 3] Obični korisnici ({regularUsersCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleFilterChip, roleFilter === '1' && styles.roleFilterChipActive]}
                onPress={() => setRoleFilter('1')}
              >
                <Text style={[styles.roleFilterText, roleFilter === '1' && styles.roleFilterTextActive]}>
                  [ID 1] SuperAdmini ({superadminUsersCount})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Kartice korisnika */}
          <View style={{ gap: 12 }}>
            {filteredUsers.length === 0 ? (
              <View style={styles.emptyUsersCard}>
                <Users size={32} color="#94A3B8" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyUsersText}>Nema pronađenih korisnika prema zadatim kriterijumima.</Text>
              </View>
            ) : (
              filteredUsers.map((u) => {
                const roleId = Number(u.rola_id) || 3;
                const isSuper = roleId === 1;
                const isAdmin = roleId === 2;
                const isReg = roleId === 3;

                return (
                  <View key={u.id} style={styles.userCard}>
                    {/* Gornji red: Avatar, Ime, Rola ID Bedž i Status */}
                    <View style={styles.userCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={[
                          styles.userAvatar,
                          isSuper ? { backgroundColor: '#7C3AED' } : (isAdmin ? { backgroundColor: '#0284C7' } : { backgroundColor: '#64748B' })
                        ]}>
                          <Text style={styles.userAvatarText}>
                            {(u.ime ? u.ime.charAt(0) : 'K')}{(u.prezime ? u.prezime.charAt(0) : '')}
                          </Text>
                        </View>

                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <Text style={styles.userFullName}>{u.ime} {u.prezime}</Text>
                            {/* Rola ID Bedž */}
                            <View style={[
                              styles.roleIdBadge,
                              isSuper ? styles.roleBadgeSuper : (isAdmin ? styles.roleBadgeAdmin : styles.roleBadgeUser)
                            ]}>
                              <Text style={[
                                styles.roleIdBadgeText,
                                isSuper ? styles.roleTextSuper : (isAdmin ? styles.roleTextAdmin : styles.roleTextUser)
                              ]}>
                                {isSuper ? 'ID 1 • SuperAdmin' : (isAdmin ? 'ID 2 • Admin servisa' : 'ID 3 • Običan korisnik')}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.userRegDate}>
                            ID #{u.id} • Registrovan: {u.kreiran_at ? u.kreiran_at.split(' ')[0] : 'N/A'}
                          </Text>
                        </View>
                      </View>

                      {/* Status Aktivan / Neaktivan */}
                      <View style={[styles.statusPill, Number(u.aktivan) === 1 ? styles.statusPillActive : styles.statusPillInactive]}>
                        <Text style={[styles.statusPillText, Number(u.aktivan) === 1 ? styles.statusTextActive : styles.statusTextInactive]}>
                          {Number(u.aktivan) === 1 ? 'AKTIVAN' : 'NEAKTIVAN'}
                        </Text>
                      </View>
                    </View>

                    {/* Mreža sa podacima korisnika: Korisničko ime, Lozinka, Telefon, Dodeljeni servis */}
                    <View style={styles.userDataGrid}>
                      {/* Korisničko ime / Email */}
                      <View style={styles.userDataTile}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                          <Mail size={13} color="#64748B" style={{ marginRight: 5 }} />
                          <Text style={styles.userDataLabel}>Korisničko ime / Email:</Text>
                        </View>
                        <Text style={styles.userDataValue} numberOfLines={1}>{u.email}</Text>
                      </View>

                      {/* Lozinka (Jasno prikazana radi administrativne kontrole) */}
                      <View style={[styles.userDataTile, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                          <Key size={13} color="#B45309" style={{ marginRight: 5 }} />
                          <Text style={[styles.userDataLabel, { color: '#92400E' }]}>Lozinka naloga:</Text>
                        </View>
                        <Text style={[styles.userDataValue, { color: '#B45309', fontWeight: '900' }]}>
                          {u.lozinka_tekst || 'majstor123'}
                        </Text>
                      </View>

                      {/* Broj telefona */}
                      <View style={styles.userDataTile}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                          <Phone size={13} color="#64748B" style={{ marginRight: 5 }} />
                          <Text style={styles.userDataLabel}>Broj telefona:</Text>
                        </View>
                        <Text style={styles.userDataValue}>{u.telefon || 'Nije unet'}</Text>
                      </View>

                      {/* Dodeljeni servis */}
                      <View style={[
                        styles.userDataTile,
                        u.firma_id ? { backgroundColor: '#EFF6FF', borderColor: '#BAE6FD' } : { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }
                      ]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                          <Building2 size={13} color={u.firma_id ? '#0284C7' : '#EA580C'} style={{ marginRight: 5 }} />
                          <Text style={[styles.userDataLabel, { color: u.firma_id ? '#0369A1' : '#C2410C' }]}>
                            Dodeljeni servis:
                          </Text>
                        </View>
                        <Text style={[styles.userDataValue, { color: u.firma_id ? '#0369A1' : '#EA580C', fontWeight: '800' }]}>
                          {isSuper
                            ? 'Globalni pristup (Svi servisi)'
                            : (u.firma_naziv ? `${u.firma_naziv} (ID: ${u.firma_id})` : '⚠️ Nema servis (Čeka dodelu)')}
                        </Text>
                      </View>
                    </View>

                    {/* Donja linija sa akcijama: Izmeni / Dodeli i Obriši */}
                    <View style={styles.userCardBottom}>
                      <Text style={styles.userCardBottomHint}>
                        {isReg
                          ? 'Dodelite rolu Administrator servisa (ID 2) i povežite servis za početak rada.'
                          : (isAdmin ? 'Admin upravlja ovim servisom i dodeljuje radnike.' : 'SuperAdministrator nalog platforme.')}
                      </Text>

                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {!isSuper && (
                          <TouchableOpacity
                            style={styles.deleteUserBtn}
                            onPress={() => handleDeleteUser(u)}
                            disabled={deletingUserId === u.id}
                            activeOpacity={0.8}
                          >
                            {deletingUserId === u.id ? (
                              <ActivityIndicator size="small" color="#DC2626" />
                            ) : (
                              <>
                                <Trash2 size={13} color="#DC2626" style={{ marginRight: 4 }} />
                                <Text style={styles.deleteUserBtnText}>Obriši</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          style={styles.editUserBtn}
                          onPress={() => handleEditUser(u)}
                          activeOpacity={0.8}
                        >
                          <Edit3 size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.editUserBtnText}>Izmeni / Dodeli servis i rolu</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* ==================================================== */}
      {/* MODAL 1: DODAVANJE / IZMENA FIRME SA INLINE KALENDAROM*/}
      {/* ==================================================== */}
      <Modal visible={showFirmModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingFirm ? `Izmena servisa: ${editingFirm.naziv}` : 'Registracija novog servisa / firme'}
              </Text>
              <TouchableOpacity onPress={() => setShowFirmModal(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingVertical: 10, gap: 10 }}>
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
                  <Text style={styles.inputLabel}>Telefon</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="026-612-345"
                    value={firmForm.telefon}
                    onChangeText={(t) => setFirmForm({ ...firmForm, telefon: t })}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Email adresa</Text>
              <TextInput
                style={styles.input}
                placeholder="kontakt@servis.rs"
                value={firmForm.email}
                onChangeText={(t) => setFirmForm({ ...firmForm, email: t })}
              />

              {/* Izbor SaaS Paketa */}
              <Text style={styles.inputLabel}>SaaS Pretplatnički Paket</Text>
              <View style={styles.packageSelectRow}>
                {['START', 'STANDARD', 'PRO', 'ENTERPRISE'].map((pk) => (
                  <TouchableOpacity
                    key={pk}
                    style={[styles.packageSelectBtn, firmForm.paket === pk && styles.packageSelectBtnActive]}
                    onPress={() => setFirmForm({ ...firmForm, paket: pk })}
                  >
                    <Text style={[styles.packageSelectBtnText, firmForm.paket === pk && styles.packageSelectBtnTextActive]}>
                      {pk}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Status Licence */}
              <Text style={styles.inputLabel}>Status pretplate / licence</Text>
              <View style={styles.packageSelectRow}>
                {[
                  { code: 'AKTIVAN', label: 'AKTIVNA LICENCA', color: colors.success },
                  { code: 'PROBNI', label: 'PROBNI PERIOD', color: colors.primary },
                  { code: 'ISTEKAO', label: 'ISTEKAO (Blokada)', color: '#DC2626' }
                ].map((st) => (
                  <TouchableOpacity
                    key={st.code}
                    style={[styles.packageSelectBtn, firmForm.status_pretplate === st.code && { backgroundColor: st.color, borderColor: st.color }]}
                    onPress={() => setFirmForm({ ...firmForm, status_pretplate: st.code })}
                  >
                    <Text style={[styles.packageSelectBtnText, firmForm.status_pretplate === st.code && { color: '#FFFFFF' }]}>
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* INLINE KALENDAR ZA IZBOR DATUMA ISTEKA LICENCE */}
              <Text style={styles.inputLabel}>Definisanje važenja licence DO (Datum isteka)</Text>
              <InlineCalendarPicker
                value={firmForm.datum_isteka}
                onChange={(newD) => setFirmForm({ ...firmForm, datum_isteka: newD })}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              {editingFirm && editingFirm.id > 0 && (
                <TouchableOpacity
                  style={styles.modalDeleteBtn}
                  onPress={() => handleDeleteFirm(editingFirm)}
                  disabled={deletingId === editingFirm.id}
                  activeOpacity={0.8}
                >
                  {deletingId === editingFirm.id ? (
                    <ActivityIndicator size="small" color="#DC2626" />
                  ) : (
                    <>
                      <Trash2 size={14} color="#DC2626" style={{ marginRight: 5 }} />
                      <Text style={styles.modalDeleteBtnText}>Obriši servis</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginLeft: 'auto' }}>
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
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL 2: IZMENA / KREIRANJE KORISNIKA I DODELA ROLE & SERVISA */}
      {/* ==================================================== */}
      <Modal visible={showUserModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <UserCheck size={20} color="#7C3AED" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>
                  {editingUser ? `Izmena korisnika: ${editingUser.ime} ${editingUser.prezime}` : 'Unos novog korisničkog naloga'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowUserModal(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingVertical: 10, gap: 12 }}>
              {/* Ime i Prezime */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Ime *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Npr. Jovan"
                    value={userForm.ime}
                    onChangeText={(t) => setUserForm({ ...userForm, ime: t })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Prezime</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Npr. Petrović"
                    value={userForm.prezime}
                    onChangeText={(t) => setUserForm({ ...userForm, prezime: t })}
                  />
                </View>
              </View>

              {/* Email (Korisničko ime) */}
              <View>
                <Text style={styles.inputLabel}>Korisničko ime / Email za prijavu *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="jovan@servis.rs"
                  value={userForm.email}
                  onChangeText={(t) => setUserForm({ ...userForm, email: t })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Lozinka i Telefon */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Lozinka naloga *</Text>
                  <TextInput
                    style={[styles.input, { fontWeight: '700', color: '#B45309', backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}
                    placeholder="majstor123"
                    value={userForm.lozinka}
                    onChangeText={(t) => setUserForm({ ...userForm, lozinka: t })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Broj telefona</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="064-123-4567"
                    value={userForm.telefon}
                    onChangeText={(t) => setUserForm({ ...userForm, telefon: t })}
                  />
                </View>
              </View>

              {/* DEFINISANJE ROLE (ID BROJ ROLE) */}
              <View style={styles.formSectionBox}>
                <Text style={styles.formSectionTitle}>1. Definisanje role (ID broj role):</Text>
                <Text style={styles.formSectionSubtitle}>
                  Izaberite ulogu koja se dodeljuje ovom korisniku:
                </Text>

                <View style={{ gap: 8, marginTop: 8 }}>
                  {/* ID 2: Administrator servisa */}
                  <TouchableOpacity
                    style={[styles.roleSelectCard, userForm.rola_id === 2 && styles.roleSelectCardActiveAdmin]}
                    onPress={() => setUserForm({ ...userForm, rola_id: 2 })}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.roleIdPill, { backgroundColor: '#0284C7' }]}>
                      <Text style={styles.roleIdPillText}>ID 2</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.roleCardTitle, userForm.rola_id === 2 && { color: '#0369A1' }]}>
                        Administrator servisa (admin)
                      </Text>
                      <Text style={styles.roleCardDesc}>
                        Vodi servis, ima pristup dispečerskom centru i unosi radnike svog servisa.
                      </Text>
                    </View>
                    {userForm.rola_id === 2 && <Check size={18} color="#0284C7" />}
                  </TouchableOpacity>

                  {/* ID 3: Običan korisnik */}
                  <TouchableOpacity
                    style={[styles.roleSelectCard, userForm.rola_id === 3 && styles.roleSelectCardActiveUser]}
                    onPress={() => setUserForm({ ...userForm, rola_id: 3 })}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.roleIdPill, { backgroundColor: '#64748B' }]}>
                      <Text style={styles.roleIdPillText}>ID 3</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.roleCardTitle, userForm.rola_id === 3 && { color: '#334155' }]}>
                        Običan korisnik (korisnik)
                      </Text>
                      <Text style={styles.roleCardDesc}>
                        Početni status nakon registracije, nema dodeljen servis dok ga SuperAdmin ne postavi.
                      </Text>
                    </View>
                    {userForm.rola_id === 3 && <Check size={18} color="#475569" />}
                  </TouchableOpacity>

                  {/* ID 1: Super Administrator */}
                  <TouchableOpacity
                    style={[styles.roleSelectCard, userForm.rola_id === 1 && styles.roleSelectCardActiveSuper]}
                    onPress={() => setUserForm({ ...userForm, rola_id: 1, firma_id: null })}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.roleIdPill, { backgroundColor: '#7C3AED' }]}>
                      <Text style={styles.roleIdPillText}>ID 1</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.roleCardTitle, userForm.rola_id === 1 && { color: '#6D28D9' }]}>
                        Super Administrator (superadmin)
                      </Text>
                      <Text style={styles.roleCardDesc}>
                        Globalni administrator platforme, vidi sve i ne pripada nijednoj pojedinačnoj firmi.
                      </Text>
                    </View>
                    {userForm.rola_id === 1 && <Check size={18} color="#7C3AED" />}
                  </TouchableOpacity>
                </View>
              </View>

              {/* DODELJIVANJE SERVISA */}
              {userForm.rola_id === 1 ? (
                <View style={styles.superNoticeBox}>
                  <ShieldCheck size={16} color="#7C3AED" style={{ marginRight: 8 }} />
                  <Text style={styles.superNoticeText}>
                    SuperAdministrator ima globalni pristup celom sistemu i ne vezuje se ni za jedan pojedinačni servis.
                  </Text>
                </View>
              ) : (
                <View style={styles.formSectionBox}>
                  <Text style={styles.formSectionTitle}>2. Dodeljivanje servisa ovom korisniku / adminu:</Text>
                  <Text style={styles.formSectionSubtitle}>
                    Izaberite servis kojim ovaj administrator upravlja:
                  </Text>

                  <View style={{ gap: 6, marginTop: 8 }}>
                    {/* Opcija: Neraspoređen / Bez servisa */}
                    <TouchableOpacity
                      style={[
                        styles.firmSelectRow,
                        userForm.firma_id === null && styles.firmSelectRowActive
                      ]}
                      onPress={() => setUserForm({ ...userForm, firma_id: null })}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.firmSelectName, userForm.firma_id === null && { color: '#DC2626' }]}>
                          ⚠️ Bez dodeljenog servisa (Neraspoređen)
                        </Text>
                        <Text style={styles.firmSelectSub}>
                          Korisnik se neće moći prijaviti dok mu se ne dodeli aktivan servis.
                        </Text>
                      </View>
                      {userForm.firma_id === null && <Check size={16} color="#DC2626" />}
                    </TouchableOpacity>

                    {/* Lista svih registrovanih firmi */}
                    {firme.map((f) => {
                      const isSelected = userForm.firma_id === f.id;
                      return (
                        <TouchableOpacity
                          key={f.id}
                          style={[
                            styles.firmSelectRow,
                            isSelected && styles.firmSelectRowActive
                          ]}
                          onPress={() => setUserForm({ ...userForm, firma_id: f.id })}
                        >
                          <Building2 size={16} color={isSelected ? '#0284C7' : '#64748B'} style={{ marginRight: 8 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.firmSelectName, isSelected && { color: '#0369A1' }]}>
                              {f.naziv}
                            </Text>
                            <Text style={styles.firmSelectSub}>
                              ID: {f.id} • Grad: {f.grad || 'Smederevo'} • Paket: {f.paket}
                            </Text>
                          </View>
                          {isSelected && <Check size={16} color="#0284C7" />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Status aktivnosti naloga */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text style={styles.inputLabel}>Nalog je aktivan:</Text>
                <TouchableOpacity
                  style={[styles.activeToggleBtn, userForm.aktivan === 1 ? styles.activeToggleOn : styles.activeToggleOff]}
                  onPress={() => setUserForm({ ...userForm, aktivan: userForm.aktivan === 1 ? 0 : 1 })}
                >
                  <Text style={[styles.activeToggleText, userForm.aktivan === 1 ? styles.activeTextOn : styles.activeTextOff]}>
                    {userForm.aktivan === 1 ? '✓ Aktivan nalog' : '✗ Blokiran / Deaktiviran'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <View style={{ flexDirection: 'row', gap: 10, marginLeft: 'auto' }}>
                <TouchableOpacity
                  style={styles.cancelModalBtn}
                  onPress={() => setShowUserModal(false)}
                >
                  <Text style={styles.cancelModalBtnText}>Otkaži</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveModalBtn, savingUser && { opacity: 0.7 }]}
                  onPress={handleSaveUser}
                  disabled={savingUser}
                >
                  {savingUser ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveModalBtnText}>Sačuvaj korisnika</Text>
                  )}
                </TouchableOpacity>
              </View>
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  headerActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },

  // GLAVNI TAB SWITCHER
  mainTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 16,
    gap: 12
  },
  mainTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent'
  },
  mainTabBtnActive: {
    borderBottomColor: '#7C3AED'
  },
  mainTabBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#64748B'
  },
  mainTabBtnTextActive: {
    color: '#7C3AED',
    fontWeight: '900'
  },
  unassignedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6
  },
  unassignedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309'
  },

  scroll: {
    padding: 16,
    gap: 16
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4
  },
  statLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4
  },

  // Sections
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
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
    paddingVertical: 7,
    borderRadius: 8
  },
  addNewFirmBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800'
  },

  // Packages Row
  packagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  packageCard: {
    flex: 1,
    minWidth: 180,
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
    fontSize: 11,
    fontWeight: '800'
  },
  firmSubInfo: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3
  },
  firmCardRightCol: {
    alignItems: 'flex-end'
  },
  firmPackageBadge: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  firmPackageBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#7C3AED'
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  metricTile: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  metricTileExpired: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA'
  },
  metricTileWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A'
  },
  metricTileDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA'
  },
  metricTileLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B'
  },
  metricTileValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A'
  },
  metricTileMax: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B'
  },
  metricTileSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2
  },
  firmCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10
  },
  firmBottomHint: {
    fontSize: 11.5,
    color: '#64748B',
    fontStyle: 'italic'
  },
  deleteFirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  deleteFirmBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700'
  },
  editFirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  editFirmBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },

  // ==========================================================
  // STILOVI ZA TAB KORISNIKA
  // ==========================================================
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A'
  },
  roleFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10
  },
  roleFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  roleFilterChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED'
  },
  roleFilterText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B'
  },
  roleFilterTextActive: {
    color: '#FFFFFF'
  },
  emptyUsersCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  emptyUsersText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center'
  },

  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12
  },
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14
  },
  userFullName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A'
  },
  roleIdBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6
  },
  roleBadgeSuper: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF'
  },
  roleBadgeAdmin: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BAE6FD'
  },
  roleBadgeUser: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  roleIdBadgeText: {
    fontSize: 11,
    fontWeight: '900'
  },
  roleTextSuper: {
    color: '#7C3AED'
  },
  roleTextAdmin: {
    color: '#0284C7'
  },
  roleTextUser: {
    color: '#475569'
  },
  userRegDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  statusPillActive: {
    backgroundColor: '#DCFCE7'
  },
  statusPillInactive: {
    backgroundColor: '#FEE2E2'
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '900'
  },
  statusTextActive: {
    color: '#059669'
  },
  statusTextInactive: {
    color: '#DC2626'
  },

  userDataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  userDataTile: {
    flex: 1,
    minWidth: 180,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  userDataLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B'
  },
  userDataValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A'
  },

  userCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
    flexWrap: 'wrap'
  },
  userCardBottomHint: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    flex: 1
  },
  deleteUserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  deleteUserBtnText: {
    color: '#DC2626',
    fontSize: 11.5,
    fontWeight: '800'
  },
  editUserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  editUserBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800'
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContent: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  modalTitle: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#0F172A'
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 4
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
  packageSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6
  },
  packageSelectBtn: {
    flex: 1,
    minWidth: 80,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    backgroundColor: '#F8FAFC'
  },
  packageSelectBtnActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED'
  },
  packageSelectBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#475569'
  },
  packageSelectBtnTextActive: {
    color: '#FFFFFF'
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 10
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
  modalDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  modalDeleteBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626'
  },

  // Form Section Boxes unutar User Modala
  formSectionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  formSectionTitle: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#0F172A'
  },
  formSectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1
  },
  roleSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 8
  },
  roleSelectCardActiveAdmin: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF'
  },
  roleSelectCardActiveUser: {
    borderColor: '#64748B',
    backgroundColor: '#F8FAFC'
  },
  roleSelectCardActiveSuper: {
    borderColor: '#7C3AED',
    backgroundColor: '#FAF5FF'
  },
  roleIdPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  roleIdPillText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11
  },
  roleCardTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A'
  },
  roleCardDesc: {
    fontSize: 10.5,
    color: '#64748B'
  },
  superNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 8,
    padding: 10
  },
  superNoticeText: {
    fontSize: 11.5,
    color: '#6D28D9',
    fontWeight: '700',
    flex: 1
  },
  firmSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  firmSelectRowActive: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF'
  },
  firmSelectName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A'
  },
  firmSelectSub: {
    fontSize: 10.5,
    color: '#64748B'
  },
  activeToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  activeToggleOn: {
    backgroundColor: '#DCFCE7'
  },
  activeToggleOff: {
    backgroundColor: '#FEE2E2'
  },
  activeToggleText: {
    fontSize: 11.5,
    fontWeight: '800'
  },
  activeTextOn: {
    color: '#059669'
  },
  activeTextOff: {
    color: '#DC2626'
  },

  // Inline Calendar Styles
  inlineCalContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  inlineCalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  inlineCalNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  inlineCalMonthTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A'
  },
  inlineCalMonthSub: {
    fontSize: 10.5,
    color: '#64748B'
  },
  inlineCalWeekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  inlineCalWeekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B'
  },
  inlineCalDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4
  },
  inlineCalEmptyCell: {
    width: '14.28%',
    height: 32
  },
  inlineCalDayCell: {
    width: '14.28%',
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6
  },
  inlineCalDayCellSelected: {
    backgroundColor: '#7C3AED'
  },
  inlineCalDayCellToday: {
    borderWidth: 1,
    borderColor: '#7C3AED',
    backgroundColor: '#FAF5FF'
  },
  inlineCalDayNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A'
  },
  inlineCalDayNumberSelected: {
    color: '#FFFFFF',
    fontWeight: '800'
  },
  inlineCalDayNumberToday: {
    color: '#7C3AED',
    fontWeight: '800'
  },
  inlineCalShortcutsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginTop: 8,
    marginBottom: 4
  },
  inlineCalShortcutsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  inlineCalShortcutBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  inlineCalShortcutText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155'
  }
});
