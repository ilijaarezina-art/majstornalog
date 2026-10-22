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
  ExternalLink
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import MapComponent from '../components/MapComponent';
import SignaturePad from '../components/SignaturePad';

export default function OrderDetailScreen({ orderId, onBack }) {
  const { user, firmId } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 850;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Stavke radnog naloga (delovi i radni sati)
  const [items, setItems] = useState([]);
  const [workDescription, setWorkDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('GOTOVINA');
  const [signatureData, setSignatureData] = useState(null);
  const [signerName, setSignerName] = useState('');

  // Modali
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
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
        { text: 'OK', onPress: onBack }
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
        <Text style={styles.loaderText}>Učitavanje naloga...</Text>
      </View>
    );
  }

  const isDone = order.status === 'ZAVRSENO';
  const totalPrice = calculateTotal();

  // Desna kolona sa svim formama i stavkama
  const renderOrderDetailsForm = () => (
    <View style={styles.formContainer}>
      {/* Client & Device Card */}
      <View style={styles.card}>
        <View style={styles.cardRowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Klijent i lokacija</Text>
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
              <Text style={styles.addItemBtnText}>Dodaj deo / uslugu</Text>
            </TouchableOpacity>
          )}
        </View>

        {items.length === 0 ? (
          <Text style={styles.emptyItemsText}>Nema dodatih delova. Kliknite na dugme iznad za izbor iz kataloga.</Text>
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
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
          <ArrowLeft size={20} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.headerTitle}>{order.broj_naloga}</Text>
            <View style={[styles.statusBadge, { backgroundColor: isDone ? '#DEF7EC' : '#E0F2FE' }]}>
              <Text style={[styles.statusBadgeText, { color: isDone ? colors.success : colors.primary }]}>
                {order.status}
              </Text>
            </View>
          </View>
          <Text style={styles.headerSub}>
            {order.tip_intervencije} • Prioritet: {order.prioritet} • Zakazano: {order.zakazano_za}
          </Text>
        </View>
      </View>

      {/* Responsive Layout: Desktop 50:50 Split (Left Map, Right Details) / Mobile Stacked */}
      {isDesktop ? (
        <View style={styles.desktopContainer}>
          {/* Left Column: 50% width Map & Navigation view */}
          <View style={styles.desktopLeftCol}>
            <View style={styles.mapCard}>
              <View style={styles.mapHeaderBar}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MapPin size={17} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.mapHeaderTitle}>Karta terena i lokacija klijenta</Text>
                </View>
                <Text style={styles.mapHeaderSub}>{order.adresa}</Text>
              </View>

              <MapComponent
                clientLocation={order.gpsX && order.gpsY ? {
                  lat: parseFloat(order.gpsX),
                  lng: parseFloat(order.gpsY),
                  name: order.klijent_ime,
                  address: order.adresa
                } : null}
                workerLocation={{ lat: 44.6627, lng: 20.9300 }}
                height={520}
              />

              {/* Map Footer Info */}
              <View style={styles.mapFooterBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mapFooterClient}>{order.klijent_ime}</Text>
                  <Text style={styles.mapFooterAddress}>{order.adresa} {order.sprat_stan ? `(${order.sprat_stan})` : ''}</Text>
                  <Text style={styles.mapFooterPhone}>Tel: {order.klijent_telefon}</Text>
                </View>
                <TouchableOpacity
                  style={styles.mapCallBtn}
                  onPress={() => Linking.openURL(`tel:${order.klijent_telefon}`)}
                  activeOpacity={0.8}
                >
                  <Phone size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.mapCallBtnText}>Pozovi</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Right Column: 50% width scrollable Order Details */}
          <ScrollView style={styles.desktopRightCol} contentContainerStyle={styles.desktopRightContent}>
            {renderOrderDetailsForm()}
          </ScrollView>
        </View>
      ) : (
        /* Mobile Layout: Stacked vertically */
        <ScrollView contentContainerStyle={styles.mobileScroll}>
          {order.gpsX && order.gpsY ? (
            <View style={styles.mobileMapSection}>
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
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 14,
    paddingBottom: 14,
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
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A'
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800'
  },

  // Desktop 50:50 Split Layout
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    gap: 16
  },
  desktopLeftCol: {
    flex: 1, // 50%
    height: '100%'
  },
  desktopRightCol: {
    flex: 1, // 50%
    height: '100%'
  },
  desktopRightContent: {
    paddingBottom: 24
  },

  // Mobile Stacked Layout
  mobileScroll: {
    padding: 14,
    paddingBottom: 24
  },
  mobileMapSection: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 12
  },

  // Map Card on Desktop
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  mapHeaderTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A'
  },
  mapHeaderSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600'
  },
  mapFooterBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0'
  },
  mapFooterClient: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A'
  },
  mapFooterAddress: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2
  },
  mapFooterPhone: {
    fontSize: 11.5,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 2
  },
  mapCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  mapCallBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },

  // Form Cards
  formContainer: {
    gap: 12
  },
  card: {
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
  cardRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  label: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  clientName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2
  },
  clientAddress: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2
  },
  callCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12
  },
  appliancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD'
  },
  applianceText: {
    fontSize: 12,
    color: '#0369A1'
  },
  faultNotice: {
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FEF3C7'
  },
  faultTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309'
  },
  faultDesc: {
    fontSize: 12.5,
    color: '#78350F',
    marginTop: 2
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A'
  },
  sectionSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 1
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8
  },
  addItemBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  emptyItemsText: {
    fontSize: 12.5,
    color: '#94A3B8',
    marginTop: 10,
    fontStyle: 'italic'
  },
  itemsTable: {
    marginTop: 12
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A'
  },
  itemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A'
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#E2E8F0'
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155'
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '900',
    color: colors.primary
  },
  textArea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    marginTop: 8,
    minHeight: 80,
    textAlignVertical: 'top'
  },
  paymentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10
  },
  payPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  payPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  payPillText: {
    fontSize: 12,
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
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700'
  },
  signaturePlaceholder: {
    height: 110,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10
  },
  placeholderText: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '600'
  },
  signaturePreviewBox: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center'
  },
  signatureImage: {
    width: '100%',
    height: 90
  },
  signedLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.success,
    marginTop: 6
  },
  completeOrderBtn: {
    backgroundColor: colors.success,
    paddingVertical: 15,
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
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  orderCompletedBanner: {
    backgroundColor: '#DEF7EC',
    borderWidth: 1,
    borderColor: '#BCF0DA',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  orderCompletedBannerText: {
    color: '#03543F',
    fontSize: 14,
    fontWeight: '700'
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
  }
});
