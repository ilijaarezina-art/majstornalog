import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ChevronDown,
  Trash2,
  Package,
  Search,
  Boxes,
  Tag,
  Edit3
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import MapComponent from '../components/MapComponent';
import { searchAddressSuggestions, reverseGeocode, getNearbyAddresses } from '../services/geocoding';

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

  // Odabrani majstor za prikaz njegove lokacije i svih njegovih dolazaka na mapi (isključivo preko padajućeg menija)
  const [selectedWorkerId, setSelectedWorkerId] = useState(null);
  const [isMapWorkerDropdownOpen, setIsMapWorkerDropdownOpen] = useState(false);

  // Automatsko postavljanje majstora (nikada nema stanja "Svi majstori" kako se ne bi pravio haos na mapi)
  useEffect(() => {
    if (workers && workers.length > 0) {
      setSelectedWorkerId(prev => {
        if (prev && workers.some(w => Number(w.id) === Number(prev))) return prev;
        const workerWithOrders = workers.find(w => orders.some(o => Number(o.majstor_id) === Number(w.id)));
        return workerWithOrders ? workerWithOrders.id : workers[0].id;
      });
    }
  }, [workers, orders]);

  // Fokusirani nalog za prikaz rute i dolazne lokacije na mapi
  const [focusedOrder, setFocusedOrder] = useState(null);

  // Polazna lokacija ulogovanog korisnika (dispečera)
  const [myLocation, setMyLocation] = useState({
    lat: 44.6627,
    lng: 20.9300,
    name: user ? `${user.ime} ${user.prezime}` : 'Vaša lokacija'
  });

  // Geokodiranje i sugestije adresa za klijenta (preuzeto iz taxi aplikacije)
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const debounceTimerRef = useRef(null);

  // Pin picker modal (definisanje dolazne lokacije klijenta čiodom na mapi)
  const [showPinPickerModal, setShowPinPickerModal] = useState(false);
  const [pinPickerCoords, setPinPickerCoords] = useState({ lat: 44.6627, lng: 20.9300 });
  const [pinPickerMoving, setPinPickerMoving] = useState(false);
  const [nearbyCandidates, setNearbyCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);
  const pinPickerReqIdRef = useRef(0);
  const pinPickerDebounceRef = useRef(null);

  // Upravljanje katalogom delova i usluga iz dispečerskog centra
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogItems, setCatalogItems] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogType, setCatalogType] = useState('ALL');
  const [catalogFormMode, setCatalogFormMode] = useState(false);
  const [editingCatalogItem, setEditingCatalogItem] = useState(null);
  const [catalogForm, setCatalogForm] = useState({
    naziv: '',
    tip: 'DEO',
    jedinica_mere: 'kom',
    cena: '',
    sifra: '',
    kolicina_na_stanju: '100'
  });
  const [savingCatalog, setSavingCatalog] = useState(false);

  // Pokušaj preuzimanja tačne GPS lokacije ulogovanog korisnika preko pregledača
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos && pos.coords) {
            setMyLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              name: user ? `${user.ime} ${user.prezime}` : 'Vaša lokacija'
            });
          }
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, [user]);

  // Modal za kreiranje novog radnog naloga
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [isWorkerDropdownOpen, setIsWorkerDropdownOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({
    klijent_ime: '',
    telefon: '',
    adresa: '',
    grad: '',
    gpsX: null,
    gpsY: null,
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
    setAddressSuggestions([]);
    setIsSearchingAddress(false);
    setOrderForm({
      klijent_ime: '',
      telefon: '',
      adresa: '',
      grad: '',
      gpsX: null,
      gpsY: null,
      tip_intervencije: 'REDOVAN_SERVIS',
      prioritet: 'NORMALAN',
      opis_kvara: '',
      majstor_id: '', // Podrazumevano: Bez dodele radnika
      zakazano_datum: selectedDate || todayStr,
      zakazano_vreme: '10:00'
    });
    setShowCreateOrderModal(true);
  };

  // Dinamička pretraga i prepoznavanje adresa (kao u taxi aplikaciji)
  const handleAddressChange = (text) => {
    setOrderForm(p => ({ ...p, adresa: text, gpsX: null, gpsY: null }));

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!text || text.trim().length < 2) {
      setAddressSuggestions([]);
      setIsSearchingAddress(false);
      return;
    }

    setIsSearchingAddress(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchAddressSuggestions(text, orderForm.grad || '');
        setAddressSuggestions(results || []);
      } catch (e) {
        setAddressSuggestions([]);
      } finally {
        setIsSearchingAddress(false);
      }
    }, 350);
  };

  // Odabir prepoznate adrese iz padajućeg menija
  const handleSelectSuggestion = (item) => {
    setOrderForm(p => ({
      ...p,
      adresa: item.street || item.address,
      grad: item.city || p.grad || '',
      gpsX: item.lat,
      gpsY: item.lng
    }));
    setAddressSuggestions([]);
  };

  // Otvaranje modala sa čiodom na mapi za definisanje lokacije klijenta
  const handleOpenPinPicker = () => {
    const initLat = orderForm.gpsX || myLocation.lat || 44.6627;
    const initLng = orderForm.gpsY || myLocation.lng || 20.9300;
    setPinPickerCoords({ lat: initLat, lng: initLng });
    setPinPickerMoving(false);
    setIsSearchingNearby(true);
    setNearbyCandidates([]);
    setSelectedCandidate(null);
    setShowPinPickerModal(true);

    const reqId = ++pinPickerReqIdRef.current;
    getNearbyAddresses(initLat, initLng).then(list => {
      if (pinPickerReqIdRef.current === reqId) {
        setNearbyCandidates(list || []);
        if (list && list.length > 0) {
          setSelectedCandidate(list[0]);
        }
        setIsSearchingNearby(false);
      }
    });
  };

  // Pomeranje mape u Pin Picker režimu (očitava sve adrese i brojeve sa te tačke)
  const handlePinPickerMove = ({ lat, lng, isMoving }) => {
    setPinPickerCoords({ lat, lng });
    setPinPickerMoving(isMoving);

    if (pinPickerDebounceRef.current) {
      clearTimeout(pinPickerDebounceRef.current);
    }

    if (!isMoving) {
      setIsSearchingNearby(true);
      const reqId = ++pinPickerReqIdRef.current;
      pinPickerDebounceRef.current = setTimeout(() => {
        getNearbyAddresses(lat, lng).then(list => {
          if (pinPickerReqIdRef.current === reqId) {
            setNearbyCandidates(list || []);
            if (list && list.length > 0) {
              setSelectedCandidate(list[0]);
            }
            setIsSearchingNearby(false);
          }
        });
      }, 300);
    }
  };

  // Potvrda odabrane adrese iz ponuđene liste sa te lokacije
  const handleConfirmSelectedCandidate = () => {
    if (selectedCandidate) {
      setOrderForm(p => ({
        ...p,
        adresa: selectedCandidate.street,
        grad: selectedCandidate.city || p.grad || '',
        gpsX: selectedCandidate.lat || pinPickerCoords.lat,
        gpsY: selectedCandidate.lng || pinPickerCoords.lng
      }));
    } else if (pinPickerCoords.lat && pinPickerCoords.lng) {
      setOrderForm(p => ({
        ...p,
        gpsX: pinPickerCoords.lat,
        gpsY: pinPickerCoords.lng
      }));
    }
    setShowPinPickerModal(false);
  };

  // Brisanje nedodeljenog radnog naloga od strane admina
  const handleDeleteOrder = (orderToDel) => {
    const confirmMsg = `Da li ste sigurni da želite da trajno obrišete radni nalog ${orderToDel.broj_naloga}?`;
    const doDelete = async () => {
      try {
        await api.deleteOrder(orderToDel.id, firmId, user?.id);
        if (focusedOrder?.id === orderToDel.id) {
          setFocusedOrder(null);
        }
        loadDashboard(selectedDate);
        const msg = `Radni nalog ${orderToDel.broj_naloga} je uspešno obrisan.`;
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Uspešno', msg);
        }
      } catch (err) {
        const errMsg = err.message || 'Greška pri brisanju naloga.';
        if (Platform.OS === 'web') {
          window.alert(errMsg);
        } else {
          Alert.alert('Greška', errMsg);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        doDelete();
      }
    } else {
      Alert.alert('Potvrda brisanja', confirmMsg, [
        { text: 'Odustani', style: 'cancel' },
        { text: 'Obriši', style: 'destructive', onPress: doDelete }
      ]);
    }
  };

  const loadDispatcherCatalog = async (q = catalogSearch, tip = catalogType) => {
    try {
      setLoadingCatalog(true);
      const res = await api.getCatalog(firmId, q, tip === 'ALL' ? '' : tip);
      setCatalogItems(res || []);
    } catch (e) {
      console.warn('Greška kataloga:', e);
    } finally {
      setLoadingCatalog(false);
    }
  };

  const handleOpenCatalogManager = () => {
    setCatalogFormMode(false);
    setEditingCatalogItem(null);
    setCatalogSearch('');
    setCatalogType('ALL');
    loadDispatcherCatalog('', 'ALL');
    setShowCatalogModal(true);
  };

  const handleOpenNewCatalogItem = () => {
    setEditingCatalogItem(null);
    setCatalogForm({
      naziv: '',
      tip: 'DEO',
      jedinica_mere: 'kom',
      cena: '',
      sifra: '',
      kolicina_na_stanju: '100'
    });
    setCatalogFormMode(true);
  };

  const handleEditCatalogItem = (item) => {
    setEditingCatalogItem(item);
    setCatalogForm({
      naziv: item.naziv,
      tip: item.tip || 'DEO',
      jedinica_mere: item.jedinica_mere || 'kom',
      cena: String(item.cena || ''),
      sifra: item.sifra || '',
      kolicina_na_stanju: String(item.kolicina_na_stanju || '100')
    });
    setCatalogFormMode(true);
  };

  const handleSaveCatalogItem = async () => {
    if (!catalogForm.naziv.trim()) {
      const msg = 'Naziv artikla / usluge je obavezan.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Obavezno polje', msg);
      return;
    }

    try {
      setSavingCatalog(true);
      await api.saveCatalogItem({
        id: editingCatalogItem ? editingCatalogItem.id : 0,
        firma_id: firmId,
        naziv: catalogForm.naziv.trim(),
        tip: catalogForm.tip,
        jedinica_mere: catalogForm.jedinica_mere.trim() || 'kom',
        cena: parseFloat(catalogForm.cena) || 0,
        sifra: catalogForm.sifra.trim(),
        kolicina_na_stanju: parseFloat(catalogForm.kolicina_na_stanju) || 100
      });

      setCatalogFormMode(false);
      setEditingCatalogItem(null);
      await loadDispatcherCatalog(catalogSearch, catalogType);
    } catch (e) {
      const msg = e.message || 'Greška pri čuvanju artikla.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Greška', msg);
    } finally {
      setSavingCatalog(false);
    }
  };

  const handleDeleteCatalogItem = async (item) => {
    const doDelete = async () => {
      try {
        await api.deleteCatalogItem(item.id, firmId);
        await loadDispatcherCatalog(catalogSearch, catalogType);
      } catch (e) {
        console.warn('Greška brisanja:', e);
      }
    };

    const confirmMsg = `Da li želite da uklonite "${item.naziv}" iz šifarnika?`;
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) doDelete();
    } else {
      Alert.alert('Potvrda brisanja', confirmMsg, [
        { text: 'Odustani', style: 'cancel' },
        { text: 'Obriši', style: 'destructive', onPress: doDelete }
      ]);
    }
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
      // Ako koordinate nisu ručno ili sugestijom postavljene, izvrši automatski geocode pre snimanja
      let finalGpsX = orderForm.gpsX;
      let finalGpsY = orderForm.gpsY;

      if (!finalGpsX || !finalGpsY) {
        try {
          const autoFound = await searchAddressSuggestions(orderForm.adresa.trim(), orderForm.grad.trim());
          if (autoFound && autoFound.length > 0) {
            finalGpsX = autoFound[0].lat;
            finalGpsY = autoFound[0].lng;
          }
        } catch (geoErr) {}
      }

      const zakazano_za = `${orderForm.zakazano_datum} ${orderForm.zakazano_vreme || '10:00'}:00`;
      const res = await api.createOrder({
        firma_id: firmId,
        klijent_ime: orderForm.klijent_ime.trim(),
        telefon: orderForm.telefon.trim(),
        adresa: orderForm.adresa.trim(),
        grad: orderForm.grad.trim() || 'Smederevo',
        gpsX: finalGpsX,
        gpsY: finalGpsY,
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

  const getStatusBadge = (orderOrStatus, item = null) => {
    const status = typeof orderOrStatus === 'string' ? orderOrStatus : orderOrStatus?.status;
    const orderObj = (typeof orderOrStatus === 'object' && orderOrStatus) ? orderOrStatus : item;

    switch (status) {
      case 'U_RADU':
        return { label: 'U RADU', color: colors.warning, bg: '#FEF3C7', text: '#B45309' };
      case 'NA_PUTU':
        return { label: 'NA PUTU', color: colors.primary, bg: '#E0F2FE', text: '#0369A1' };
      case 'PRIHVACENO':
        return { label: 'PRIHVAĆENO', color: '#6366F1', bg: '#EEF2FF', text: '#4338CA' };
      case 'ZAVRSENO': {
        const inGeofence = orderObj ? (Number(orderObj.start_u_opsegu) === 1) : true;
        if (!inGeofence) {
          // Nalog koji je završen, a nije krenuo sa radom u opsegu dolazne stanice: crvena pozadina
          return { label: 'ZAVRŠENO', color: '#DC2626', bg: '#DC2626', text: '#FFFFFF', isOutOfRange: true };
        }
        return { label: 'ZAVRŠENO', color: colors.success, bg: '#ECFDF5', text: '#047857', isOutOfRange: false };
      }
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
            <>
              <TouchableOpacity
                style={styles.headerCatalogBtn}
                onPress={handleOpenCatalogManager}
                activeOpacity={0.8}
              >
                <Package size={15} color="#0284C7" style={{ marginRight: 5 }} />
                <Text style={styles.headerCatalogBtnText}>Katalog delova</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.headerCreateBtn}
                onPress={handleOpenCreateOrder}
                activeOpacity={0.8}
              >
                <Plus size={15} color="#FFFFFF" style={{ marginRight: 5 }} />
                <Text style={styles.headerCreateBtnText}>Novi nalog</Text>
              </TouchableOpacity>
            </>
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
                      <Text style={styles.legendText}>Završeno (u opsegu)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
                      <Text style={styles.legendText}>Završeno (van opsega)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#0284C7' }]} />
                      <Text style={styles.legendText}>U opsegu (50m)</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Padajući meni za odabir majstora na mapi (isključivo pojedinačni majstori - bez opcije Svi majstori) */}
              <View style={styles.mapDropdownContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Truck size={15} color="#0284C7" />
                    <Text style={styles.mapDropdownHeaderLabel}>Izbor majstora za prikaz terena:</Text>
                  </View>
                  <Text style={styles.mapDropdownSubHint}>
                    (Prikaz lokacije majstora i svih njegovih adresa dolaska)
                  </Text>
                </View>

                {/* Trigger padajućeg menija */}
                <TouchableOpacity
                  style={[
                    styles.mapDropdownTrigger,
                    isMapWorkerDropdownOpen && styles.mapDropdownTriggerActive
                  ]}
                  onPress={() => setIsMapWorkerDropdownOpen(prev => !prev)}
                  activeOpacity={0.8}
                >
                  {(() => {
                    const currentWorker = workers.find(w => Number(w.id) === Number(selectedWorkerId)) || workers[0];
                    if (currentWorker) {
                      const wOrders = orders.filter(o => Number(o.majstor_id) === Number(currentWorker.id));
                      const inProgressCount = wOrders.filter(o => ['PRIHVACENO', 'NA_PUTU', 'U_RADU'].includes(o.status)).length;
                      return (
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                          <View style={[styles.workerSelectDot, { backgroundColor: currentWorker.boja_markera || '#059669', width: 12, height: 12, borderRadius: 6 }]} />
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <Text style={styles.mapDropdownSelectedName}>
                                {currentWorker.ime} {currentWorker.prezime || ''}
                              </Text>
                              <View style={styles.mapDropdownBadge}>
                                <Text style={styles.mapDropdownBadgeText}>{wOrders.length} naloga za danas</Text>
                              </View>
                              {inProgressCount > 0 && (
                                <View style={[styles.mapDropdownBadge, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                                  <Text style={[styles.mapDropdownBadgeText, { color: '#B45309' }]}>🔥 {inProgressCount} u toku</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.mapDropdownSelectedSub}>
                              📞 {currentWorker.telefon || '-'} • Status: {Number(currentWorker.log_in_out) === 1 ? '🟢 Ulogovan' : '⚪ Odjavljen'}{Boolean(currentWorker.gpsX) ? ' • 🛰️ GPS aktivan' : ' • ⚠️ Nema GPS'}
                            </Text>
                          </View>
                        </View>
                      );
                    }
                    return (
                      <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '600' }}>
                        Učitavanje majstora...
                      </Text>
                    );
                  })()}
                  <ChevronDown
                    size={18}
                    color="#64748B"
                    style={{ transform: [{ rotate: isMapWorkerDropdownOpen ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>

                {/* Otvorena lista padajućeg menija */}
                {isMapWorkerDropdownOpen && (
                  <View style={styles.mapDropdownMenu}>
                    <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
                      {workers.length === 0 ? (
                        <View style={{ padding: 12, alignItems: 'center' }}>
                          <Text style={{ fontSize: 12, color: '#64748B' }}>Nema evidentiranih majstora za ovaj servis.</Text>
                        </View>
                      ) : (
                        workers.map(w => {
                          const isSel = Number(selectedWorkerId) === Number(w.id);
                          const wOrders = orders.filter(o => Number(o.majstor_id) === Number(w.id));
                          const inProgressCount = wOrders.filter(o => ['PRIHVACENO', 'NA_PUTU', 'U_RADU'].includes(o.status)).length;
                          return (
                            <TouchableOpacity
                              key={w.id}
                              style={[
                                styles.mapDropdownItem,
                                isSel && styles.mapDropdownItemActive
                              ]}
                              onPress={() => {
                                setSelectedWorkerId(w.id);
                                if (focusedOrder && Number(focusedOrder.majstor_id) !== Number(w.id)) {
                                  setFocusedOrder(null);
                                }
                                setIsMapWorkerDropdownOpen(false);
                              }}
                              activeOpacity={0.8}
                            >
                              <View style={[styles.workerSelectDot, { backgroundColor: w.boja_markera || '#059669' }]} />
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={[styles.workerSelectName, isSel && { color: '#0284C7', fontWeight: '800' }]}>
                                    {w.ime} {w.prezime || ''}
                                  </Text>
                                  <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '700' }}>
                                    ({wOrders.length} naloga danas)
                                  </Text>
                                </View>
                                <Text style={styles.workerSelectSub}>
                                  📞 {w.telefon || '-'} • {Number(w.log_in_out) === 1 ? '🟢 Ulogovan' : '⚪ Odjavljen'}{inProgressCount > 0 ? ` • ${inProgressCount} u toku` : ''}{Boolean(w.gpsX) ? ' • 🛰️ GPS aktivan' : ' • ⚠️ Nema GPS'}
                                </Text>
                              </View>
                              {isSel && <Check size={16} color="#0284C7" />}
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              {focusedOrder && (
                <View style={styles.mapFocusBanner}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MapPin size={15} color="#CA8A04" />
                      <Text style={styles.mapFocusBannerTitle}>
                        Prikaz rute za nalog: <Text style={{ color: '#0284C7', fontWeight: '800' }}>{focusedOrder.broj_naloga}</Text>
                      </Text>
                    </View>
                    <Text style={styles.mapFocusBannerSub} numberOfLines={1}>
                      👤 {focusedOrder.klijent_ime} • 📍 {focusedOrder.adresa}, {focusedOrder.grad || 'Smederevo'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.mapFocusClearBtn}
                    onPress={() => setFocusedOrder(null)}
                    activeOpacity={0.7}
                  >
                    <X size={14} color="#DC2626" style={{ marginRight: 4 }} />
                    <Text style={styles.mapFocusClearBtnText}>Poništi fokus</Text>
                  </TouchableOpacity>
                </View>
              )}

              <MapComponent
                isDispatcher={true}
                workers={workers}
                orders={orders}
                selectedWorkerId={selectedWorkerId}
                onSelectWorker={(wId) => setSelectedWorkerId(wId)}
                focusedOrder={focusedOrder}
                onFocusOrder={(orderId) => {
                  const fo = orders.find(o => Number(o.id) === Number(orderId));
                  if (fo) {
                    setFocusedOrder(fo);
                    if (fo.majstor_id) setSelectedWorkerId(fo.majstor_id);
                  }
                }}
                onSelectOrder={onSelectOrder}
                height={isDesktop ? (focusedOrder || selectedWorkerId ? 490 : 540) : 280}
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
                    const sb = getStatusBadge(fo.status, fo);
                    const isFocused = focusedOrder?.id === fo.id;
                    return (
                      <TouchableOpacity
                        key={fo.id}
                        style={[styles.fieldOrderCard, isFocused && styles.orderCardFocused]}
                        onPress={() => setFocusedOrder(prev => {
                          if (prev?.id === fo.id) return null;
                          if (fo.majstor_id) setSelectedWorkerId(fo.majstor_id);
                          return fo;
                        })}
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

                        {/* Akcioni red na kartici: Prikaz rute na mapi i Detalji naloga */}
                        <View style={styles.cardActionRow}>
                          <TouchableOpacity
                            style={[styles.showOnMapBtn, isFocused && styles.showOnMapBtnActive]}
                            onPress={(e) => {
                              e?.stopPropagation?.();
                              setFocusedOrder(prev => {
                                if (prev?.id === fo.id) return null;
                                if (fo.majstor_id) setSelectedWorkerId(fo.majstor_id);
                                return fo;
                              });
                            }}
                            activeOpacity={0.7}
                          >
                            <MapPin size={12} color={isFocused ? '#FFFFFF' : '#0284C7'} style={{ marginRight: 4 }} />
                            <Text style={[styles.showOnMapBtnText, isFocused && { color: '#FFFFFF' }]}>
                              {isFocused ? 'Ukloni sa mape' : 'Prikaži nalog'}
                            </Text>
                          </TouchableOpacity>

                          {fo.majstor_id ? (
                            <TouchableOpacity
                              style={[
                                styles.showAllWorkerOrdersBtn,
                                Number(selectedWorkerId) === Number(fo.majstor_id) && styles.showAllWorkerOrdersBtnActive
                              ]}
                              onPress={(e) => {
                                e?.stopPropagation?.();
                                setSelectedWorkerId(fo.majstor_id);
                              }}
                              activeOpacity={0.7}
                            >
                              <Truck size={12} color={Number(selectedWorkerId) === Number(fo.majstor_id) ? '#FFFFFF' : '#059669'} style={{ marginRight: 4 }} />
                              <Text style={[styles.showAllWorkerOrdersBtnText, Number(selectedWorkerId) === Number(fo.majstor_id) && { color: '#FFFFFF' }]}>
                                {Number(selectedWorkerId) === Number(fo.majstor_id) ? 'Prikazan na mapi' : 'Prikaži na mapi'}
                              </Text>
                            </TouchableOpacity>
                          ) : null}

                          {onSelectOrder && (
                            <TouchableOpacity
                              style={styles.cardDetailsBtn}
                              onPress={(e) => {
                                e?.stopPropagation?.();
                                onSelectOrder(fo.id);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.cardDetailsBtnText}>Detalji ➜</Text>
                            </TouchableOpacity>
                          )}
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
                    const sb = getStatusBadge(o.status, o);
                    const hasWorker = Boolean(o.majstor_id && (o.majstor_ime || o.majstor_prezime));
                    const isFocused = focusedOrder?.id === o.id;

                    return (
                      <TouchableOpacity
                        key={o.id}
                        style={[styles.orderCardDetailed, isFocused && styles.orderCardFocused]}
                        onPress={() => setFocusedOrder(prev => {
                          if (prev?.id === o.id) return null;
                          if (o.majstor_id) setSelectedWorkerId(o.majstor_id);
                          return o;
                        })}
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

                        {/* Upozorenje ako je nalog završen a nije krenuo sa radom u opsegu dolazne stanice */}
                        {o.status === 'ZAVRSENO' && Number(o.start_u_opsegu) !== 1 && (
                          <View style={styles.outOfRangePill}>
                            <AlertTriangle size={11} color="#DC2626" style={{ marginRight: 4 }} />
                            <Text style={styles.outOfRangeText}>
                              ⚠️ Započeto van opsega dolazne stanice {o.start_udaljenost_m ? `(${o.start_udaljenost_m}m)` : ''}
                            </Text>
                          </View>
                        )}

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

                        {/* Akcioni red na kartici: Prikaz rute na mapi i Detalji naloga */}
                        <View style={styles.cardActionRow}>
                          <TouchableOpacity
                            style={[styles.showOnMapBtn, isFocused && styles.showOnMapBtnActive]}
                            onPress={(e) => {
                              e?.stopPropagation?.();
                              setFocusedOrder(prev => {
                                if (prev?.id === o.id) return null;
                                if (o.majstor_id) setSelectedWorkerId(o.majstor_id);
                                return o;
                              });
                            }}
                            activeOpacity={0.7}
                          >
                            <MapPin size={12} color={isFocused ? '#FFFFFF' : '#0284C7'} style={{ marginRight: 4 }} />
                            <Text style={[styles.showOnMapBtnText, isFocused && { color: '#FFFFFF' }]}>
                              {isFocused ? 'Ukloni sa mape' : 'Prikaži na mapi'}
                            </Text>
                          </TouchableOpacity>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {(!o.majstor_id || o.status === 'KREIRANO') && (isAdmin || isOwner || isSuperAdmin) && (
                              <TouchableOpacity
                                style={styles.cardDeleteBtn}
                                onPress={(e) => {
                                  e?.stopPropagation?.();
                                  handleDeleteOrder(o);
                                }}
                                activeOpacity={0.7}
                              >
                                <Trash2 size={12} color="#DC2626" style={{ marginRight: 3 }} />
                                <Text style={styles.cardDeleteBtnText}>Obriši</Text>
                              </TouchableOpacity>
                            )}

                            {onSelectOrder && (
                              <TouchableOpacity
                                style={styles.cardDetailsBtn}
                                onPress={(e) => {
                                  e?.stopPropagation?.();
                                  onSelectOrder(o.id);
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.cardDetailsBtnText}>Detalji ➜</Text>
                              </TouchableOpacity>
                            )}
                          </View>
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
                <View style={{ flex: 1.3, position: 'relative', zIndex: 100 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={[styles.label, { marginVertical: 0 }]}>Adresa intervencije *</Text>
                    <TouchableOpacity
                      style={styles.pickPinBtn}
                      onPress={handleOpenPinPicker}
                      activeOpacity={0.7}
                    >
                      <MapPin size={11} color="#EA580C" style={{ marginRight: 3 }} />
                      <Text style={styles.pickPinBtnText}>Čioda na mapi</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ position: 'relative' }}>
                    <TextInput
                      style={styles.input}
                      value={orderForm.adresa}
                      onChangeText={handleAddressChange}
                      placeholder="Ulica i kućni broj"
                      placeholderTextColor="#94A3B8"
                    />
                    {isSearchingAddress && (
                      <View style={styles.inputSpinner}>
                        <ActivityIndicator size="small" color="#0284C7" />
                      </View>
                    )}
                  </View>

                  {/* Padajući meni sa prepoznatim adresama */}
                  {addressSuggestions.length > 0 && (
                    <View style={styles.suggestionsDropdown}>
                      {addressSuggestions.map((item, idx) => (
                        <TouchableOpacity
                          key={item.id || idx}
                          style={styles.suggestionRow}
                          onPress={() => handleSelectSuggestion(item)}
                          activeOpacity={0.7}
                        >
                          <MapPin size={13} color="#0284C7" style={{ marginRight: 6, marginTop: 2 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.suggestionTitle}>{item.street || item.address}</Text>
                            <Text style={styles.suggestionSub}>{item.city} • GPS: {item.lat?.toFixed(4)}, {item.lng?.toFixed(4)}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {orderForm.gpsX && orderForm.gpsY ? (
                    <View style={styles.gpsSuccessPill}>
                      <CheckCircle size={11} color="#059669" style={{ marginRight: 4 }} />
                      <Text style={styles.gpsSuccessPillText} numberOfLines={1}>
                        GPS: {orderForm.gpsX?.toFixed(5)}, {orderForm.gpsY?.toFixed(5)} ✓
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={{ flex: 0.9 }}>
                  <Text style={styles.label}>Grad</Text>
                  <TextInput
                    style={styles.input}
                    value={orderForm.grad}
                    onChangeText={(t) => setOrderForm(p => ({ ...p, grad: t }))}
                    placeholder="npr. Požarevac, Smederevo"
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

      {/* MODAL: DEFINISANJE DOLAZNE LOKACIJE KLIJENTA ČIODOM NA MAPI (kao u taxi aplikaciji) */}
      <Modal visible={showPinPickerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 680, padding: 16 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>📍 Odredite dolaznu lokaciju klijenta</Text>
                <Text style={styles.modalSub}>
                  Pomerajte mapu tako da se narandžasta čioda u centru nađe na adresi klijenta
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowPinPickerModal(false)} style={styles.closeBtn} activeOpacity={0.7}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Interaktivna mapa sa fiksiranom čiodom u centru */}
            <View style={{ height: 380, width: '100%', borderRadius: 12, overflow: 'hidden' }}>
              <MapComponent
                isPinPickerMode={true}
                clientLocation={pinPickerCoords}
                onPinCoordsChange={handlePinPickerMove}
                height={380}
              />
            </View>

            {/* Donji box sa ponuđenim adresama sa te lokacije za izbor */}
            <View style={styles.pinPickerPromptCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MapPin size={16} color="#EA580C" style={{ marginRight: 6 }} />
                  <Text style={styles.pinPickerPromptHeading}>Izaberite adresu sa ove lokacije:</Text>
                </View>
                {isSearchingNearby && <ActivityIndicator size="small" color="#0284C7" />}
              </View>

              <Text style={styles.pinPickerPromptSub}>
                Kliknite na željenu adresu i kućni broj sa spiska ispod da se upiše u radni nalog:
              </Text>

              {/* Lista pronađenih adresa oko čiode */}
              <ScrollView style={{ maxHeight: 150, marginTop: 6 }}>
                {nearbyCandidates.length === 0 && !isSearchingNearby ? (
                  <Text style={{ fontSize: 12, color: '#64748B', paddingVertical: 8 }}>
                    Pomerite čiodu ili kliknite na mapu do željene ulice i objekta.
                  </Text>
                ) : (
                  nearbyCandidates.map((cand, idx) => {
                    const isSel = selectedCandidate?.id === cand.id || (!selectedCandidate && idx === 0);
                    return (
                      <TouchableOpacity
                        key={cand.id || idx}
                        style={[styles.candidateRow, isSel && styles.candidateRowActive]}
                        onPress={() => setSelectedCandidate(cand)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.candRadio, isSel && styles.candRadioActive]}>
                          {isSel && <View style={styles.candRadioDot} />}
                        </View>
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={[styles.candStreetText, isSel && styles.candStreetTextActive]}>
                            {cand.street}
                          </Text>
                          <Text style={styles.candCityText}>
                            {cand.city ? `${cand.city} ` : ''}{cand.isExact ? '• (Tačna lokacija pod čiodom)' : ''}
                          </Text>
                        </View>
                        {isSel && <Check size={16} color="#0284C7" />}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>

              <View style={styles.pinPickerBtnRow}>
                <TouchableOpacity
                  style={styles.pinPickerCancelBtn}
                  onPress={() => setShowPinPickerModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pinPickerCancelBtnText}>Odustani</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.pinPickerConfirmBtn,
                    (!selectedCandidate && nearbyCandidates.length === 0) && { opacity: 0.6 }
                  ]}
                  onPress={handleConfirmSelectedCandidate}
                  disabled={!selectedCandidate && nearbyCandidates.length === 0}
                  activeOpacity={0.8}
                >
                  <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.pinPickerConfirmBtnText}>
                    {selectedCandidate ? `Potvrdi: ${selectedCandidate.street}${selectedCandidate.city ? ', ' + selectedCandidate.city : ''}` : 'Potvrdi odabranu adresu'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Upravljanje katalogom delova i usluga */}
      <Modal
        visible={showCatalogModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (catalogFormMode) setCatalogFormMode(false);
          else setShowCatalogModal(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: 650, maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Package size={20} color="#0284C7" />
                <Text style={styles.modalTitle}>
                  {catalogFormMode 
                    ? (editingCatalogItem ? 'Izmena artikla' : 'Novi artikal u katalogu')
                    : 'Katalog delova, materijala i usluga'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  if (catalogFormMode) setCatalogFormMode(false);
                  else setShowCatalogModal(false);
                }}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {catalogFormMode ? (
              <ScrollView style={{ padding: 16 }} contentContainerStyle={{ paddingBottom: 24 }}>
                <View style={styles.adminFormBox}>
                  <Text style={styles.fieldLabel}>Tip artikla</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                    {[
                      { key: 'DEO', label: 'Deo' },
                      { key: 'USLUGA', label: 'Usluga' },
                      { key: 'MATERIJAL', label: 'Materijal' }
                    ].map(t => (
                      <TouchableOpacity
                        key={t.key}
                        style={[styles.adminTipBtn, catalogForm.tip === t.key && styles.adminTipBtnActive]}
                        onPress={() => setCatalogForm(prev => ({ ...prev, tip: t.key }))}
                      >
                        <Text style={[styles.adminTipBtnText, catalogForm.tip === t.key && styles.adminTipBtnTextActive]}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>Naziv artikla / usluge *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="npr. Filter ulja Bosch, Zamena kočnica..."
                    value={catalogForm.naziv}
                    onChangeText={v => setCatalogForm(prev => ({ ...prev, naziv: v }))}
                  />

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Šifra / Kataloški broj</Text>
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="npr. FLT-01"
                        value={catalogForm.sifra}
                        onChangeText={v => setCatalogForm(prev => ({ ...prev, sifra: v }))}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Cena (RSD)</Text>
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="0.00"
                        keyboardType="numeric"
                        value={catalogForm.cena}
                        onChangeText={v => setCatalogForm(prev => ({ ...prev, cena: v }))}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Jedinica mere</Text>
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="kom, m, kg, sat..."
                        value={catalogForm.jedinica_mere}
                        onChangeText={v => setCatalogForm(prev => ({ ...prev, jedinica_mere: v }))}
                      />
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                        {['kom', 'sat', 'm', 'kg', 'lit'].map(u => (
                          <TouchableOpacity
                            key={u}
                            style={[styles.adminUnitChip, catalogForm.jedinica_mere === u && styles.adminUnitChipActive]}
                            onPress={() => setCatalogForm(prev => ({ ...prev, jedinica_mere: u }))}
                          >
                            <Text style={[styles.adminUnitChipText, catalogForm.jedinica_mere === u && styles.adminUnitChipTextActive]}>
                              {u}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Stanje na lageru</Text>
                      <TextInput
                        style={styles.fieldInput}
                        placeholder="100"
                        keyboardType="numeric"
                        value={catalogForm.kolicina_na_stanju}
                        onChangeText={v => setCatalogForm(prev => ({ ...prev, kolicina_na_stanju: v }))}
                      />
                    </View>
                  </View>

                  <View style={styles.adminFormActions}>
                    <TouchableOpacity
                      style={styles.adminCancelBtn}
                      onPress={() => setCatalogFormMode(false)}
                      disabled={savingCatalog}
                    >
                      <Text style={styles.adminCancelBtnText}>Odustani</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.adminSaveBtn, savingCatalog && { opacity: 0.6 }]}
                      onPress={handleSaveCatalogItem}
                      disabled={savingCatalog}
                    >
                      {savingCatalog ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.adminSaveBtnText}>Sačuvaj u katalog</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            ) : (
              <View style={{ flex: 1, padding: 16 }}>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <View style={styles.catSearchBox}>
                    <Search size={16} color="#64748B" />
                    <TextInput
                      style={styles.catSearchInput}
                      placeholder="Pretraži po nazivu ili šifri..."
                      value={catalogSearch}
                      onChangeText={val => {
                        setCatalogSearch(val);
                        loadDispatcherCatalog(val, catalogType);
                      }}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.addNewItemBtn}
                    onPress={handleOpenNewCatalogItem}
                    activeOpacity={0.8}
                  >
                    <Plus size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.addNewItemBtnText}>Novi artikal</Text>
                  </TouchableOpacity>
                </View>

                {/* Filter chipovi */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {[
                    { key: 'ALL', label: 'Sve stavke' },
                    { key: 'DEO', label: 'Delovi' },
                    { key: 'USLUGA', label: 'Usluge' },
                    { key: 'MATERIJAL', label: 'Materijali' }
                  ].map(tab => (
                    <TouchableOpacity
                      key={tab.key}
                      style={[styles.typeFilterBtn, catalogType === tab.key && styles.typeFilterBtnActive]}
                      onPress={() => {
                        setCatalogType(tab.key);
                        loadDispatcherCatalog(catalogSearch, tab.key);
                      }}
                    >
                      <Text style={[styles.typeFilterBtnText, catalogType === tab.key && styles.typeFilterBtnTextActive]}>
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {loadingCatalog ? (
                  <View style={{ padding: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#0284C7" />
                    <Text style={{ marginTop: 8, color: '#64748B', fontSize: 13 }}>Učitavanje kataloga...</Text>
                  </View>
                ) : (
                  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
                    {catalogItems.length === 0 ? (
                      <View style={{ padding: 30, alignItems: 'center' }}>
                        <Boxes size={36} color="#94A3B8" />
                        <Text style={{ marginTop: 8, color: '#64748B', fontSize: 13, fontWeight: '600' }}>
                          Nema pronađenih artikala u katalogu.
                        </Text>
                      </View>
                    ) : (
                      catalogItems.map(item => (
                        <View key={item.id} style={styles.adminCatRow}>
                          <View style={{ flex: 1, marginRight: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                              <View style={[
                                styles.adminTypeBadge,
                                item.tip === 'USLUGA' && { backgroundColor: '#EDE9FE' },
                                item.tip === 'MATERIJAL' && { backgroundColor: '#FEF3C7' }
                              ]}>
                                <Text style={[
                                  styles.adminTypeBadgeText,
                                  item.tip === 'USLUGA' && { color: '#6D28D9' },
                                  item.tip === 'MATERIJAL' && { color: '#B45309' }
                                ]}>
                                  {item.tip || 'DEO'}
                                </Text>
                              </View>
                              {item.sifra ? (
                                <Text style={styles.adminCodeText}>#{item.sifra}</Text>
                              ) : null}
                            </View>
                            <Text style={styles.adminItemName}>{item.naziv}</Text>
                            <Text style={styles.adminItemSub}>
                              Jedinica: {item.jedinica_mere || 'kom'} | Na stanju: {item.kolicina_na_stanju ?? 0}
                            </Text>
                          </View>

                          <View style={{ alignItems: 'flex-end', marginRight: 12 }}>
                            <Text style={styles.adminItemPrice}>
                              {(parseFloat(item.cena) || 0).toLocaleString('sr-RS', { minimumFractionDigits: 2 })} RSD
                            </Text>
                          </View>

                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity
                              style={styles.catActionIconBtn}
                              onPress={() => handleEditCatalogItem(item)}
                              activeOpacity={0.7}
                            >
                              <Edit3 size={15} color="#0284C7" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.catActionIconBtn, { backgroundColor: '#FEE2E2' }]}
                              onPress={() => handleDeleteCatalogItem(item)}
                              activeOpacity={0.7}
                            >
                              <Trash2 size={15} color="#DC2626" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    )}
                  </ScrollView>
                )}
              </View>
            )}
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
  outOfRangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 5,
    alignSelf: 'flex-start'
  },
  outOfRangeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#DC2626'
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
  },
  mapFocusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF9C3',
    borderWidth: 1.5,
    borderColor: '#FACC15',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10
  },
  mapFocusBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#854D0E'
  },
  mapFocusBannerSub: {
    fontSize: 11.5,
    color: '#A16207',
    marginTop: 2
  },
  mapFocusClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  mapFocusClearBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#DC2626'
  },
  orderCardFocused: {
    borderColor: '#0284C7',
    borderWidth: 2,
    backgroundColor: '#F0F9FF',
    ...Platform.select({
      ios: { shadowColor: '#0284C7', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6 },
      android: { elevation: 4 },
      web: { boxShadow: '0 0 0 2px rgba(2, 132, 199, 0.4)' }
    })
  },
  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  showOnMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD'
  },
  showOnMapBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7'
  },
  showOnMapBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0284C7'
  },
  cardDetailsBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  cardDetailsBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B'
  },
  pickPinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  pickPinBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EA580C'
  },
  inputSpinner: {
    position: 'absolute',
    right: 10,
    top: 10
  },
  suggestionsDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    marginTop: 4,
    zIndex: 9999,
    maxHeight: 200,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 6 },
      web: { boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.15)' }
    })
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  suggestionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A'
  },
  suggestionSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1
  },
  gpsSuccessPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4
  },
  gpsSuccessPillText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#059669'
  },
  pinPickerFooterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  pinPickerAddrLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase'
  },
  pinPickerAddrText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2
  },
  pinPickerCoordsText: {
    fontSize: 11,
    color: '#0284C7',
    marginTop: 2,
    fontWeight: '600'
  },
  cardDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  cardDeleteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626'
  },
  pinPickerPromptCard: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FDBA74'
  },
  pinPickerPromptHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C2410C'
  },
  pinPickerPromptSub: {
    fontSize: 11,
    color: '#9A3412',
    marginTop: 2,
    marginBottom: 4
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginBottom: 5
  },
  candidateRowActive: {
    backgroundColor: '#F0F9FF',
    borderColor: '#0284C7'
  },
  candRadio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center'
  },
  candRadioActive: {
    borderColor: '#0284C7'
  },
  candRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284C7'
  },
  candStreetText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A'
  },
  candStreetTextActive: {
    color: '#0369A1'
  },
  candCityText: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1
  },
  pinPickerDetectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3
  },
  pinPickerDetectedLabel: {
    fontSize: 12,
    color: '#7C2D12',
    fontWeight: '600'
  },
  pinPickerDetectedValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A'
  },
  pinPickerBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FED7AA'
  },
  pinPickerCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  pinPickerCancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B'
  },
  pinPickerConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8
  },
  pinPickerConfirmBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  headerCatalogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8
  },
  headerCatalogBtnText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '700'
  },
  catSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  catSearchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 13,
    color: '#0F172A'
  },
  addNewItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  addNewItemBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  typeFilterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9'
  },
  typeFilterBtnActive: {
    backgroundColor: '#0284C7'
  },
  typeFilterBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B'
  },
  typeFilterBtnTextActive: {
    color: '#FFFFFF'
  },
  adminCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8
  },
  adminTypeBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  adminTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369A1'
  },
  adminCodeText: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '600'
  },
  adminItemName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A'
  },
  adminItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  adminItemPrice: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#059669'
  },
  catActionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  adminFormBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8
  },
  adminTipBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC'
  },
  adminTipBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7'
  },
  adminTipBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B'
  },
  adminTipBtnTextActive: {
    color: '#FFFFFF'
  },
  adminUnitChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  adminUnitChipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7'
  },
  adminUnitChipText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600'
  },
  adminUnitChipTextActive: {
    color: '#0284C7',
    fontWeight: '800'
  },
  adminFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  adminCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F1F5F9'
  },
  adminCancelBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B'
  },
  adminSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#0284C7'
  },
  adminSaveBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  mapDropdownContainer: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    zIndex: 40
  },
  mapDropdownHeaderLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A'
  },
  mapDropdownSubHint: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic'
  },
  mapDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  mapDropdownTriggerActive: {
    borderColor: '#0284C7',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4
  },
  mapDropdownSelectedName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A'
  },
  mapDropdownBadge: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6
  },
  mapDropdownBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0284C7'
  },
  mapDropdownSelectedSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  mapDropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: '#0284C7',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 50
  },
  mapDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  mapDropdownItemActive: {
    backgroundColor: '#F0F9FF'
  },
  showAllWorkerOrdersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6
  },
  showAllWorkerOrdersBtnActive: {
    backgroundColor: '#059669',
    borderColor: '#059669'
  },
  showAllWorkerOrdersBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669'
  }
});
