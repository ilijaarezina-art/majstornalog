import React, { useState, useEffect } from 'react';
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
  FlatList,
  Platform,
  useWindowDimensions,
  Image,
  Linking
} from 'react-native';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Wrench,
  Plus,
  Trash2,
  PenTool,
  Check,
  CreditCard,
  Banknote,
  FileText,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Navigation,
  ExternalLink,
  X,
  Truck,
  CheckCheck,
  Play,
  AlertTriangle,
  History,
  Inbox,
  RotateCcw,
  Package,
  Minus,
  Save,
  Search,
  Tag,
  Boxes,
  Layers
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import MapComponent from '../components/MapComponent';
import SignaturePad from '../components/SignaturePad';

export default function OrderDetailScreen({ orderId, onBack }) {
  const { user, firmId, isAdmin, isOwner, isSuperAdmin } = useAuth();
  const { width, height } = useWindowDimensions();

  // Detekcija orijentacije telefona / ekrana:
  // - Uspravno (Portrait): height >= width  -> Mapa gore, detalji naloga dole
  // - Horizontalno (Landscape): width > height -> Prikaz 50:50 kao na desktopu (Mapa levo, detalji desno)
  const isLandscape = width > height;
  const isDesktop = width >= 1024;
  const isSplitLayout = isLandscape || isDesktop;

  const mapHeight = isDesktop
    ? 540
    : isLandscape
      ? Math.max(height - 130, 220)
      : 220;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  // Stavke radnog naloga (delovi i radni sati)
  const [items, setItems] = useState([]);
  const [workDescription, setWorkDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('GOTOVINA');
  const [signatureData, setSignatureData] = useState(null);
  const [signerName, setSignerName] = useState('');

  // Modali
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [delayReason, setDelayReason] = useState('');
  const [catalogItems, setCatalogItems] = useState([]);
  const [searchCatalogQuery, setSearchCatalogQuery] = useState('');

  // Režim i forma za kreiranje novih artikala u katalogu
  const [catalogViewMode, setCatalogViewMode] = useState('list'); // 'list' | 'create'
  const [catalogTypeFilter, setCatalogTypeFilter] = useState('ALL'); // 'ALL' | 'DEO' | 'USLUGA' | 'MATERIJAL'
  const [newCatalogForm, setNewCatalogForm] = useState({
    naziv: '',
    tip: 'DEO',
    jedinica_mere: 'kom',
    cena: '',
    sifra: '',
    kolicinaZaNalog: '1'
  });
  const [savingCatalogItem, setSavingCatalogItem] = useState(false);
  const [savingDraftItems, setSavingDraftItems] = useState(false);

  // Dispečersko / Admin upravljanje nalogom (Promena radnika i brisanje naloga)
  const [workersList, setWorkersList] = useState([]);
  const [showWorkerPickerModal, setShowWorkerPickerModal] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    loadOrderDetails();
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      const data = await api.getOrderDetails(orderId);
      setOrder(data);
      setItems(data.stavke || []);
      setWorkDescription(data.opis_izvrsenih_radova || '');
      setPaymentMethod(data.nacin_placanja || 'GOTOVINA');
      setSignatureData(data.potpis_klijenta_url || null);
      setSignerName(data.potpisnik_ime || data.klijent_ime || '');

      // Ako je korisnik admin/vlasnik, dobavi listu svih majstora za promenu dodele
      const hasAdminRights = isAdmin || isOwner || isSuperAdmin || user?.rola === 'admin' || user?.rola === 'owner' || user?.rola === 'superadmin';
      if (hasAdminRights) {
        try {
          const dash = await api.getDispatcherDashboard(firmId);
          setWorkersList(dash.workers || []);
        } catch (dashErr) {}
      }
    } catch (err) {
      Alert.alert('Greška', err.message || 'Neuspešno učitavanje detalja naloga.');
    } finally {
      setLoading(false);
    }
  };

  // Promena majstora od strane admina
  const handleAssignWorker = async (newWorkerId) => {
    setReassigning(true);
    try {
      await api.assignOrderWorker(orderId, newWorkerId, user?.id);
      setShowWorkerPickerModal(false);
      await loadOrderDetails();
      const msg = newWorkerId ? 'Majstor je uspešno promenjen / dodeljen!' : 'Nalog je uspešno razdužen (postavljen na Nedodeljen).';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Uspešno', msg);
      }
    } catch (err) {
      Alert.alert('Greška', err.message || 'Neuspešna promena majstora.');
    } finally {
      setReassigning(false);
    }
  };

  // Brisanje nedodeljenog radnog naloga od strane admina
  const handleDeleteOrder = () => {
    const confirmMsg = `Da li ste sigurni da želite da trajno obrišete radni nalog ${order?.broj_naloga}?`;
    const doDelete = async () => {
      try {
        await api.deleteOrder(orderId, firmId, user?.id);
        const msg = `Radni nalog ${order?.broj_naloga} je uspešno obrisan.`;
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert('Uspešno', msg);
        }
        if (onBack) onBack();
      } catch (err) {
        Alert.alert('Greška', err.message || 'Neuspešno brisanje naloga.');
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

  const handleUpdateStatus = async (newStatus, reason = '', coords = null) => {
    setStatusLoading(true);
    try {
      await api.updateOrderStatus(orderId, newStatus, user.id, '', reason, coords);
      await loadOrderDetails();
      if (newStatus === 'ODLOZENO') {
        setShowDelayModal(false);
        setDelayReason('');
      }
    } catch (err) {
      Alert.alert('Greška', err.message || 'Neuspešna promena statusa.');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleStartWorkWithLocation = () => {
    setStatusLoading(true);

    const proceed = (coords) => {
      handleUpdateStatus('U_RADU', '', coords);
    };

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          proceed({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
        },
        (err) => {
          console.warn('GPS lokacija nedostupna:', err.message);
          proceed(null);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      proceed(null);
    }
  };

  const loadCatalog = async (q = searchCatalogQuery, type = catalogTypeFilter) => {
    try {
      const typeParam = type === 'ALL' ? '' : type;
      const res = await api.getCatalog(firmId, q, typeParam);
      setCatalogItems(res || []);
    } catch (err) {
      console.warn('Greška kataloga:', err);
    }
  };

  const handleOpenCatalog = () => {
    setCatalogViewMode('list');
    setCatalogTypeFilter('ALL');
    setSearchCatalogQuery('');
    loadCatalog('', 'ALL');
    setShowCatalogModal(true);
  };

  const handleAddItemFromCatalog = (catItem, customQty = 1) => {
    const qtyToAdd = parseFloat(customQty) || 1;
    const existingIndex = items.findIndex(i => i.katalog_id === catItem.id);
    if (existingIndex > -1) {
      const updated = [...items];
      updated[existingIndex].kolicina = Number(updated[existingIndex].kolicina) + qtyToAdd;
      updated[existingIndex].ukupno = Math.round(updated[existingIndex].kolicina * updated[existingIndex].jedinicna_cena * 100) / 100;
      setItems(updated);
    } else {
      const newItem = {
        katalog_id: catItem.id,
        naziv: catItem.naziv,
        jedinica_mere: catItem.jedinica_mere || 'kom',
        kolicina: qtyToAdd,
        jedinicna_cena: parseFloat(catItem.cena || 0),
        ukupno: Math.round(qtyToAdd * parseFloat(catItem.cena || 0) * 100) / 100
      };
      setItems([...items, newItem]);
    }
    setShowCatalogModal(false);
  };

  const handleUpdateItemQuantity = (index, delta) => {
    const updated = [...items];
    const currentQty = parseFloat(updated[index].kolicina) || 1;
    const newQty = Math.max(1, currentQty + delta);
    updated[index].kolicina = newQty;
    updated[index].ukupno = Math.round(newQty * parseFloat(updated[index].jedinicna_cena) * 100) / 100;
    setItems(updated);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleSaveNewCatalogItem = async (addToOrderImmediately = true) => {
    if (!newCatalogForm.naziv.trim()) {
      const msg = 'Naziv dela ili usluge je obavezan.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Obavezno polje', msg);
      return;
    }

    const priceNum = parseFloat(newCatalogForm.cena) || 0;
    const qtyForOrder = parseFloat(newCatalogForm.kolicinaZaNalog) || 1;

    try {
      setSavingCatalogItem(true);
      const saved = await api.saveCatalogItem({
        firma_id: firmId,
        naziv: newCatalogForm.naziv.trim(),
        tip: newCatalogForm.tip,
        jedinica_mere: newCatalogForm.jedinica_mere.trim() || 'kom',
        cena: priceNum,
        sifra: newCatalogForm.sifra.trim(),
        kolicina_na_stanju: 100
      });

      await loadCatalog(searchCatalogQuery, catalogTypeFilter);

      if (addToOrderImmediately && saved) {
        const newItem = {
          katalog_id: saved.id,
          naziv: saved.naziv,
          jedinica_mere: saved.jedinica_mere || 'kom',
          kolicina: qtyForOrder,
          jedinicna_cena: priceNum,
          ukupno: Math.round(qtyForOrder * priceNum * 100) / 100
        };
        setItems(prev => [...prev, newItem]);
        setShowCatalogModal(false);
        setCatalogViewMode('list');
      } else {
        setCatalogViewMode('list');
      }

      setNewCatalogForm({
        naziv: '',
        tip: 'DEO',
        jedinica_mere: 'kom',
        cena: '',
        sifra: '',
        kolicinaZaNalog: '1'
      });
    } catch (e) {
      const errMsg = e.message || 'Greška pri kreiranju artikla u katalogu.';
      if (Platform.OS === 'web') window.alert(errMsg);
      else Alert.alert('Greška', errMsg);
    } finally {
      setSavingCatalogItem(false);
    }
  };

  const handleSaveDraftItems = async () => {
    try {
      setSavingDraftItems(true);
      await api.saveOrderItems(orderId, items, workDescription, paymentMethod);
      const okMsg = 'Utrošeni delovi i stavke su uspešno sačuvani u radnom nalogu.';
      if (Platform.OS === 'web') window.alert(okMsg);
      else Alert.alert('Sačuvano', okMsg);
    } catch (err) {
      const errMsg = err.message || 'Neuspešno čuvanje stavki.';
      if (Platform.OS === 'web') window.alert(errMsg);
      else Alert.alert('Greška', errMsg);
    } finally {
      setSavingDraftItems(false);
    }
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (parseFloat(item.ukupno) || 0), 0);
  };

  const handleSaveSignature = (base64Url) => {
    setSignatureData(base64Url);
    setShowSignatureModal(false);
  };

  const handleReopenOrder = async () => {
    setStatusLoading(true);
    try {
      await api.updateOrderStatus(orderId, 'U_RADU', user.id, 'Ponovno otvaranje naloga radi izmene/dopune');
      await fetchOrderDetails();
      Alert.alert('Nalog ponovo otvoren', 'Radni nalog je vraćen u status "U radu". Sada možete izmeniti stavke, opis ili potpis, a zatim ga ponovo overiti.');
    } catch (err) {
      Alert.alert('Greška', err.message || 'Neuspešno ponovno otvaranje naloga.');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleCompleteOrder = async () => {
    if (!signatureData && order.status !== 'ZAVRSENO') {
      Alert.alert('Potpis klijenta', 'Za završetak radnog naloga neophodan je potpis klijenta.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        order_id: orderId,
        majstor_id: user.id,
        opis_radova: workDescription,
        potpis_klijenta: signatureData,
        potpisnik_ime: signerName || order.klijent_ime,
        nacin_placanja: paymentMethod,
        naplaceno: 1,
        stavke: items
      };
      await api.completeOrder(payload);

      // Automatsko vraćanje majstora na listu naloga
      if (onBack) {
        onBack();
      }
    } catch (err) {
      Alert.alert('Greška', err.message || 'Neuspešan završetak naloga.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !order) {
    return (
      <View style={styles.loaderCenter}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loaderText}>Učitavanje detalja naloga...</Text>
      </View>
    );
  }

  const isDone = order.status === 'ZAVRSENO';
  const totalPrice = calculateTotal();

  // Status Stepper brojevi (1: Dodeljeno, 2: Prihvaćeno, 3: Na putu, 4: U radu, 5: Završeno)
  const getStepNumber = (st) => {
    switch (st) {
      case 'DODELJENO': return 1;
      case 'PRIHVACENO': return 2;
      case 'NA_PUTU': return 3;
      case 'U_RADU': return 4;
      case 'ZAVRSENO': return 5;
      default: return 1;
    }
  };

  const currentStep = getStepNumber(order.status);

  // Status Stepper traka
  const renderStatusStepper = () => (
    <View style={styles.stepperCard}>
      <Text style={styles.stepperTitle}>Tok i status radnog naloga:</Text>

      <View style={styles.stepperRow}>
        {[
          { step: 1, id: 'DODELJENO', label: 'Dodeljeno' },
          { step: 2, id: 'PRIHVACENO', label: 'Prihvaćeno' },
          { step: 3, id: 'NA_PUTU', label: 'Na putu' },
          { step: 4, id: 'U_RADU', label: 'U radu' },
          { step: 5, id: 'ZAVRSENO', label: 'Završeno' }
        ].map((s, idx) => {
          const isPassed = currentStep >= s.step;
          const isCurrent = order.status === s.id;
          return (
            <React.Fragment key={s.id}>
              {idx > 0 && (
                <View style={[styles.stepLine, currentStep >= s.step && styles.stepLineActive]} />
              )}
              <View style={styles.stepItem}>
                <View style={[styles.stepCircle, isPassed && styles.stepCirclePassed, isCurrent && styles.stepCircleCurrent]}>
                  <Text style={[styles.stepCircleText, isPassed && styles.stepCircleTextPassed]}>{s.step}</Text>
                </View>
                <Text style={[styles.stepLabel, isCurrent && styles.stepLabelCurrent]}>{s.label}</Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>

      {/* Akciono dugme za sledeći korak životnog ciklusa */}
      {!isDone && (
        <View style={styles.stepperActionBox}>
          {order.status === 'DODELJENO' && (
            <TouchableOpacity
              style={[styles.bigStepBtn, { backgroundColor: '#0284C7' }]}
              onPress={() => handleUpdateStatus('PRIHVACENO')}
              disabled={statusLoading}
              activeOpacity={0.8}
            >
              {statusLoading ? <ActivityIndicator color="#FFFFFF" /> : (
                <>
                  <CheckCheck size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.bigStepBtnText}>PREUZMI I PRIHVATI NALOG</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {order.status === 'ODLOZENO' && (
            <View style={{ gap: 8 }}>
              <View style={[styles.workingNoticeBox, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                <AlertTriangle size={16} color="#DC2626" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#991B1B' }}>Nalog je trenutno odložen</Text>
                  {order.razlog_odlaganja ? (
                    <Text style={{ fontSize: 11.5, color: '#7F1D1D', marginTop: 2 }}>Razlog: {order.razlog_odlaganja}</Text>
                  ) : null}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.bigStepBtn, { backgroundColor: '#0284C7' }]}
                onPress={() => handleUpdateStatus('PRIHVACENO', 'Ponovno aktiviranje odloženog naloga')}
                disabled={statusLoading}
                activeOpacity={0.8}
              >
                {statusLoading ? <ActivityIndicator color="#FFFFFF" /> : (
                  <>
                    <RotateCcw size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.bigStepBtnText}>PONOVO AKTIVIRAJ / PRIHVATI NALOG</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {order.status === 'PRIHVACENO' && (
            <TouchableOpacity
              style={[styles.bigStepBtn, { backgroundColor: '#4F46E5' }]}
              onPress={() => handleUpdateStatus('NA_PUTU')}
              disabled={statusLoading}
              activeOpacity={0.8}
            >
              {statusLoading ? <ActivityIndicator color="#FFFFFF" /> : (
                <>
                  <Truck size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.bigStepBtnText}>KRENI KA ADRESI KLIJENTA</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {order.status === 'NA_PUTU' && (
            <TouchableOpacity
              style={[styles.bigStepBtn, { backgroundColor: '#D97706' }]}
              onPress={handleStartWorkWithLocation}
              disabled={statusLoading}
              activeOpacity={0.8}
            >
              {statusLoading ? <ActivityIndicator color="#FFFFFF" /> : (
                <>
                  <Play size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.bigStepBtnText}>STIGAO SAM / ZAPOČNI RAD</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {order.status === 'U_RADU' && (
            <View style={[
              styles.workingNoticeBox,
              order.start_u_opsegu === 1
                ? { backgroundColor: '#EFF6FF', borderColor: '#BAE6FD' }
                : (order.start_u_opsegu === 0
                    ? { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }
                    : {})
            ]}>
              <Wrench
                size={16}
                color={order.start_u_opsegu === 1 ? '#0284C7' : (order.start_u_opsegu === 0 ? '#EA580C' : '#D97706')}
                style={{ marginRight: 8 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 12.5,
                  fontWeight: '800',
                  color: order.start_u_opsegu === 1 ? '#0369A1' : (order.start_u_opsegu === 0 ? '#C2410C' : '#92400E')
                }}>
                  {order.start_u_opsegu === 1
                    ? `Dolazak verifikovan u opsegu (${order.start_udaljenost_m || 0}m od klijenta)`
                    : (order.start_u_opsegu === 0
                        ? `Upozorenje: Početak rada van opsega (${order.start_udaljenost_m || 0}m od klijenta)`
                        : 'Intervencija je u toku')}
                </Text>
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  Unesite delove, opis i preuzmite potpis klijenta na dnu.
                </Text>
              </View>
            </View>
          )}

          {/* Dugme za odlaganje intervencije */}
          {order.status !== 'ODLOZENO' && (
            <TouchableOpacity
              style={styles.delayBtn}
              onPress={() => setShowDelayModal(true)}
              activeOpacity={0.7}
            >
              <AlertTriangle size={13} color="#DC2626" style={{ marginRight: 4 }} />
              <Text style={styles.delayBtnText}>Prijavi problem / Odloži nalog</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Mogućnost ponovnog otvaranja ako je nalog ZAVRŠEN */}
      {isDone && (
        <View style={styles.stepperActionBox}>
          <View style={[
            styles.workingNoticeBox,
            {
              backgroundColor: Number(order.start_u_opsegu) === 1 ? '#DEF7EC' : '#FEE2E2',
              borderColor: Number(order.start_u_opsegu) === 1 ? '#BCF0DA' : '#FECACA'
            }
          ]}>
            <CheckCircle2 size={16} color={Number(order.start_u_opsegu) === 1 ? colors.success : '#DC2626'} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: Number(order.start_u_opsegu) === 1 ? '#03543F' : '#991B1B' }}>
                Radni nalog je overen i završen {Number(order.start_u_opsegu) === 1 ? '(U OPSEGU)' : '(⚠️ KRENUO VAN OPSEGA DOLAZNE STANICE)'}
              </Text>
              <Text style={{ fontSize: 11, color: Number(order.start_u_opsegu) === 1 ? '#046C4E' : '#B91C1C', marginTop: 1 }}>
                {Number(order.start_u_opsegu) === 1
                  ? 'Ukoliko je potrebno uneti izmene ili dopune, možete ponovo otvoriti nalog:'
                  : `Majstor je započeo rad na udaljenosti od ${order.start_udaljenost_m || '>50'}m od dolazne stanice klijenta.`}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.bigStepBtn, { backgroundColor: '#0284C7' }]}
            onPress={handleReopenOrder}
            disabled={statusLoading}
            activeOpacity={0.8}
          >
            {statusLoading ? <ActivityIndicator color="#FFFFFF" /> : (
              <>
                <RotateCcw size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.bigStepBtnText}>PONOVO OTVORI NALOG ZA IZMENU</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Desna kolona / Radni formular
  const delayHistory = (order?.istorija || []).filter(h => h.novi_status === 'ODLOZENO');
  const hasDelays = delayHistory.length > 0 || !!order?.razlog_odlaganja;

  const renderOrderDetailsForm = () => (
    <View style={styles.formContainer}>
      {renderStatusStepper()}

      {/* DISPEČERSKO / ADMIN UPRAVLJANJE: PROMENA MAJSTORA I BRISANJE NEDODELJENOG NALOGA */}
      {(isAdmin || isOwner || isSuperAdmin || user?.rola === 'admin' || user?.rola === 'owner' || user?.rola === 'superadmin') && (
        <View style={styles.adminControlCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Wrench size={15} color="#0284C7" style={{ marginRight: 6 }} />
              <Text style={styles.adminControlTitle}>Dispečersko upravljanje nalogom</Text>
            </View>
            {(!order.majstor_id || order.status === 'KREIRANO') && (
              <TouchableOpacity
                style={styles.adminDeleteBtn}
                onPress={handleDeleteOrder}
                activeOpacity={0.8}
              >
                <Trash2 size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.adminDeleteBtnText}>Obriši nalog</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.adminWorkerLabel}>Dodeljeni majstor (izbor / promena):</Text>
          <TouchableOpacity
            style={styles.adminWorkerTrigger}
            onPress={() => setShowWorkerPickerModal(true)}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={[styles.workerDotSmall, { backgroundColor: order.majstor_boja || (order.majstor_id ? '#059669' : '#EA580C') }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.adminWorkerName, !order.majstor_id && { color: '#C2410C' }]}>
                  {order.majstor_ime ? `${order.majstor_ime} ${order.majstor_prezime || ''}` : '⚠️ Nedodeljen (Kliknite da dodelite radnika)'}
                </Text>
                {order.majstor_telefon ? (
                  <Text style={styles.adminWorkerPhone}>📞 {order.majstor_telefon}</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.adminChangeBadge}>
              <Text style={styles.adminChangeBadgeText}>Promeni ▾</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Kartica sa trajnom istorijom svih odlaganja i napomena sa terena */}
      {hasDelays && (
        <View style={styles.delayHistoryCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <AlertTriangle size={15} color="#DC2626" style={{ marginRight: 6 }} />
            <Text style={styles.delayHistoryTitle}>Istorija odlaganja i zapažanja sa terena ({delayHistory.length || 1}):</Text>
          </View>

          {delayHistory.length > 0 ? (
            delayHistory.map((h, i) => (
              <View key={h.id || i} style={styles.delayHistoryItem}>
                <Text style={styles.delayHistoryTime}>
                  🕒 {h.kreiran_at} • {h.promenio_ime ? `${h.promenio_ime} ${h.promenio_prezime || ''}` : 'Majstor'}:
                </Text>
                <Text style={styles.delayHistoryText}>{h.komentar || 'Nije unet detaljan razlog'}</Text>
              </View>
            ))
          ) : (
            <View style={styles.delayHistoryItem}>
              <Text style={styles.delayHistoryText}>{order.razlog_odlaganja}</Text>
            </View>
          )}
        </View>
      )}

      {/* Client & Device Card */}
      <View style={styles.card}>
        <View style={styles.cardRowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Klijent i adresa</Text>
            <Text style={styles.clientName}>{order.klijent_ime}</Text>
            <Text style={styles.clientAddress}>{order.adresa} {order.sprat_stan ? `(${order.sprat_stan})` : ''}</Text>
          </View>
          <TouchableOpacity
            style={styles.callCircleBtn}
            onPress={() => Linking.openURL(`tel:${order.klijent_telefon}`)}
            activeOpacity={0.8}
          >
            <Phone size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Appliance info */}
        {order.uredjaj_kategorija ? (
          <View style={styles.appliancePill}>
            <Wrench size={14} color="#0369A1" style={{ marginRight: 6 }} />
            <Text style={styles.applianceText}>
              {order.uredjaj_kategorija}: {order.uredjaj_proizvodjac} {order.uredjaj_model}
              {order.uredjaj_sn ? ` • S/N: ${order.uredjaj_sn}` : ''}
            </Text>
          </View>
        ) : null}

        {/* Reported Fault */}
        {order.opis_kvara ? (
          <View style={styles.faultNotice}>
            <Text style={styles.faultTitle}>Prijavljeni kvar od strane klijenta:</Text>
            <Text style={styles.faultDesc}>{order.opis_kvara}</Text>
          </View>
        ) : null}
      </View>

      {/* Parts and Labor Items Section */}
      <View style={styles.card}>
        <View style={styles.cardRowBetween}>
          <View>
            <Text style={styles.sectionTitle}>Utrošeni delovi i radni nalozi</Text>
            <Text style={styles.sectionSubtitle}>{items.length} stavki uneto</Text>
          </View>
          {!isDone && (
            <TouchableOpacity style={styles.addItemBtn} onPress={handleOpenCatalog} activeOpacity={0.8}>
              <Plus size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.addItemBtnText}>Dodaj deo / rad</Text>
            </TouchableOpacity>
          )}
        </View>

        {items.length === 0 ? (
          <Text style={styles.emptyItemsText}>Nema unetih stavki. Kliknite na dugme iznad za izbor ili kreiranje delova.</Text>
        ) : (
          <View style={styles.itemsTable}>
            {items.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.naziv}</Text>
                  <Text style={styles.itemSub}>
                    {item.jedinica_mere || 'kom'} x {Number(item.jedinicna_cena).toLocaleString('sr-RS')} RSD
                  </Text>
                </View>

                {/* Količina i Stepper [-] [QTY] [+] */}
                {!isDone ? (
                  <View style={styles.qtyStepperRow}>
                    <TouchableOpacity
                      style={styles.qtyStepBtn}
                      onPress={() => handleUpdateItemQuantity(idx, -1)}
                      disabled={Number(item.kolicina) <= 1}
                      activeOpacity={0.7}
                    >
                      <Minus size={12} color={Number(item.kolicina) <= 1 ? '#CBD5E1' : '#0F172A'} />
                    </TouchableOpacity>
                    <Text style={styles.qtyValueText}>{item.kolicina}</Text>
                    <TouchableOpacity
                      style={styles.qtyStepBtn}
                      onPress={() => handleUpdateItemQuantity(idx, 1)}
                      activeOpacity={0.7}
                    >
                      <Plus size={12} color="#0F172A" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.qtyStaticText}>{item.kolicina} {item.jedinica_mere || 'kom'}</Text>
                )}

                <Text style={styles.itemPrice}>{Number(item.ukupno).toLocaleString('sr-RS')} RSD</Text>
                {!isDone && (
                  <TouchableOpacity onPress={() => handleRemoveItem(idx)} style={{ marginLeft: 10 }}>
                    <Trash2 size={16} color="#DC2626" />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>UKUPNO ZA NAPLATU:</Text>
              <Text style={styles.totalValue}>{totalPrice.toLocaleString('sr-RS')} RSD</Text>
            </View>

            {/* Brzo čuvanje stavki u toku rada */}
            {!isDone && items.length > 0 && (
              <View style={styles.draftSaveRow}>
                <TouchableOpacity
                  style={styles.draftSaveBtn}
                  onPress={handleSaveDraftItems}
                  disabled={savingDraftItems}
                  activeOpacity={0.8}
                >
                  {savingDraftItems ? (
                    <ActivityIndicator size="small" color="#0284C7" />
                  ) : (
                    <>
                      <Save size={13} color="#0284C7" style={{ marginRight: 5 }} />
                      <Text style={styles.draftSaveBtnText}>Sačuvaj stavke u radni nalog</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Work Description Field */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Opis izvršenih radova i konstatacija</Text>
        <TextInput
          style={styles.textArea}
          multiline
          numberOfLines={3}
          placeholder="Npr. Izvršeno pranje unutrašnje jedinice, zamenjen kondenzator, dopunjeno 250g freona. Uređaj testiran i radi optimalno."
          placeholderTextColor="#94A3B8"
          value={workDescription}
          onChangeText={setWorkDescription}
          editable={!isDone}
        />
      </View>

      {/* Payment Method Selector */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Način plaćanja</Text>
        <View style={styles.paymentRow}>
          {[
            { id: 'GOTOVINA', label: 'Gotovina', icon: Banknote },
            { id: 'KARTICA', label: 'Kartica', icon: CreditCard },
            { id: 'VIRMAN_FAKTURA', label: 'Faktura', icon: FileText },
            { id: 'BESPLATNO_GARANCIJA', label: 'Garancija', icon: ShieldCheck }
          ].map(m => {
            const Icon = m.icon;
            const isSelected = paymentMethod === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.payPill, isSelected && styles.payPillActive]}
                onPress={() => !isDone && setPaymentMethod(m.id)}
                disabled={isDone}
                activeOpacity={0.8}
              >
                <Icon size={14} color={isSelected ? '#FFFFFF' : '#64748B'} style={{ marginRight: 6 }} />
                <Text style={[styles.payPillText, isSelected && styles.payPillTextActive]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Customer Signature Section */}
      <View style={styles.card}>
        <View style={styles.cardRowBetween}>
          <Text style={styles.sectionTitle}>Digitalni potpis klijenta</Text>
          {!isDone && (
            <TouchableOpacity
              style={styles.signActionBtn}
              onPress={() => setShowSignatureModal(true)}
              activeOpacity={0.8}
            >
              <PenTool size={14} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.signActionBtnText}>
                {signatureData ? 'Promeni potpis' : 'Preuzmi potpis'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {signatureData ? (
          <View style={styles.signaturePreviewBox}>
            <Image
              source={{ uri: signatureData }}
              style={styles.signatureImage}
              resizeMode="contain"
            />
            <Text style={styles.signedLabel}>✓ Potpisao: {signerName || order.klijent_ime}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.signaturePlaceholder}
            onPress={() => !isDone && setShowSignatureModal(true)}
            disabled={isDone}
            activeOpacity={0.7}
          >
            <PenTool size={24} color="#94A3B8" style={{ marginBottom: 6 }} />
            <Text style={styles.placeholderText}>Kliknite ovde za digitalni potpis klijenta prstom ili mišem</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Final Completion Action Button */}
      {!isDone ? (
        <TouchableOpacity
          style={[styles.completeOrderBtn, saving && { opacity: 0.7 }]}
          onPress={handleCompleteOrder}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <CheckCircle2 size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.completeOrderBtnText}>ZAVRŠI I OVERI RADNI NALOG</Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.orderCompletedBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <CheckCircle2 size={20} color={colors.success} style={{ marginRight: 8 }} />
            <Text style={styles.orderCompletedBannerText}>Radni nalog je overen i uspešno arhiviran.</Text>
          </View>
          <TouchableOpacity
            style={styles.reopenOrderBannerBtn}
            onPress={handleReopenOrder}
            disabled={statusLoading}
            activeOpacity={0.8}
          >
            {statusLoading ? <ActivityIndicator color="#FFFFFF" /> : (
              <>
                <RotateCcw size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.reopenOrderBannerBtnText}>PONOVO OTVORI NALOG ZA IZMENU</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Explicit Bottom Close Button */}
      <TouchableOpacity
        style={styles.bottomCloseBtn}
        onPress={onBack}
        activeOpacity={0.8}
      >
        <Text style={styles.bottomCloseBtnText}>Zatvori detalje i vrati se na listu</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top Header with explicit Close Button */}
      <View style={[styles.header, isLandscape && !isDesktop && styles.headerCompact]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
            <ArrowLeft size={isLandscape && !isDesktop ? 18 : 20} color="#0F172A" />
          </TouchableOpacity>

          <View style={{ marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.headerTitle, isLandscape && !isDesktop && { fontSize: 15 }]}>{order.broj_naloga}</Text>
              <View style={[
                styles.statusBadge,
                {
                  backgroundColor: isDone
                    ? (Number(order.start_u_opsegu) === 1 ? '#DEF7EC' : '#DC2626')
                    : '#E0F2FE'
                }
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  {
                    color: isDone
                      ? (Number(order.start_u_opsegu) === 1 ? colors.success : '#FFFFFF')
                      : colors.primary
                  }
                ]}>
                  {order.status === 'ZAVRSENO' ? 'ZAVRŠENO' : order.status}
                </Text>
              </View>
            </View>
            <Text style={[styles.headerSub, isLandscape && !isDesktop && { fontSize: 11 }]}>
              {order.tip_intervencije} • {order.klijent_ime}
            </Text>
          </View>
        </View>

        {/* Istaknuto dugme ZATVORI NALOG u zaglavlju */}
        <TouchableOpacity style={styles.headerCloseBtn} onPress={onBack} activeOpacity={0.8}>
          <X size={16} color="#DC2626" style={{ marginRight: 4 }} />
          <Text style={styles.headerCloseBtnText}>Zatvori</Text>
        </TouchableOpacity>
      </View>

      {/* Prikaz na osnovu orijentacije i uređaja:
          - Horizontalno (Landscape) ili Desktop: 50:50 podeljeni ekran (Mapa levo, detalji desno)
          - Uspravno (Portrait telefon): Vertikalni raspored (Mapa gore, detalji dole)
      */}
      {isSplitLayout ? (
        <View style={[styles.splitBody, isLandscape && !isDesktop && { padding: 10, gap: 10 }]}>
          {/* Leva polovina (50%): Karta sa navigacijom i brzim pozivom */}
          <View style={styles.splitLeftCol}>
            <View style={styles.mapCard}>
              <View style={styles.mapHeaderBar}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <MapPin size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.mapHeaderTitle} numberOfLines={1}>Lokacija i ruta</Text>
                </View>
                <Text style={styles.mapHeaderSub} numberOfLines={1}>{order.adresa}</Text>
              </View>

              <MapComponent
                clientLocation={order.gpsX && order.gpsY ? {
                  lat: parseFloat(order.gpsX),
                  lng: parseFloat(order.gpsY),
                  name: order.klijent_ime,
                  address: order.adresa
                } : null}
                workerLocation={{ lat: 44.6627, lng: 20.9300 }}
                startLocation={order.start_gpsX && order.start_gpsY ? {
                  lat: parseFloat(order.start_gpsX),
                  lng: parseFloat(order.start_gpsY),
                  inGeofence: Number(order.start_u_opsegu) === 1,
                  distance: order.start_udaljenost_m || 0
                } : null}
                height={mapHeight}
              />

              {/* Sažetak klijenta na dnu mape */}
              <View style={[styles.mapFooterBox, isLandscape && !isDesktop && { padding: 8 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mapFooterClient} numberOfLines={1}>{order.klijent_ime}</Text>
                  <Text style={styles.mapFooterAddress} numberOfLines={1}>{order.adresa} {order.sprat_stan ? `(${order.sprat_stan})` : ''}</Text>
                </View>
                <TouchableOpacity
                  style={styles.mapCallBtn}
                  onPress={() => Linking.openURL(`tel:${order.klijent_telefon}`)}
                  activeOpacity={0.8}
                >
                  <Phone size={15} color="#FFFFFF" style={{ marginRight: 5 }} />
                  <Text style={styles.mapCallBtnText}>Pozovi</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Desna polovina (50%): Skrolabilni detalji radnog naloga */}
          <ScrollView
            style={styles.splitRightCol}
            contentContainerStyle={styles.splitRightContent}
            keyboardShouldPersistTaps="handled"
          >
            {renderOrderDetailsForm()}
          </ScrollView>
        </View>
      ) : (
        /* Uspravno (Portrait na telefonu): Mapa stoji gore, nalog ispod */
        <ScrollView
          contentContainerStyle={styles.portraitScroll}
          keyboardShouldPersistTaps="handled"
        >
          {order.gpsX && order.gpsY ? (
            <View style={styles.portraitMapCard}>
              <View style={styles.portraitMapHeader}>
                <MapPin size={15} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.portraitMapTitle}>{order.adresa}</Text>
              </View>
              <MapComponent
                clientLocation={{
                  lat: parseFloat(order.gpsX),
                  lng: parseFloat(order.gpsY),
                  name: order.klijent_ime,
                  address: order.adresa
                }}
                workerLocation={{ lat: 44.6627, lng: 20.9300 }}
                startLocation={order.start_gpsX && order.start_gpsY ? {
                  lat: parseFloat(order.start_gpsX),
                  lng: parseFloat(order.start_gpsY),
                  inGeofence: Number(order.start_u_opsegu) === 1,
                  distance: order.start_udaljenost_m || 0
                } : null}
                height={220}
              />
            </View>
          ) : null}

          {renderOrderDetailsForm()}
        </ScrollView>
      )}

      {/* Catalog Items Modal: Izbor i Kreiranje novih delova i usluga */}
      <Modal visible={showCatalogModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 640, maxHeight: '90%' }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Package size={20} color="#0284C7" />
                <View>
                  <Text style={styles.modalTitle}>Utrošeni delovi i radni nalozi</Text>
                  <Text style={styles.modalSubHeader}>Šifarnik materijala, delova i usluga servisa</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowCatalogModal(false)} style={styles.modalCloseIconBtn}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Segmented Mode Switch: Izbor sa lagera vs. Kreiraj novi artikal */}
            <View style={styles.catalogTabRow}>
              <TouchableOpacity
                style={[styles.catalogTabBtn, catalogViewMode === 'list' && styles.catalogTabBtnActive]}
                onPress={() => setCatalogViewMode('list')}
                activeOpacity={0.8}
              >
                <Search size={14} color={catalogViewMode === 'list' ? '#0284C7' : '#64748B'} style={{ marginRight: 6 }} />
                <Text style={[styles.catalogTabBtnText, catalogViewMode === 'list' && styles.catalogTabBtnTextActive]}>
                  Izbor sa lagera ({catalogItems.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.catalogTabBtn, catalogViewMode === 'create' && styles.catalogTabBtnActive]}
                onPress={() => setCatalogViewMode('create')}
                activeOpacity={0.8}
              >
                <Plus size={15} color={catalogViewMode === 'create' ? '#0284C7' : '#64748B'} style={{ marginRight: 6 }} />
                <Text style={[styles.catalogTabBtnText, catalogViewMode === 'create' && styles.catalogTabBtnTextActive]}>
                  + Kreiraj novi artikal
                </Text>
              </TouchableOpacity>
            </View>

            {catalogViewMode === 'list' ? (
              <View style={{ flex: 1, minHeight: 320 }}>
                {/* Banner CTA za kreiranje novog artikla */}
                <TouchableOpacity
                  style={styles.newArticleBanner}
                  onPress={() => setCatalogViewMode('create')}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.newArticleBannerTitle}>Nemate traženi deo ili uslugu na spisku?</Text>
                    <Text style={styles.newArticleBannerSub}>Kliknite ovde da kreirate novi artikal i odmah ga upišete u radni nalog</Text>
                  </View>
                  <View style={styles.newArticleBannerBtn}>
                    <Plus size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.newArticleBannerBtnText}>Novi artikal</Text>
                  </View>
                </TouchableOpacity>

                {/* Pretraga i Filteri */}
                <View style={styles.catalogSearchRow}>
                  <Search size={15} color="#94A3B8" style={{ marginLeft: 10, marginRight: 6 }} />
                  <TextInput
                    style={styles.catalogSearchInput}
                    placeholder="Pretraži po nazivu ili šifri..."
                    placeholderTextColor="#94A3B8"
                    value={searchCatalogQuery}
                    onChangeText={(text) => {
                      setSearchCatalogQuery(text);
                      loadCatalog(text, catalogTypeFilter);
                    }}
                  />
                  {searchCatalogQuery ? (
                    <TouchableOpacity
                      onPress={() => {
                        setSearchCatalogQuery('');
                        loadCatalog('', catalogTypeFilter);
                      }}
                      style={{ padding: 6, marginRight: 4 }}
                    >
                      <X size={14} color="#64748B" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Filter čipovi: Sve, Delovi, Usluge, Materijal */}
                <View style={styles.typeFilterRow}>
                  {[
                    { id: 'ALL', label: 'Sve' },
                    { id: 'DEO', label: '🔧 Delovi' },
                    { id: 'USLUGA', label: '⏱️ Usluge' },
                    { id: 'MATERIJAL', label: '📦 Materijal' }
                  ].map(tf => {
                    const isSel = catalogTypeFilter === tf.id;
                    return (
                      <TouchableOpacity
                        key={tf.id}
                        style={[styles.typeFilterChip, isSel && styles.typeFilterChipActive]}
                        onPress={() => {
                          setCatalogTypeFilter(tf.id);
                          loadCatalog(searchCatalogQuery, tf.id);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.typeFilterChipText, isSel && styles.typeFilterChipTextActive]}>
                          {tf.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Lista artikala */}
                <FlatList
                  data={catalogItems}
                  keyExtractor={(item) => String(item.id)}
                  style={{ flex: 1, marginTop: 4 }}
                  ListEmptyComponent={
                    <View style={styles.emptyCatalogWrap}>
                      <Boxes size={32} color="#94A3B8" style={{ marginBottom: 6 }} />
                      <Text style={styles.emptyCatalogTitle}>Nije pronađen nijedan artikal.</Text>
                      <TouchableOpacity
                        style={styles.emptyCreateBtn}
                        onPress={() => {
                          if (searchCatalogQuery) {
                            setNewCatalogForm(p => ({ ...p, naziv: searchCatalogQuery }));
                          }
                          setCatalogViewMode('create');
                        }}
                        activeOpacity={0.8}
                      >
                        <Plus size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.emptyCreateBtnText}>
                          Kreiraj "{searchCatalogQuery || 'novi artikal'}"
                        </Text>
                      </TouchableOpacity>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const isDeo = item.tip === 'DEO';
                    const isUsluga = item.tip === 'USLUGA';
                    const badgeBg = isDeo ? '#FEF3C7' : (isUsluga ? '#E0F2FE' : '#F1F5F9');
                    const badgeColor = isDeo ? '#B45309' : (isUsluga ? '#0369A1' : '#475569');

                    return (
                      <View style={styles.catItemCard}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <View style={[styles.typeBadge, { backgroundColor: badgeBg }]}>
                              <Text style={[styles.typeBadgeText, { color: badgeColor }]}>{item.tip}</Text>
                            </View>
                            {item.sifra ? <Text style={styles.itemCodeText}>{item.sifra}</Text> : null}
                          </View>
                          <Text style={styles.catItemName}>{item.naziv}</Text>
                          <Text style={styles.catItemStockText}>
                            Jedinica: <Text style={{ fontWeight: '700' }}>{item.jedinica_mere || 'kom'}</Text>
                            {item.kolicina_na_stanju ? ` • Na stanju: ${parseFloat(item.kolicina_na_stanju)}` : ''}
                          </Text>
                        </View>

                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                          <Text style={styles.catItemPrice}>{Number(item.cena).toLocaleString('sr-RS')} RSD</Text>
                          <TouchableOpacity
                            style={styles.addCatItemBtn}
                            onPress={() => handleAddItemFromCatalog(item, 1)}
                            activeOpacity={0.8}
                          >
                            <Plus size={13} color="#FFFFFF" style={{ marginRight: 3 }} />
                            <Text style={styles.addCatItemBtnText}>Dodaj</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  }}
                />
              </View>
            ) : (
              /* KREIRANJE NOVOG ARTIKLA / DELA / USLUGE */
              <ScrollView style={{ flex: 1, maxHeight: 480, paddingVertical: 4 }}>
                <View style={styles.createFormCard}>
                  <Text style={styles.createFormTitle}>Kreiranje novog artikla / usluge</Text>
                  <Text style={styles.createFormSub}>
                    Definišite artikal koji će biti trajno upisan u šifarnik i odmah dodat u radni nalog klijenta.
                  </Text>

                  {/* 1. Naziv */}
                  <Text style={styles.formLabel}>Naziv dela ili usluge *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Npr. Startni kondenzator 35uF, Zamena ležaja..."
                    placeholderTextColor="#94A3B8"
                    value={newCatalogForm.naziv}
                    onChangeText={(t) => setNewCatalogForm(p => ({ ...p, naziv: t }))}
                  />

                  {/* 2. Tip artikla */}
                  <Text style={styles.formLabel}>Tip stavke:</Text>
                  <View style={styles.tipSelectorRow}>
                    {[
                      { id: 'DEO', label: '🔧 Rezervni deo', desc: 'Ugrađeni deo' },
                      { id: 'USLUGA', label: '⏱️ Usluga / Rad', desc: 'Radni sati i servis' },
                      { id: 'MATERIJAL', label: '📦 Materijal', desc: 'Potrošni materijal' }
                    ].map(t => {
                      const isSel = newCatalogForm.tip === t.id;
                      return (
                        <TouchableOpacity
                          key={t.id}
                          style={[styles.tipBtn, isSel && styles.tipBtnActive]}
                          onPress={() => setNewCatalogForm(p => ({ ...p, tip: t.id }))}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.tipBtnText, isSel && styles.tipBtnTextActive]}>{t.label}</Text>
                          <Text style={[styles.tipBtnSub, isSel && styles.tipBtnSubActive]}>{t.desc}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* 3. Cena i Jedinica mere */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <View style={{ flex: 1.2 }}>
                      <Text style={styles.formLabel}>Cena po jedinici (RSD) *</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Npr. 1800"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={newCatalogForm.cena}
                        onChangeText={(t) => setNewCatalogForm(p => ({ ...p, cena: t }))}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Jedinica mere</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="kom, m, kg, sat..."
                        placeholderTextColor="#94A3B8"
                        value={newCatalogForm.jedinica_mere}
                        onChangeText={(t) => setNewCatalogForm(p => ({ ...p, jedinica_mere: t }))}
                      />
                    </View>
                  </View>

                  {/* Brzi izbor uobičajenih jedinica mera */}
                  <View style={styles.unitChipsRow}>
                    {['kom', 'm', 'kg', 'l', 'sat', 'set'].map(u => (
                      <TouchableOpacity
                        key={u}
                        style={[styles.unitChip, newCatalogForm.jedinica_mere === u && styles.unitChipActive]}
                        onPress={() => setNewCatalogForm(p => ({ ...p, jedinica_mere: u }))}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.unitChipText, newCatalogForm.jedinica_mere === u && styles.unitChipTextActive]}>
                          {u}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 4. Količina za radni nalog i Šifra */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Količina za ovaj nalog</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="1"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={newCatalogForm.kolicinaZaNalog}
                        onChangeText={(t) => setNewCatalogForm(p => ({ ...p, kolicinaZaNalog: t }))}
                      />
                    </View>

                    <View style={{ flex: 1.2 }}>
                      <Text style={styles.formLabel}>Šifra artikla (opciono)</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Npr. DEL-05"
                        placeholderTextColor="#94A3B8"
                        value={newCatalogForm.sifra}
                        onChangeText={(t) => setNewCatalogForm(p => ({ ...p, sifra: t }))}
                      />
                    </View>
                  </View>

                  {/* Dugmad za akciju */}
                  <View style={styles.createActionRow}>
                    <TouchableOpacity
                      style={styles.backToListBtn}
                      onPress={() => setCatalogViewMode('list')}
                      activeOpacity={0.7}
                    >
                      <ArrowLeft size={14} color="#64748B" style={{ marginRight: 4 }} />
                      <Text style={styles.backToListBtnText}>Nazad na spisak</Text>
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={styles.saveCatalogOnlyBtn}
                        onPress={() => handleSaveNewCatalogItem(false)}
                        disabled={savingCatalogItem}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.saveCatalogOnlyBtnText}>Samo u katalog</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.saveAndAddBtn}
                        onPress={() => handleSaveNewCatalogItem(true)}
                        disabled={savingCatalogItem}
                        activeOpacity={0.8}
                      >
                        {savingCatalogItem ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text style={styles.saveAndAddBtnText}>Sačuvaj i dodaj u nalog</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Digital Signature Pad Modal */}
      <Modal visible={showSignatureModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 520 }]}>
            <SignaturePad
              clientName={order.klijent_ime}
              onSave={handleSaveSignature}
              onCancel={() => setShowSignatureModal(false)}
            />
          </View>
        </View>
      </Modal>

      {/* Modal: Odlaganje intervencije / Prijava problema */}
      <Modal visible={showDelayModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 460 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: '#DC2626' }]}>Odlaganje radnog naloga</Text>
              <TouchableOpacity onPress={() => setShowDelayModal(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: '#475569', marginTop: 10 }}>
              Unesite razlog zbog kog intervencija ne može biti završena (npr. stranka nije kod kuće, nema struje, fali specifičan deo sa lagera):
            </Text>

            <TextInput
              style={[styles.textArea, { minHeight: 90, marginTop: 10 }]}
              placeholder="Unesite razlog odlaganja..."
              value={delayReason}
              onChangeText={setDelayReason}
              multiline
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setShowDelayModal(false)}
              >
                <Text style={styles.cancelModalBtnText}>Otkaži</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveModalBtn, { backgroundColor: '#DC2626' }]}
                onPress={() => handleUpdateStatus('ODLOZENO', delayReason)}
              >
                <Text style={styles.saveModalBtnText}>Potvrdi odlaganje</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL ZA PROMENU ILI DODELU MAJSTORA OD STRANE ADMINA */}
      <Modal visible={showWorkerPickerModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 480 }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Izbor majstora za nalog</Text>
                <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                  Nalog: {order?.broj_naloga} • {order?.klijent_ime}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowWorkerPickerModal(false)} style={styles.modalCloseBtn} activeOpacity={0.7}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380, marginTop: 8 }}>
              {/* Opcija 1: Razduži nalog (Nedodeljen) */}
              <TouchableOpacity
                style={[
                  styles.workerPickRow,
                  !order.majstor_id && styles.workerPickRowActiveOrange
                ]}
                onPress={() => handleAssignWorker(null)}
                disabled={reassigning}
                activeOpacity={0.8}
              >
                <View style={[styles.workerDotSmall, { backgroundColor: '#EA580C' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.workerPickName, !order.majstor_id && { color: '#C2410C' }]}>
                    ⚠️ Bez dodele (Nedodeljen)
                  </Text>
                  <Text style={styles.workerPickSub}>Vrati nalog u status KREIRANO i ukloni dodeljenog radnika</Text>
                </View>
                {!order.majstor_id && <Check size={16} color="#EA580C" />}
              </TouchableOpacity>

              {/* Opcija 2+: Svi aktivni majstori ovog servisa */}
              {workersList.map(w => {
                const isCurrent = String(order.majstor_id) === String(w.id);
                return (
                  <TouchableOpacity
                    key={w.id}
                    style={[
                      styles.workerPickRow,
                      isCurrent && styles.workerPickRowActive
                    ]}
                    onPress={() => handleAssignWorker(w.id)}
                    disabled={reassigning}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.workerDotSmall, { backgroundColor: w.boja_markera || '#059669' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.workerPickName, isCurrent && { color: '#0284C7' }]}>
                        {w.ime} {w.prezime}
                      </Text>
                      <Text style={styles.workerPickSub}>📞 {w.telefon || '-'} • Status: {w.radni_status || 'SLOBODAN'}</Text>
                    </View>
                    {isCurrent && <Check size={16} color="#0284C7" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ marginTop: 12, alignItems: 'flex-end' }}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setShowWorkerPickerModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelModalBtnText}>Zatvori</Text>
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
  loaderCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC'
  },
  loaderText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 10
  },
  headerCompact: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 12
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
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
    color: '#64748B',
    marginTop: 1
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800'
  },
  headerCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  headerCloseBtnText: {
    color: '#DC2626',
    fontSize: 12.5,
    fontWeight: '800'
  },

  // Status Stepper
  stepperCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  stepperTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 8
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4
  },
  stepItem: {
    alignItems: 'center',
    width: 58
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center'
  },
  stepCirclePassed: {
    backgroundColor: colors.primary
  },
  stepCircleCurrent: {
    backgroundColor: '#D97706',
    borderWidth: 2,
    borderColor: '#FDE68A'
  },
  stepCircleText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748B'
  },
  stepCircleTextPassed: {
    color: '#FFFFFF'
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center'
  },
  stepLabelCurrent: {
    color: '#0F172A',
    fontWeight: '900'
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 2,
    marginBottom: 16
  },
  stepLineActive: {
    backgroundColor: colors.primary
  },
  stepperActionBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8
  },
  bigStepBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10
  },
  bigStepBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  workingNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  workingNoticeText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
    flex: 1
  },
  delayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4
  },
  delayBtnText: {
    fontSize: 11.5,
    color: '#DC2626',
    fontWeight: '700'
  },

  // Split Layout
  splitBody: {
    flex: 1,
    flexDirection: 'row',
    padding: 14,
    gap: 14
  },
  splitLeftCol: {
    flex: 1,
    height: '100%'
  },
  splitRightCol: {
    flex: 1,
    height: '100%'
  },
  splitRightContent: {
    paddingBottom: 24
  },

  // Portrait Layout
  portraitScroll: {
    padding: 12,
    paddingBottom: 24
  },
  portraitMapCard: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 12,
    backgroundColor: '#FFFFFF'
  },
  portraitMapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  portraitMapTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155'
  },

  // Map Card u Split režimu
  mapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3
  },
  mapHeaderBar: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  mapHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A'
  },
  mapHeaderSub: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '600'
  },
  mapFooterBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  mapFooterClient: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A'
  },
  mapFooterAddress: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 1
  },
  mapCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8
  },
  mapCallBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12.5
  },

  // Form Cards
  formContainer: {
    gap: 12
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2
  },
  cardRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  label: {
    fontSize: 10.5,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  clientName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2
  },
  clientAddress: {
    fontSize: 12.5,
    color: '#475569',
    marginTop: 2
  },
  callCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10
  },
  appliancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 9,
    borderWidth: 1,
    borderColor: '#BAE6FD'
  },
  applianceText: {
    fontSize: 11.5,
    color: '#0369A1'
  },
  faultNotice: {
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 8,
    marginTop: 9,
    borderWidth: 1,
    borderColor: '#FEF3C7'
  },
  faultTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309'
  },
  faultDesc: {
    fontSize: 12,
    color: '#78350F',
    marginTop: 2
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A'
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  addItemBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700'
  },
  emptyItemsText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
    fontStyle: 'italic'
  },
  itemsTable: {
    marginTop: 10
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  itemName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A'
  },
  itemSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2
  },
  itemPrice: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A'
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#E2E8F0'
  },
  totalLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#334155'
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    fontSize: 12.5,
    color: '#0F172A',
    marginTop: 8,
    minHeight: 70,
    textAlignVertical: 'top'
  },
  paymentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 9
  },
  payPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  payPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  payPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569'
  },
  payPillTextActive: {
    color: '#FFFFFF'
  },
  signActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#EFF6FF',
    borderRadius: 6
  },
  signActionBtnText: {
    fontSize: 11.5,
    color: colors.primary,
    fontWeight: '700'
  },
  signaturePlaceholder: {
    height: 95,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 9
  },
  placeholderText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600'
  },
  signaturePreviewBox: {
    marginTop: 9,
    padding: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center'
  },
  signatureImage: {
    width: '100%',
    height: 80
  },
  signedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
    marginTop: 5
  },
  completeOrderBtn: {
    backgroundColor: colors.success,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 4
  },
  completeOrderBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  orderCompletedBanner: {
    backgroundColor: '#DEF7EC',
    borderWidth: 1,
    borderColor: '#BCF0DA',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  orderCompletedBannerText: {
    color: '#03543F',
    fontSize: 13.5,
    fontWeight: '700'
  },
  reopenOrderBannerBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%'
  },
  reopenOrderBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  bottomCloseBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6
  },
  bottomCloseBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569'
  },

  // Modal styles
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
    maxHeight: '85%',
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A'
  },
  modalSubHeader: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2
  },
  modalCloseIconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9'
  },
  catalogTabRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 10
  },
  catalogTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  catalogTabBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0284C7'
  },
  catalogTabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B'
  },
  catalogTabBtnTextActive: {
    color: '#0284C7'
  },
  newArticleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10
  },
  newArticleBannerTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#166534'
  },
  newArticleBannerSub: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 2
  },
  newArticleBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7
  },
  newArticleBannerBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  catalogSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 9,
    marginBottom: 8
  },
  catalogSearchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    fontSize: 13,
    color: '#0F172A'
  },
  typeFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8
  },
  typeFilterChip: {
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  typeFilterChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7'
  },
  typeFilterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569'
  },
  typeFilterChipTextActive: {
    color: '#FFFFFF'
  },
  emptyCatalogWrap: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyCatalogTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 10
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  emptyCreateBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  catItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 6
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4
  },
  typeBadgeText: {
    fontSize: 9.5,
    fontWeight: '800'
  },
  itemCodeText: {
    fontSize: 10.5,
    color: '#94A3B8',
    fontWeight: '600'
  },
  catItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2
  },
  catItemStockText: {
    fontSize: 11,
    color: '#64748B'
  },
  catItemPrice: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0284C7'
  },
  addCatItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 6
  },
  addCatItemBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  createFormCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  createFormTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A'
  },
  createFormSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 12
  },
  formLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
    marginTop: 6
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12.5,
    color: '#0F172A'
  },
  tipSelectorRow: {
    flexDirection: 'row',
    gap: 8
  },
  tipBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center'
  },
  tipBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0284C7'
  },
  tipBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#475569'
  },
  tipBtnTextActive: {
    color: '#0284C7'
  },
  tipBtnSub: {
    fontSize: 9.5,
    color: '#94A3B8',
    marginTop: 2
  },
  tipBtnSubActive: {
    color: '#0369A1'
  },
  unitChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6
  },
  unitChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  unitChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7'
  },
  unitChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B'
  },
  unitChipTextActive: {
    color: '#FFFFFF'
  },
  createActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  backToListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  backToListBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B'
  },
  saveCatalogOnlyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  saveCatalogOnlyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569'
  },
  saveAndAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#059669'
  },
  saveAndAddBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  qtyStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  qtyStepBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4
  },
  qtyValueText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    minWidth: 20,
    textAlign: 'center'
  },
  qtyStaticText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginHorizontal: 10
  },
  draftSaveRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  draftSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 7,
    paddingHorizontal: 11,
    paddingVertical: 6
  },
  draftSaveBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0284C7'
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
    backgroundColor: colors.primary
  },
  saveModalBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  delayHistoryCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  delayHistoryTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B'
  },
  delayHistoryItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#FEE2E2'
  },
  delayHistoryTime: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626'
  },
  delayHistoryText: {
    fontSize: 12,
    color: '#450A0A',
    marginTop: 2
  },
  adminControlCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    marginBottom: 12
  },
  adminControlTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0369A1'
  },
  adminDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6
  },
  adminDeleteBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  adminWorkerLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4
  },
  adminWorkerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 8,
    padding: 10
  },
  adminWorkerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A'
  },
  adminWorkerPhone: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  adminChangeBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6
  },
  adminChangeBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0284C7'
  },
  workerDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8
  },
  workerPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 6
  },
  workerPickRowActive: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD'
  },
  workerPickRowActiveOrange: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74'
  },
  workerPickName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A'
  },
  workerPickSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center'
  }
});
