import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, FlatList, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import NutriScore from '../components/NutriScore';
import NovaGroup from '../components/NovaGroup';
import { ScanHistoryItem, Product } from '../types';

type Slot = 'A' | 'B';

interface NutriRow { key: string; label: string; unit: string; lowerIsBetter: boolean; }

const ROWS: NutriRow[] = [
  { key: 'energy_kcal_100g', label: 'Calories', unit: 'kcal', lowerIsBetter: true },
  { key: 'sugars_100g', label: 'Sucres', unit: 'g', lowerIsBetter: true },
  { key: 'fat_100g', label: 'Graisses', unit: 'g', lowerIsBetter: true },
  { key: 'saturated_fat_100g', label: 'dont saturées', unit: 'g', lowerIsBetter: true },
  { key: 'salt_100g', label: 'Sel', unit: 'g', lowerIsBetter: true },
  { key: 'fiber_100g', label: 'Fibres', unit: 'g', lowerIsBetter: false },
  { key: 'proteins_100g', label: 'Protéines', unit: 'g', lowerIsBetter: false },
];

export default function CompareScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState<Slot | null>(null);
  const [productA, setProductA] = useState<Product | null>(null);
  const [productB, setProductB] = useState<Product | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingProduct, setLoadingProduct] = useState<Slot | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/scan/history');
        setHistory(data.history || []);
      } catch {
        // ignore
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, []);

  const selectProduct = async (slot: Slot, item: ScanHistoryItem) => {
    setPickerOpen(null);
    setLoadingProduct(slot);
    try {
      const { data } = await api.get(`/products/barcode/${item.barcode}`);
      if (slot === 'A') setProductA(data); else setProductB(data);
    } catch {
      // fallback to history minimal info
      const minimal = {
        code: item.barcode, product_name: item.product_name, brands: '',
        image_url: item.image_url, image_small_url: item.image_url,
        nutriscore_grade: item.nutriscore_grade, nova_group: item.nova_group,
        categories: '', nutriments: {} as any,
      };
      if (slot === 'A') setProductA(minimal as any); else setProductB(minimal as any);
    } finally {
      setLoadingProduct(null);
    }
  };

  const getValue = (p: Product | null, key: string): number | null => {
    if (!p?.nutriments) return null;
    const v = (p.nutriments as any)[key];
    return v == null ? null : Number(v);
  };

  const compareCell = (key: string, lowerIsBetter: boolean): { a: 'win' | 'lose' | 'tie' | 'na'; b: 'win' | 'lose' | 'tie' | 'na' } => {
    const a = getValue(productA, key);
    const b = getValue(productB, key);
    if (a == null && b == null) return { a: 'na', b: 'na' };
    if (a == null) return { a: 'na', b: 'win' };
    if (b == null) return { a: 'win', b: 'na' };
    if (a === b) return { a: 'tie', b: 'tie' };
    const aBetter = lowerIsBetter ? a < b : a > b;
    return aBetter ? { a: 'win', b: 'lose' } : { a: 'lose', b: 'win' };
  };

  const scoreOrder: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 };
  const computeWinner = (): Slot | null => {
    if (!productA || !productB) return null;
    let scoreA = 0, scoreB = 0;
    // Nutri-Score weighted
    const nA = scoreOrder[(productA.nutriscore_grade || '').toUpperCase()] || 0;
    const nB = scoreOrder[(productB.nutriscore_grade || '').toUpperCase()] || 0;
    scoreA += nA * 2; scoreB += nB * 2;
    // Nova weighted (lower is better, scale 1-4 -> 4-1)
    if (productA.nova_group) scoreA += (5 - productA.nova_group);
    if (productB.nova_group) scoreB += (5 - productB.nova_group);
    // Per-row
    ROWS.forEach(r => {
      const c = compareCell(r.key, r.lowerIsBetter);
      if (c.a === 'win') scoreA += 1;
      if (c.b === 'win') scoreB += 1;
    });
    if (scoreA === scoreB) return null;
    return scoreA > scoreB ? 'A' : 'B';
  };

  const winner = computeWinner();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Comparer 2 produits</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Top selectors */}
        <View style={styles.topRow}>
          <ProductSlot
            slot="A"
            product={productA}
            loading={loadingProduct === 'A'}
            isWinner={winner === 'A'}
            onPick={() => setPickerOpen('A')}
            onClear={() => setProductA(null)}
          />
          <View style={styles.vsCircle}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          <ProductSlot
            slot="B"
            product={productB}
            loading={loadingProduct === 'B'}
            isWinner={winner === 'B'}
            onPick={() => setPickerOpen('B')}
            onClear={() => setProductB(null)}
          />
        </View>

        {/* Comparison */}
        {productA && productB ? (
          <View style={styles.tableCard}>
            {/* Scores row */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 2 }]}>Critère</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>A</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, textAlign: 'center' }]}>B</Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.cellLabel, { flex: 2 }]}>Nutri-Score</Text>
              <View style={[styles.cellValueWrap, { flex: 1 }]}>
                <NutriScore grade={productA.nutriscore_grade} size="small" />
              </View>
              <View style={[styles.cellValueWrap, { flex: 1 }]}>
                <NutriScore grade={productB.nutriscore_grade} size="small" />
              </View>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.cellLabel, { flex: 2 }]}>Groupe Nova</Text>
              <View style={[styles.cellValueWrap, { flex: 1 }]}>
                <NovaGroup group={productA.nova_group} size="small" />
              </View>
              <View style={[styles.cellValueWrap, { flex: 1 }]}>
                <NovaGroup group={productB.nova_group} size="small" />
              </View>
            </View>

            {/* Nutrient rows */}
            {ROWS.map((r) => {
              const a = getValue(productA, r.key);
              const b = getValue(productB, r.key);
              const c = compareCell(r.key, r.lowerIsBetter);
              return (
                <View key={r.key} style={styles.tableRow}>
                  <Text style={[styles.cellLabel, { flex: 2 }]}>{r.label}</Text>
                  <View style={[styles.cellValueWrap, { flex: 1 }]}>
                    <ValueCell value={a} unit={r.unit} state={c.a} />
                  </View>
                  <View style={[styles.cellValueWrap, { flex: 1 }]}>
                    <ValueCell value={b} unit={r.unit} state={c.b} />
                  </View>
                </View>
              );
            })}

            {/* Verdict */}
            {winner ? (
              <View style={[styles.verdictBox, { backgroundColor: `${Colors.primary}18` }]}>
                <Ionicons name="trophy" size={20} color={Colors.primary} />
                <Text style={styles.verdictText}>
                  <Text style={{ fontWeight: '700' }}>Produit {winner}</Text> a le meilleur profil nutritionnel global.
                </Text>
              </View>
            ) : (
              <View style={[styles.verdictBox, { backgroundColor: Colors.muted }]}>
                <Ionicons name="git-compare" size={20} color={Colors.foreground} />
                <Text style={styles.verdictText}>Les deux produits sont équivalents.</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="git-compare-outline" size={56} color={Colors.mutedForeground} />
            <Text style={styles.emptyTitle}>Sélectionnez 2 produits</Text>
            <Text style={styles.emptyText}>
              Choisissez deux produits scannés pour voir leur comparaison nutritionnelle en détail.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* History picker modal */}
      <Modal
        visible={pickerOpen !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerOpen(null)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Produit {pickerOpen}</Text>
            <TouchableOpacity onPress={() => setPickerOpen(null)} style={styles.modalClose}>
              <Ionicons name="close" size={22} color={Colors.foreground} />
            </TouchableOpacity>
          </View>
          {loadingHistory ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : history.length === 0 ? (
            <View style={styles.emptyModalState}>
              <Ionicons name="time-outline" size={48} color={Colors.mutedForeground} />
              <Text style={styles.emptyTitle}>Historique vide</Text>
              <Text style={styles.emptyText}>Scannez d'abord au moins 2 produits.</Text>
              <TouchableOpacity style={styles.scanBtn} onPress={() => { setPickerOpen(null); router.push('/(tabs)/scan'); }}>
                <Text style={styles.scanBtnText}>Scanner un produit</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={history}
              keyExtractor={(item) => item.scan_id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => {
                const otherBarcode = pickerOpen === 'A' ? productB?.code : productA?.code;
                const isAlreadyPicked = item.barcode === otherBarcode;
                return (
                  <TouchableOpacity
                    style={[styles.pickerItem, isAlreadyPicked && { opacity: 0.4 }]}
                    onPress={() => !isAlreadyPicked && pickerOpen && selectProduct(pickerOpen, item)}
                    disabled={isAlreadyPicked}
                    activeOpacity={0.7}
                  >
                    <View style={styles.pickerImg}>
                      {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      ) : (
                        <Ionicons name="leaf" size={24} color={Colors.mutedForeground} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerName} numberOfLines={1}>{item.product_name}</Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                        {item.nutriscore_grade ? <NutriScore grade={item.nutriscore_grade} size="small" /> : null}
                        {item.nova_group ? <NovaGroup group={item.nova_group} size="small" /> : null}
                      </View>
                    </View>
                    {isAlreadyPicked && (
                      <View style={styles.pickedBadge}><Text style={styles.pickedBadgeText}>Déjà choisi</Text></View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function ProductSlot({ slot, product, loading, isWinner, onPick, onClear }: {
  slot: Slot; product: Product | null; loading: boolean;
  isWinner: boolean; onPick: () => void; onClear: () => void;
}) {
  if (loading) {
    return (
      <View style={[styles.slot, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }
  if (!product) {
    return (
      <TouchableOpacity style={styles.slotEmpty} onPress={onPick} activeOpacity={0.7}>
        <View style={styles.slotEmptyIcon}>
          <Ionicons name="add" size={32} color={Colors.primary} />
        </View>
        <Text style={styles.slotEmptyLabel}>Produit {slot}</Text>
        <Text style={styles.slotEmptySub}>Toucher pour choisir</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={[styles.slot, isWinner && styles.slotWinner]}>
      {isWinner && (
        <View style={styles.winnerBadge}>
          <Ionicons name="trophy" size={12} color={Colors.white} />
        </View>
      )}
      <TouchableOpacity style={styles.slotClose} onPress={onClear}>
        <Ionicons name="close-circle" size={20} color={Colors.mutedForeground} />
      </TouchableOpacity>
      <View style={styles.slotImg}>
        {product.image_url || product.image_front_url ? (
          <Image source={{ uri: product.image_front_url || product.image_url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        ) : (
          <Ionicons name="leaf" size={28} color={Colors.mutedForeground} />
        )}
      </View>
      <Text style={styles.slotName} numberOfLines={2}>{product.product_name}</Text>
      <TouchableOpacity onPress={onPick} style={styles.slotChange}>
        <Text style={styles.slotChangeText}>Changer</Text>
      </TouchableOpacity>
    </View>
  );
}

function ValueCell({ value, unit, state }: { value: number | null; unit: string; state: 'win' | 'lose' | 'tie' | 'na' }) {
  const display = value == null ? '–' : `${value.toFixed(unit === 'g' ? 1 : 0)}${unit ? ` ${unit}` : ''}`;
  const color = state === 'win' ? Colors.nutriScore.A : state === 'lose' ? Colors.nutriScore.D : Colors.foreground;
  const weight = state === 'win' || state === 'lose' ? '700' : '500';
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 13, fontWeight: weight as any, color }}>{display}</Text>
      {state === 'win' && <Ionicons name="checkmark-circle" size={12} color={Colors.nutriScore.A} style={{ marginTop: 2 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.muted, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.foreground },
  scroll: { padding: 16, paddingBottom: 40 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  slot: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 20, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, minHeight: 180, position: 'relative',
  },
  slotWinner: { borderColor: Colors.primary, borderWidth: 2 },
  slotEmpty: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 20, padding: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed', minHeight: 180,
  },
  slotEmptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.secondary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  slotEmptyLabel: { fontSize: 14, fontWeight: '700', color: Colors.foreground },
  slotEmptySub: { fontSize: 11, color: Colors.mutedForeground, marginTop: 2 },
  slotImg: {
    width: 80, height: 80, borderRadius: 14, backgroundColor: Colors.muted,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10, overflow: 'hidden',
  },
  slotName: { fontSize: 13, fontWeight: '600', color: Colors.foreground, textAlign: 'center', marginBottom: 8 },
  slotChange: { backgroundColor: Colors.muted, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  slotChangeText: { fontSize: 11, color: Colors.foreground, fontWeight: '600' },
  slotClose: { position: 'absolute', top: 6, right: 6, zIndex: 2 },
  winnerBadge: { position: 'absolute', top: -6, left: -6, backgroundColor: Colors.primary, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', zIndex: 2 },

  vsCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  vsText: { color: Colors.white, fontWeight: '700', fontSize: 12 },

  // Table
  tableCard: { backgroundColor: Colors.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: Colors.border },
  tableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: 4 },
  tableHeaderText: { fontSize: 11, fontWeight: '700', color: Colors.mutedForeground, letterSpacing: 1 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cellLabel: { fontSize: 13, color: Colors.foreground, fontWeight: '500' },
  cellValueWrap: { alignItems: 'center' },
  verdictBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, marginTop: 12 },
  verdictText: { flex: 1, fontSize: 13, color: Colors.foreground, lineHeight: 18 },

  // Empty state
  emptyCard: { backgroundColor: Colors.card, borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.foreground, marginTop: 14 },
  emptyText: { fontSize: 13, color: Colors.mutedForeground, marginTop: 6, textAlign: 'center', lineHeight: 18 },
  scanBtn: { marginTop: 20, backgroundColor: Colors.primary, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 12 },
  scanBtnText: { color: Colors.white, fontWeight: '600' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.foreground },
  modalClose: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.muted, alignItems: 'center', justifyContent: 'center' },
  emptyModalState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  pickerImg: { width: 50, height: 50, borderRadius: 10, backgroundColor: Colors.muted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pickerName: { fontSize: 14, fontWeight: '600', color: Colors.foreground },
  pickedBadge: { backgroundColor: Colors.muted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  pickedBadgeText: { fontSize: 11, color: Colors.mutedForeground, fontWeight: '600' },
});
