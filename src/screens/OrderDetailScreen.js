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
  RotateCcw
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import MapComponent from '../components/MapComponent';
import SignaturePad from '../components/SignaturePad';

export default function OrderDetailScreen({ orderId, onBack }) {
  const { user, firmId } = useAuth();
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
    } catch (err) {
      Alert.alert('Greška', err.message || 'Neuspešno učitavanje detalja naloga.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus, reason = '') => {
    setStatusLoading(true);
    try {
      await api.updateOrderStatus(orderId, newStatus, user.id, '', reason);
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

  const loadCatalog = async (q = '') => {
    try {
      const res = await api.getCatalog(firmId, q);
      setCatalogItems(res || []);
    } catch (err) {
      console.warn('Greška kataloga:', err);
    }
  };

  const handleOpenCatalog = () => {
    loadCatalog(searchCatalogQuery);
    setShowCatalogModal(true);
  };

  const handleAddItemFromCatalog = (catItem) => {
    const existingIndex = items.findIndex(i => i.katalog_id === catItem.id);
    if (existingIndex > -1) {
      const updated = [...items];
      updated[existingIndex].kolicina = Number(updated[existingIndex].kolicina) + 1;
      updated[existingIndex].ukupno = updated[existingIndex].kolicina * updated[existingIndex].jedinicna_cena;
      setItems(updated);
    } else {
      const newItem = {
        katalog_id: catItem.id,
        naziv: catItem.naziv,
        jedinica_mere: catItem.jedinica_mere || 'kom',
        kolicina: 1,
        jedinicna_cena: parseFloat(catItem.cena || 0),
        ukupno: parseFloat(catItem.cena || 0)
      };
      setItems([...items, newItem]);
    }
    setShowCatalogModal(false);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (parseFloat(item.ukupno) || 0), 0);
  };

  const handleSaveSignature = (base64Url) => {
    setSignatureData(base64Url);
    setShowSignatureModal(false);
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
      Alert.alert('Uspešno', 'Radni nalog je uspešno overen i završen!', [
        { text: 'U redu', onPress: onBack }
      ]);
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
              onPress={() => handleUpdateStatus('U_RADU')}
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
            <View style={styles.workingNoticeBox}>
              <Wrench size={16} color="#D97706" style={{ marginRight: 8 }} />
              <Text style={styles.workingNoticeText}>Intervencija je u toku. Unesite delove, opis i preuzmite potpis na dnu.</Text>
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
    </View>
  );

  // Desna kolona / Radni formular
  const delayHistory = (order?.istorija || []).filter(h => h.novi_status === 'ODLOZENO');
  const hasDelays = delayHistory.length > 0 || !!order?.razlog_odlaganja;

  const renderOrderDetailsForm = () => (
    <View style={styles.formContainer}>
      {renderStatusStepper()}

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
          <Text style={styles.emptyItemsText}>Nema unetih stavki. Kliknite na dugme iznad za izbor iz kataloga.</Text>
        ) : (
          <View style={styles.itemsTable}>
            {items.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.naziv}</Text>
                  <Text style={styles.itemSub}>
                    {item.kolicina} {item.jedinica_mere || 'kom'} x {Number(item.jedinicna_cena).toLocaleString('sr-RS')} RSD
                  </Text>
                </View>
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
          <CheckCircle2 size={22} color={colors.success} style={{ marginRight: 8 }} />
          <Text style={styles.orderCompletedBannerText}>Radni nalog je overen i uspešno arhiviran.</Text>
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
              <View style={[styles.statusBadge, { backgroundColor: isDone ? '#DEF7EC' : '#E0F2FE' }]}>
                <Text style={[styles.statusBadgeText, { color: isDone ? colors.success : colors.primary }]}>
                  {order.status}
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
                height={220}
              />
            </View>
          ) : null}

          {renderOrderDetailsForm()}
        </ScrollView>
      )}

      {/* Catalog Items Modal */}
      <Modal visible={showCatalogModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Izbor delova i usluga sa lagera</Text>
              <TouchableOpacity onPress={() => setShowCatalogModal(false)}>
                <Text style={styles.modalCloseText}>Zatvori</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchModalInput}
              placeholder="Pretraži delove i usluge..."
              placeholderTextColor="#94A3B8"
              value={searchCatalogQuery}
              onChangeText={(text) => {
                setSearchCatalogQuery(text);
                loadCatalog(text);
              }}
            />

            <FlatList
              data={catalogItems}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.catItemRow}
                  onPress={() => handleAddItemFromCatalog(item)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.catItemName}>{item.naziv}</Text>
                    <Text style={styles.catItemSub}>Šifra: {item.sifra || '-'} • Tip: {item.tip}</Text>
                  </View>
                  <Text style={styles.catItemPrice}>{Number(item.cena).toLocaleString('sr-RS')} RSD</Text>
                </TouchableOpacity>
              )}
            />
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  orderCompletedBannerText: {
    color: '#03543F',
    fontSize: 13.5,
    fontWeight: '700'
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
  modalCloseText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary
  },
  searchModalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    marginVertical: 12
  },
  catItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  catItemName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A'
  },
  catItemSub: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2
  },
  catItemPrice: {
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.primary
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
  }
});
