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
  Key,
  X,
  Check,
  Building2,
  Mail,
  Phone,
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
  UserCheck,
  UserX,
  CalendarDays,
  ChevronDown
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import MapComponent from '../components/MapComponent';

const TIP_INTERVENCIJE_OPTIONS = [
  { id: 'REDOVAN_SERVIS', label: 'Redovan servis' },
  { id: 'POPRAVKA_KVAR', label: 'Popravka / Kvar' },
  { id: 'MONTAZA', label: 'Montaža' },
  { id: 'DIJAGNOSTIKA', label: 'Dijagnostika' },
  { id: 'GARANCIJA', label: 'Garancija' }
];

const PRIORITET_OPTIONS = [
  { id: 'NORMALAN', label: 'Normalan', color: '#0284C7' },
  { id: 'VISOK', label: 'Visok', color: '#D97706' },
  { id: 'HITNO', label: 'Hitno', color: '#DC2626' }
];

const formatDateSerbian = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}.`;
  }
  return dateStr;
};

// ==========================================================
// INTERAKTIVNI KALENDAR KOMPONENTA SA MESECIMA I DANIMA
// ==========================================================
function MonthCalendarPicker({ value, onChange, ordersCountByDate = {} }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (!value) return new Date();
    const parts = value.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
    }
    return new Date();
  });

  useEffect(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        setCurrentMonth(new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1));
      }
    }
  }, [value]);

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

  const setToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onChange(today.toISOString().split('T')[0]);
  };

  const firstDayRaw = new Date(year, month, 1).getDay();
  const startDayOffset = (firstDayRaw + 6) % 7; // Ponedeljak = 0
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

  return (
    <View style={styles.calCard}>
      {/* Zaglavlje kalendara sa navigacijom kroz mesece */}
      <View style={styles.calHeaderRow}>
        <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn} activeOpacity={0.7}>
          <ChevronLeft size={16} color="#0F172A" />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={styles.calMonthTitle}>{monthNames[month]} {year}</Text>
          <Text style={styles.calMonthSub}>Izaberite dan za prikaz radnih naloga</Text>
        </View>

        <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn} activeOpacity={0.7}>
          <ChevronRight size={16} color="#0F172A" />
        </TouchableOpacity>
      </View>

      {/* Dani u nedelji */}
      <View style={styles.calWeekdaysRow}>
        {['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'].map((wd, i) => (
          <Text key={i} style={[styles.calWeekdayText, (i === 5 || i === 6) && { color: '#DC2626' }]}>
            {wd}
          </Text>
        ))}
      </View>

      {/* Mreža dana u mesecu */}
      <View style={styles.calDaysGrid}>
        {daysGrid.map((item) => {
          if (item.empty) {
            return <View key={item.id} style={styles.calEmptyCell} />;
          }

          const isSelected = value === item.dateStr;
          const isToday = todayStr === item.dateStr;
          const count = ordersCountByDate[item.dateStr] || 0;

          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.calDayCell,
                isSelected && styles.calDayCellSelected,
                isToday && !isSelected && styles.calDayCellToday
              ]}
              onPress={() => onChange(item.dateStr)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.calDayNumber,
                  isSelected && styles.calDayNumberSelected,
                  isToday && !isSelected && styles.calDayNumberToday
                ]}
              >
                {item.day}
              </Text>
              {count > 0 && !isSelected && (
                <View style={styles.calBadgeDot}>
                  <Text style={styles.calBadgeDotText}>{count > 9 ? '9+' : count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Donja linija kalendara: Dugme za danas i info */}
      <View style={styles.calFooterBar}>
        <TouchableOpacity style={styles.calTodayBtn} onPress={setToday} activeOpacity={0.7}>
          <Calendar size={13} color="#0284C7" style={{ marginRight: 4 }} />
          <Text style={styles.calTodayBtnText}>Danas</Text>
        </TouchableOpacity>
        <Text style={styles.calSelectedInfo}>
          Izabran datum: <Text style={{ fontWeight: '800', color: '#0284C7' }}>{formatDateSerbian(value)}</Text>
        </Text>
      </View>
    </View>
  );
}

// ==========================================================
// GLAVNI EKRAN DISPEČERA
// ==========================================================
export default function DispatcherScreen({ onBackToWorker, onSelectOrder }) {
  const { user, firmId, logout, isAdmin, isOwner, isSuperAdmin } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [showCalendar, setShowCalendar] = useState(true); // Kalendar sa mesecima i danima otvoren
  const [orderFilter, setOrderFilter] = useState('ALL'); // 'ALL' | 'UNASSIGNED_OR_PENDING' | 'IN_PROGRESS' | 'DONE'

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workers, setWorkers] = useState([]);
  const [orders, setOrders] = useState([]);

  // Modal za kreiranje novog radnog naloga
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [isWorkerDropdownOpen, setIsWorkerDropdownOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({
    klijent_ime: '',
    telefon: '',
    adresa: '',
    grad: 'Smederevo',
    tip_intervencije: 'REDOVAN_SERVIS',
    prioritet: 'NORMALAN',
    opis_kvara: '',
    majstor_id: '',
    zakazano_datum: todayStr,
    zakazano_vreme: '10:00'
  });

  const loadDashboard = useCallback(async (targetDate = selectedDate) => {
    try {
      const data = await api.getDispatcherDashboard(firmId, targetDate);
      setWorkers(data.workers || []);
      setOrders(data.orders || []);
    } catch (err) {
      console.warn('Greška dispečera:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [firmId, selectedDate]);

  useEffect(() => {
    loadDashboard(selectedDate);
    const interval = setInterval(() => loadDashboard(selectedDate), 10000);
    return () => clearInterval(interval);
  }, [loadDashboard, selectedDate]);

  // Broj naloga po danima za indikatore u kalendaru
  const ordersCountByDate = {};
  orders.forEach(o => {
    const d = o.zakazano_za ? o.zakazano_za.split(' ')[0] : (o.kreiran_at ? o.kreiran_at.split(' ')[0] : '');
    if (d) {
      ordersCountByDate[d] = (ordersCountByDate[d] || 0) + 1;
    }
  });

  // Radni nalozi koji su preuzeti od strane radnika na terenu
  const fieldOrders = orders.filter(o => 
    ['PRIHVACENO', 'NA_PUTU', 'U_RADU'].includes(o.status) && (o.majstor_id || o.majstor_ime)
  );

  // Filtrirani nalozi za odabrani datum
  const dateOrders = orders.filter(o => {
    const orderDate = o.zakazano_za ? o.zakazano_za.split(' ')[0] : (o.kreiran_at ? o.kreiran_at.split(' ')[0] : '');
    const matchesDate = orderDate === selectedDate || (!orderDate && selectedDate === todayStr);

    if (!matchesDate) return false;

    if (orderFilter === 'UNASSIGNED_OR_PENDING') {
      return !o.majstor_id || ['KREIRANO', 'DODELJENO'].includes(o.status);
    }
    if (orderFilter === 'IN_PROGRESS') {
      return ['PRIHVACENO', 'NA_PUTU', 'U_RADU'].includes(o.status);
    }
    if (orderFilter === 'DONE') {
      return o.status === 'ZAVRSENO';
    }
    return true;
  });

  // Otvaranje forme za novi nalog
  const handleOpenCreateOrder = () => {
    setOrderError('');
    setIsWorkerDropdownOpen(false);
    setOrderForm({
      klijent_ime: '',
      telefon: '',
      adresa: '',
      grad: 'Smederevo',
      tip_intervencije: 'REDOVAN_SERVIS',
      prioritet: 'NORMALAN',
      opis_kvara: '',
      majstor_id: '', // Podrazumevano: Bez dodele radnika
      zakazano_datum: selectedDate || todayStr,
      zakazano_vreme: '10:00'
    });
    setShowCreateOrderModal(true);
  };

  const handleSaveOrder = async () => {
    if (!orderForm.klijent_ime.trim()) {
      setOrderError('Ime i prezime klijenta je obavezno polje.');
      return;
    }
    if (!orderForm.adresa.trim()) {
      setOrderError('Adresa intervencije je obavezna.');
      return;
    }
    if (!orderForm.opis_kvara.trim()) {
      setOrderError('Opis kvara ili intervencije je obavezno polje.');
      return;
    }

    setCreatingOrder(true);
    setOrderError('');
    try {
      const zakazano_za = `${orderForm.zakazano_datum} ${orderForm.zakazano_vreme || '10:00'}:00`;
      const res = await api.createOrder({
        firma_id: firmId,
        klijent_ime: orderForm.klijent_ime.trim(),
        telefon: orderForm.telefon.trim(),
        adresa: orderForm.adresa.trim(),
        grad: orderForm.grad.trim() || 'Smederevo',
        tip_intervencije: orderForm.tip_intervencije,
        prioritet: orderForm.prioritet,
        opis_kvara: orderForm.opis_kvara.trim(),
        majstor_id: orderForm.majstor_id ? Number(orderForm.majstor_id) : null,
        zakazano_za,
        kreirao_id: user?.id || null
      });

      setShowCreateOrderModal(false);
      loadDashboard(selectedDate);
      const successMsg = `Radni nalog ${res?.broj_naloga || ''} je uspešno kreiran!`;
      if (Platform.OS === 'web') {
        window.alert(successMsg);
      } else {
        Alert.alert('Uspešno', successMsg);
      }
    } catch (err) {
      setOrderError(err.message || 'Greška pri kreiranju radnog naloga.');
    } finally {
      setCreatingOrder(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'U_RADU':
        return { label: 'U RADU', color: colors.warning, bg: '#FEF3C7', text: '#B45309' };
      case 'NA_PUTU':
        return { label: 'NA PUTU', color: colors.primary, bg: '#E0F2FE', text: '#0369A1' };
      case 'PRIHVACENO':
        return { label: 'PRIHVAĆENO', color: '#6366F1', bg: '#EEF2FF', text: '#4338CA' };
      case 'ZAVRSENO':
        return { label: 'ZAVRŠENO', color: colors.success, bg: '#ECFDF5', text: '#047857' };
      case 'DODELJENO':
        return { label: 'DODELJENO', color: '#0284C7', bg: '#F0F9FF', text: '#0284C7' };
      case 'KREIRANO':
      default:
        return { label: 'KREIRANO', color: '#8B5CF6', bg: '#F5F3FF', text: '#7C3AED' };
    }
  };

  return (
    <View style={styles.container}>
      {/* Gornje zaglavlje (Header) sa jednim glavnim dugmetom za Novi nalog */}
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
          {(isAdmin || isOwner || isSuperAdmin) && (
            <TouchableOpacity
              style={styles.headerCreateBtn}
              onPress={handleOpenCreateOrder}
              activeOpacity={0.8}
            >
              <Plus size={15} color="#FFFFFF" style={{ marginRight: 5 }} />
              <Text style={styles.headerCreateBtnText}>Novi nalog</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.iconBtn} onPress={() => loadDashboard(selectedDate)} activeOpacity={0.8}>
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
          {/* Leva kolona: Interaktivna mapa terena */}
          <View style={[styles.mapCol, isDesktop && { flex: 1.15 }]}>
            <View style={styles.mapCard}>
              <View style={styles.mapHeaderBar}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
                  <View>
                    <Text style={styles.mapHeaderTitle}>Karta terena uživo (Majstori i intervencije)</Text>
                    <Text style={styles.mapHeaderSub}>{workers.length} majstora • {fieldOrders.length} naloga u radu</Text>
                  </View>
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
                height={isDesktop ? 570 : 280}
              />
            </View>
          </View>

          {/* Desna kolona: Ekipe na terenu i Radni nalozi za datum sa kalendarom */}
          <ScrollView
            style={[styles.listCol, isDesktop && { flex: 1.1 }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDashboard(selectedDate)} />}
          >
            {/* ========================================================== */}
            {/* KARTICA 1: EKIPE NA TERENU (Preuzeti nalozi od radnika)      */}
            {/* ========================================================== */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Users size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.sectionTitle}>Ekipe na terenu ({fieldOrders.length})</Text>
              </View>
              <Text style={styles.sectionDescription}>
                Radni nalozi koje su radnici preuzeli i koji su u toku rada na lokaciji
              </Text>

              <View style={{ gap: 8, marginTop: 8 }}>
                {fieldOrders.length === 0 ? (
                  <View style={styles.emptyStateWrap}>
                    <Truck size={24} color="#94A3B8" style={{ marginBottom: 4 }} />
                    <Text style={styles.emptyStateTitle}>Trenutno nema preuzetih radnih naloga na terenu.</Text>
                    <Text style={styles.emptyStateSub}>Čim radnik prihvati nalog ili krene na lokaciju, nalog će se prikazati ovde.</Text>
                  </View>
                ) : (
                  fieldOrders.map(fo => {
                    const sb = getStatusBadge(fo.status);
                    return (
                      <TouchableOpacity
                        key={fo.id}
                        style={styles.fieldOrderCard}
                        onPress={() => onSelectOrder && onSelectOrder(fo.id)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={[styles.workerAvatarSmall, { backgroundColor: fo.majstor_boja || '#059669' }]}>
                              <Text style={styles.workerAvatarSmallText}>
                                {fo.majstor_ime ? fo.majstor_ime.charAt(0) : 'R'}{fo.majstor_prezime ? fo.majstor_prezime.charAt(0) : ''}
                              </Text>
                            </View>
                            <View>
                              <Text style={styles.fieldNameText}>{fo.majstor_ime} {fo.majstor_prezime}</Text>
                              <Text style={styles.fieldPhoneText}>📞 {fo.majstor_telefon || fo.telefon || '-'}</Text>
                            </View>
                          </View>
                          <View style={[styles.statusBadgePill, { backgroundColor: sb.bg }]}>
                            <Text style={[styles.statusBadgePillText, { color: sb.text }]}>{sb.label}</Text>
                          </View>
                        </View>

                        <View style={styles.fieldOrderDetailsBox}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={styles.fieldRnNumber}>{fo.broj_naloga}</Text>
                            <Text style={styles.fieldClientName}>👤 {fo.klijent_ime}</Text>
                          </View>
                          <Text style={styles.fieldAddressText}>📍 {fo.adresa}</Text>
                          {fo.opis_kvara ? (
                            <Text style={styles.fieldFaultText} numberOfLines={2}>Kvar: {fo.opis_kvara}</Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>

            {/* ========================================================== */}
            {/* KARTICA 2: RADNI NALOZI ZA DATUM SA KALENDAROM MESECI/DANA  */}
            {/* ========================================================== */}
            <View style={[styles.sectionCard, { marginTop: 14 }]}>
              {/* Naslov sekcije sa odabranim datumom i toggle dugmetom */}
              <View style={[styles.sectionTitleRow, { justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Briefcase size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.sectionTitle}>
                    Radni nalozi za datum: <Text style={{ color: '#0284C7' }}>{formatDateSerbian(selectedDate)}</Text> ({dateOrders.length})
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.toggleCalBtn}
                  onPress={() => setShowCalendar(p => !p)}
                  activeOpacity={0.7}
                >
                  <CalendarDays size={13} color="#0284C7" style={{ marginRight: 4 }} />
                  <Text style={styles.toggleCalBtnText}>{showCalendar ? 'Sakrij kalendar' : 'Prikaži kalendar'}</Text>
                </TouchableOpacity>
              </View>

              {/* KALENDAR SA MESECIMA I DANIMA (OTVOREN ZA IZBOR ODREĐENOG DANA) */}
              {showCalendar && (
                <View style={{ marginTop: 8 }}>
                  <MonthCalendarPicker
                    value={selectedDate}
                    onChange={(newDate) => {
                      setSelectedDate(newDate);
                    }}
                    ordersCountByDate={ordersCountByDate}
                  />
                </View>
              )}

              {/* Filter chips za brzi pregled nepreuzetih naloga za taj datum */}
              <View style={[styles.filterChipsRow, { marginTop: 10 }]}>
                <TouchableOpacity
                  style={[styles.filterChip, orderFilter === 'ALL' && styles.filterChipActive]}
                  onPress={() => setOrderFilter('ALL')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, orderFilter === 'ALL' && styles.filterChipTextActive]}>
                    Svi za dan ({orders.filter(o => o.zakazano_za?.startsWith(selectedDate) || o.kreiran_at?.startsWith(selectedDate)).length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterChip, orderFilter === 'UNASSIGNED_OR_PENDING' && styles.filterChipActiveOrange]}
                  onPress={() => setOrderFilter('UNASSIGNED_OR_PENDING')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, orderFilter === 'UNASSIGNED_OR_PENDING' && { color: '#FFFFFF' }]}>
                    Nepreuzeti / Nedodeljeni
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filterChip, orderFilter === 'IN_PROGRESS' && styles.filterChipActive]}
                  onPress={() => setOrderFilter('IN_PROGRESS')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, orderFilter === 'IN_PROGRESS' && styles.filterChipTextActive]}>
                    U radu
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Lista naloga za odabrani datum */}
              <View style={{ gap: 10, marginTop: 8 }}>
                {dateOrders.length === 0 ? (
                  <View style={styles.emptyStateWrap}>
                    <Text style={styles.emptyStateTitle}>Nema radnih naloga za datum {formatDateSerbian(selectedDate)}.</Text>
                    <Text style={styles.emptyStateSub}>Izaberite drugi dan na kalendaru iznad ili kliknite na "+ Novi nalog" u headeru.</Text>
                  </View>
                ) : (
                  dateOrders.map(o => {
                    const sb = getStatusBadge(o.status);
                    const hasWorker = Boolean(o.majstor_id && (o.majstor_ime || o.majstor_prezime));

                    return (
                      <TouchableOpacity
                        key={o.id}
                        style={styles.orderCardDetailed}
                        onPress={() => onSelectOrder && onSelectOrder(o.id)}
                        activeOpacity={0.7}
                      >
                        {/* 1. Red: Broj naloga (001/2026), status i prioritet */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.orderNumberLarge}>{o.broj_naloga}</Text>
                            {o.prioritet === 'HITNO' && (
                              <View style={styles.urgentBadge}>
                                <Text style={styles.urgentBadgeText}>HITNO</Text>
                              </View>
                            )}
                          </View>
                          <View style={[styles.statusBadgePill, { backgroundColor: sb.bg }]}>
                            <Text style={[styles.statusBadgePillText, { color: sb.text }]}>{sb.label}</Text>
                          </View>
                        </View>

                        {/* 2. Red: Klijent, telefon i adresa */}
                        <Text style={styles.orderClientText}>👤 {o.klijent_ime} {o.klijent_telefon ? `(${o.klijent_telefon})` : ''}</Text>
                        <Text style={styles.orderAddressText}>📍 {o.adresa}, {o.grad || 'Smederevo'}</Text>
                        {o.opis_kvara ? (
                          <Text style={styles.orderFaultText} numberOfLines={2}>Kvar: {o.opis_kvara}</Text>
                        ) : null}

                        {/* 3. Red: Vreme zakazivanja */}
                        {o.zakazano_za ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <Clock size={11} color="#64748B" style={{ marginRight: 4 }} />
                            <Text style={styles.orderTimeText}>Zakazano za: {o.zakazano_za}</Text>
                          </View>
                        ) : null}

                        {/* 4. RED — OBAVEZNO NA KRAJU: DODELJENI RADNIK ILI NEDODELJEN SA NARANDŽASTOM POZADINOM */}
                        <View style={styles.workerAssignmentFooter}>
                          {hasWorker ? (
                            <View style={styles.assignedWorkerPill}>
                              <View style={[styles.workerDotSmall, { backgroundColor: o.majstor_boja || '#059669' }]} />
                              <Text style={styles.assignedWorkerPillText}>
                                Dodeljen radnik: <Text style={{ fontWeight: '800' }}>{o.majstor_ime} {o.majstor_prezime}</Text>
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.unassignedWorkerPill}>
                              <AlertTriangle size={12} color="#FFFFFF" style={{ marginRight: 5 }} />
                              <Text style={styles.unassignedWorkerPillText}>Nedodeljen</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      )}

      {/* MODAL: KREIRANJE NOVOG RADNOG NALOGA (otvara se klikom na "+ Novi nalog" u headeru) */}
      <Modal visible={showCreateOrderModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 560 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Kreiranje radnog naloga</Text>
                <Text style={styles.modalSub}>
                  Nalog dobija jedinstveni broj formata 001/2026 za servis: {user?.firma_naziv || 'Vaš servis'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowCreateOrderModal(false)} style={styles.closeBtn} activeOpacity={0.7}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {orderError ? (
              <View style={styles.errBox}>
                <AlertTriangle size={15} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.errText}>{orderError}</Text>
              </View>
            ) : null}

            <ScrollView style={{ maxHeight: 470 }}>
              {/* Sekcija 1: Klijent i lokacija */}
              <Text style={styles.sectionSubtitle}>1. Podaci o klijentu i adresi</Text>

              <View style={styles.formRow2}>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.label}>Ime i prezime klijenta *</Text>
                  <TextInput
                    style={styles.input}
                    value={orderForm.klijent_ime}
                    onChangeText={(t) => setOrderForm(p => ({ ...p, klijent_ime: t }))}
                    placeholder="npr. Dragan Stanković"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Broj telefona</Text>
                  <TextInput
                    style={styles.input}
                    value={orderForm.telefon}
                    onChangeText={(t) => setOrderForm(p => ({ ...p, telefon: t }))}
                    placeholder="06x-xxx-xxxx"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.formRow2}>
                <View style={{ flex: 1.3 }}>
                  <Text style={styles.label}>Adresa intervencije *</Text>
                  <TextInput
                    style={styles.input}
                    value={orderForm.adresa}
                    onChangeText={(t) => setOrderForm(p => ({ ...p, adresa: t }))}
                    placeholder="Ulica i broj"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={{ flex: 0.9 }}>
                  <Text style={styles.label}>Grad</Text>
                  <TextInput
                    style={styles.input}
                    value={orderForm.grad}
                    onChangeText={(t) => setOrderForm(p => ({ ...p, grad: t }))}
                    placeholder="Smederevo"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Sekcija 2: Detalji intervencije i prioritet */}
              <Text style={[styles.sectionSubtitle, { marginTop: 12 }]}>2. Detalji intervencije i prioritet</Text>

              <Text style={styles.label}>Tip intervencije:</Text>
              <View style={styles.chipsRow}>
                {TIP_INTERVENCIJE_OPTIONS.map(opt => {
                  const isSel = orderForm.tip_intervencije === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.chipBtn, isSel && styles.chipBtnActive]}
                      onPress={() => setOrderForm(p => ({ ...p, tip_intervencije: opt.id }))}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipBtnText, isSel && styles.chipBtnTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Prioritet naloga:</Text>
              <View style={styles.chipsRow}>
                {PRIORITET_OPTIONS.map(opt => {
                  const isSel = orderForm.prioritet === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.chipBtn,
                        isSel && { backgroundColor: opt.color, borderColor: opt.color }
                      ]}
                      onPress={() => setOrderForm(p => ({ ...p, prioritet: opt.id }))}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipBtnText, isSel && { color: '#FFFFFF' }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Opis kvara / radova za majstora *</Text>
              <TextInput
                style={[styles.input, { minHeight: 65, textAlignVertical: 'top' }]}
                value={orderForm.opis_kvara}
                onChangeText={(t) => setOrderForm(p => ({ ...p, opis_kvara: t }))}
                placeholder="Detaljan opis problema (npr. Bojler ne greje vodu, klima uređaj curi...)"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />

              {/* Sekcija 3: Termin i Dodeljivanje već unetog radnika iz padajućeg menija */}
              <Text style={[styles.sectionSubtitle, { marginTop: 12 }]}>3. Termin i dodeljivanje radnika (Opciono)</Text>

              <View style={styles.formRow2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Datum zakazivanja</Text>
                  <TextInput
                    style={styles.input}
                    value={orderForm.zakazano_datum}
                    onChangeText={(t) => setOrderForm(p => ({ ...p, zakazano_datum: t }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Vreme zakazivanja</Text>
                  <TextInput
                    style={styles.input}
                    value={orderForm.zakazano_vreme}
                    onChangeText={(t) => setOrderForm(p => ({ ...p, zakazano_vreme: t }))}
                    placeholder="npr. 10:00"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <Text style={styles.label}>Izbor radnika (Padajući meni - opciono):</Text>
              
              {/* TRIGGER PADAJUĆEG MENIJA */}
              <TouchableOpacity
                style={[
                  styles.dropdownTrigger,
                  isWorkerDropdownOpen && styles.dropdownTriggerActive,
                  !orderForm.majstor_id && { borderColor: '#FDBA74', backgroundColor: '#FFF7ED' }
                ]}
                onPress={() => setIsWorkerDropdownOpen(prev => !prev)}
                activeOpacity={0.8}
              >
                {(() => {
                  const selectedWorker = workers.find(w => String(w.id) === String(orderForm.majstor_id));
                  if (selectedWorker) {
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={[styles.workerSelectDot, { backgroundColor: selectedWorker.boja_markera || '#059669' }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.workerSelectName, { color: '#0369A1' }]}>
                            {selectedWorker.ime} {selectedWorker.prezime}
                          </Text>
                          <Text style={styles.workerSelectSub}>📞 {selectedWorker.telefon} • Status: {selectedWorker.radni_status || 'SLOBODAN'}</Text>
                        </View>
                      </View>
                    );
                  }
                  return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <AlertTriangle size={15} color="#EA580C" style={{ marginRight: 8 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.workerSelectName, { color: '#C2410C' }]}>
                          Bez dodele radnika (Nedodeljen)
                        </Text>
                        <Text style={styles.workerSelectSub}>Nalog će biti kreiran sa statusom KREIRANO i oznakom Nedodeljen</Text>
                      </View>
                    </View>
                  );
                })()}
                <ChevronDown
                  size={18}
                  color="#64748B"
                  style={{ transform: [{ rotate: isWorkerDropdownOpen ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>

              {/* OTVORENI PADAJUĆI MENI SA LISTOM SVIH RADNIKA */}
              {isWorkerDropdownOpen && (
                <View style={styles.dropdownMenu}>
                  {/* Opcija 1: Neraspoređen / Nedodeljen */}
                  <TouchableOpacity
                    style={[
                      styles.dropdownItem,
                      !orderForm.majstor_id && styles.dropdownItemActiveOrange
                    ]}
                    onPress={() => {
                      setOrderForm(p => ({ ...p, majstor_id: '' }));
                      setIsWorkerDropdownOpen(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.workerSelectName, !orderForm.majstor_id && { color: '#C2410C' }]}>
                        ⚠️ Bez dodele radnika (Nedodeljen)
                      </Text>
                      <Text style={styles.workerSelectSub}>Ostavite slobodno za naknadno dodeljivanje</Text>
                    </View>
                    {!orderForm.majstor_id && <Check size={16} color="#EA580C" />}
                  </TouchableOpacity>

                  {/* Opcija 2+: Svi ranije uneti radnici ovog servisa */}
                  {workers.length === 0 ? (
                    <View style={{ padding: 12, alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: '#64748B' }}>Nema unetih radnika za ovaj servis.</Text>
                    </View>
                  ) : (
                    workers.map(w => {
                      const isSel = String(orderForm.majstor_id) === String(w.id);
                      return (
                        <TouchableOpacity
                          key={w.id}
                          style={[
                            styles.dropdownItem,
                            isSel && styles.dropdownItemActive
                          ]}
                          onPress={() => {
                            setOrderForm(p => ({ ...p, majstor_id: String(w.id) }));
                            setIsWorkerDropdownOpen(false);
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.workerSelectDot, { backgroundColor: w.boja_markera || '#059669' }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.workerSelectName, isSel && { color: '#0369A1' }]}>
                              {w.ime} {w.prezime}
                            </Text>
                            <Text style={styles.workerSelectSub}>📞 {w.telefon} • Status: {w.radni_status || 'SLOBODAN'}</Text>
                          </View>
                          {isSel && <Check size={16} color="#0284C7" />}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowCreateOrderModal(false)}
                disabled={creatingOrder}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Odustani</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, creatingOrder && { opacity: 0.7 }]}
                onPress={handleSaveOrder}
                disabled={creatingOrder}
                activeOpacity={0.8}
              >
                {creatingOrder ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Kreiraj radni nalog</Text>
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
  headerCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8
  },
  headerCreateBtnText: {
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
    paddingBottom: 6
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A'
  },
  sectionDescription: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8
  },
  toggleCalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6
  },
  toggleCalBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0284C7'
  },
  emptyStateWrap: {
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  emptyStateTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center'
  },
  emptyStateSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    textAlign: 'center'
  },

  // Ekipe na terenu - kartice
  fieldOrderCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 11,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  workerAvatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  workerAvatarSmallText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11.5
  },
  fieldNameText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A'
  },
  fieldPhoneText: {
    fontSize: 10.5,
    color: '#64748B'
  },
  statusBadgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6
  },
  statusBadgePillText: {
    fontSize: 10,
    fontWeight: '800'
  },
  fieldOrderDetailsBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  fieldRnNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284C7'
  },
  fieldClientName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A'
  },
  fieldAddressText: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 2
  },
  fieldFaultText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 2
  },

  // ==========================================================
  // KALENDAR STILOVI (Meseci i dani)
  // ==========================================================
  calCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8
  },
  calHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  calNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center'
  },
  calMonthTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A'
  },
  calMonthSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1
  },
  calWeekdaysRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 4,
    marginBottom: 6
  },
  calWeekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569'
  },
  calDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  calEmptyCell: {
    width: '14.28%',
    height: 32
  },
  calDayCell: {
    width: '14.28%',
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    marginVertical: 1,
    position: 'relative'
  },
  calDayCellSelected: {
    backgroundColor: '#0284C7'
  },
  calDayCellToday: {
    borderWidth: 1.5,
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF'
  },
  calDayNumber: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#0F172A'
  },
  calDayNumberSelected: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  calDayNumberToday: {
    color: '#0284C7',
    fontWeight: '800'
  },
  calBadgeDot: {
    position: 'absolute',
    top: 2,
    right: 4,
    backgroundColor: '#0284C7',
    borderRadius: 5,
    minWidth: 10,
    height: 10,
    paddingHorizontal: 2,
    justifyContent: 'center',
    alignItems: 'center'
  },
  calBadgeDotText: {
    color: '#FFFFFF',
    fontSize: 7.5,
    fontWeight: '800'
  },
  calFooterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  calTodayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3.5
  },
  calTodayBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7'
  },
  calSelectedInfo: {
    fontSize: 11,
    color: '#64748B'
  },

  // Filter chips za brzi pregled
  filterChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap'
  },
  filterChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  filterChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7'
  },
  filterChipActiveOrange: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C'
  },
  filterChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B'
  },
  filterChipTextActive: {
    color: '#FFFFFF'
  },

  // Kartica radnog naloga u listi datuma
  orderCardDetailed: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  orderNumberLarge: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5
  },
  urgentBadge: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4
  },
  urgentBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#DC2626'
  },
  orderClientText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 5
  },
  orderAddressText: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 2
  },
  orderFaultText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
    fontStyle: 'italic'
  },
  orderTimeText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600'
  },

  // Donji deo kartice sa dodeljenim radnikom ili Nedodeljen
  workerAssignmentFooter: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  assignedWorkerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6
  },
  workerDotSmall: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6
  },
  assignedWorkerPillText: {
    fontSize: 11,
    color: '#15803D'
  },
  unassignedWorkerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EA580C', // Narandžasta pozadina
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6
  },
  unassignedWorkerPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF'
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
  sectionSubtitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center'
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
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    marginBottom: 10
  },
  chipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  chipBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7'
  },
  chipBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569'
  },
  chipBtnTextActive: {
    color: '#FFFFFF'
  },
  workerSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  workerSelectCardActive: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD'
  },
  workerSelectCardActiveOrange: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74'
  },
  workerSelectDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8
  },
  workerSelectName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A'
  },
  workerSelectSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 4
  },
  dropdownTriggerActive: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF'
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 12,
    maxHeight: 180,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 3 },
      web: { boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }
    })
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  dropdownItemActive: {
    backgroundColor: '#F0F9FF'
  },
  dropdownItemActiveOrange: {
    backgroundColor: '#FFF7ED'
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
    minWidth: 140
  },
  saveBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF'
  }
});
