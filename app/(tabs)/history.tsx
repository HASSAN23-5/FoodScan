import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import NutriScore from '../../components/NutriScore';
import NovaGroup from '../../components/NovaGroup';
import { ScanHistoryItem } from '../../types';
import { confirmDialog, alertDialog } from '../../utils/dialog';

export default function HistoryScreen() {
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/scan/history');
      setHistory(data.history || []);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const deleteItem = async (item: ScanHistoryItem) => {
    const ok = await confirmDialog(
      'Supprimer',
      `Retirer "${item.product_name}" de l'historique ?`,
      { confirmText: 'Supprimer', destructive: true }
    );
    if (!ok) return;
    const prev = history;
    setHistory(history.filter(h => h.scan_id !== item.scan_id));
    try {
      await api.delete(`/scan/history/${item.scan_id}`);
    } catch {
      setHistory(prev);
      await alertDialog('Erreur', 'Suppression impossible.');
    }
  };

  const clearAll = async () => {
    if (history.length === 0) return;
    const ok = await confirmDialog(
      'Tout effacer',
      `Effacer les ${history.length} produit${history.length > 1 ? 's' : ''} de l'historique ?`,
      { confirmText: 'Tout effacer', destructive: true }
    );
    if (!ok) return;
    try {
      await api.delete('/scan/history');
      setHistory([]);
    } catch {
      await alertDialog('Erreur', "Impossible d'effacer l'historique.");
    }
  };

  const renderItem = ({ item }: { item: ScanHistoryItem }) => (
    <View style={styles.cardWrap}>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push(`/product/${item.barcode}`)}
        onLongPress={() => deleteItem(item)}
      >
        <View style={styles.cardImage}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          ) : (
            <Ionicons name="leaf" size={24} color={Colors.mutedForeground} />
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{item.product_name || 'Produit inconnu'}</Text>
          <Text style={styles.cardDate}>{formatDate(item.scanned_at)}</Text>
          <View style={styles.cardBadges}>
            {item.nutriscore_grade ? <NutriScore grade={item.nutriscore_grade} size="small" /> : null}
            {item.nova_group ? <NovaGroup group={item.nova_group} size="small" /> : null}
          </View>
        </View>
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); deleteItem(item); }}
          style={styles.rowDeleteBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.destructive} />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Historique</Text>
        {history.length > 0 ? (
          <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={16} color={Colors.destructive} />
            <Text style={styles.clearText}>Tout effacer</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Top action: compare */}
      {history.length >= 2 && (
        <TouchableOpacity
          style={styles.compareCta}
          activeOpacity={0.85}
          onPress={() => router.push('/compare')}
        >
          <View style={styles.compareIcon}>
            <Ionicons name="git-compare" size={20} color={Colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.compareCtaTitle}>Comparer 2 produits</Text>
            <Text style={styles.compareCtaSub}>Voir lequel a le meilleur profil</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.white} />
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={styles.center}>
          <View style={styles.loader} />
        </View>
      ) : (
        <FlatList
          data={history}
          renderItem={renderItem}
          keyExtractor={(item) => item.scan_id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          ListHeaderComponent={
            history.length > 0 ? (
              <Text style={styles.hintText}>Appuyez sur la corbeille pour supprimer</Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="time-outline" size={48} color={Colors.mutedForeground} />
              <Text style={styles.emptyTitle}>Aucun historique</Text>
              <Text style={styles.emptyText}>Vos produits scannés apparaîtront ici</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/scan')}>
                <Text style={styles.emptyBtnText}>Scanner un produit</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 22, fontWeight: '800', color: Colors.foreground, letterSpacing: -0.3 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  clearText: { color: Colors.destructive, fontSize: 12, fontWeight: '600' },
  compareCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: 16, padding: 14, borderRadius: 16, backgroundColor: Colors.primary,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 4,
  },
  compareIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  compareCtaTitle: { fontSize: 14, fontWeight: '700', color: Colors.white },
  compareCtaSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  list: { padding: 16 },
  hintText: { fontSize: 11, color: Colors.mutedForeground, textAlign: 'center', marginBottom: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loader: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: Colors.muted, borderTopColor: Colors.primary },
  cardWrap: { marginBottom: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    padding: 12, gap: 12,
  },
  rowDeleteBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF2F2',
    borderWidth: 1, borderColor: '#FECACA',
    alignItems: 'center', justifyContent: 'center',
  },
  cardImage: {
    width: 56, height: 56, borderRadius: 12, backgroundColor: Colors.muted,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '600', color: Colors.foreground, marginBottom: 2 },
  cardDate: { fontSize: 12, color: Colors.mutedForeground, marginBottom: 6 },
  cardBadges: { flexDirection: 'row', gap: 6 },
  emptyCard: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 32, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.foreground, marginTop: 12 },
  emptyText: { fontSize: 13, color: Colors.mutedForeground, marginTop: 4, marginBottom: 16 },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: 22, paddingHorizontal: 22, paddingVertical: 11 },
  emptyBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
});
