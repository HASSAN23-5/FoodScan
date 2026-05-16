import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, FlatList, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../services/api';
import NutriScore from '../../components/NutriScore';
import NovaGroup from '../../components/NovaGroup';
import { ScanHistoryItem } from '../../types';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/scan/history');
      setRecentScans(data.history || []);
    } catch {}
  }, []);

  // Re-fetch when this tab becomes active (e.g. after a new scan)
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

  const renderRecentItem = ({ item }: { item: ScanHistoryItem }) => (
    <TouchableOpacity
      style={styles.recentCard}
      activeOpacity={0.7}
      onPress={() => router.push(`/product/${item.barcode}`)}
    >
      <View style={styles.recentImage}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        ) : (
          <Ionicons name="leaf" size={24} color={Colors.mutedForeground} />
        )}
      </View>
      <Text style={styles.recentName} numberOfLines={1}>{item.product_name || 'Produit'}</Text>
      <View style={styles.recentBadges}>
        {item.nutriscore_grade ? <NutriScore grade={item.nutriscore_grade} size="small" /> : null}
        {item.nova_group ? <NovaGroup group={item.nova_group} size="small" /> : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoIcon}>
            <Ionicons name="leaf" size={22} color={Colors.white} />
          </View>
          <Text style={styles.logoText}>FoodScan</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.avatarBtn} activeOpacity={0.8}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={{ width: 38, height: 38, borderRadius: 19 }} />
          ) : (
            <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Welcome */}
        <View style={styles.welcomeWrap}>
          <Text style={styles.welcome}>Bonjour, {user?.name?.split(' ')[0] || 'Utilisateur'}</Text>
          <Text style={styles.subtitle}>Scannez un produit pour découvrir ses infos nutritionnelles</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionScan} activeOpacity={0.85} onPress={() => router.push('/(tabs)/scan')}>
            <View style={styles.actionBlob} />
            <View style={styles.actionIconWrap}>
              <Ionicons name="scan" size={28} color={Colors.white} />
            </View>
            <Text style={styles.actionScanTitle}>Scanner</Text>
            <Text style={styles.actionScanSub}>Code-barres</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionSearch} activeOpacity={0.85} onPress={() => router.push('/(tabs)/search')}>
            <View style={[styles.actionIconWrap, { backgroundColor: Colors.secondary }]}>
              <Ionicons name="search" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.actionSearchTitle}>Rechercher</Text>
            <Text style={styles.actionSearchSub}>Par nom</Text>
          </TouchableOpacity>
        </View>

        {/* Compare quick row */}
        <TouchableOpacity style={styles.compareRow} activeOpacity={0.85} onPress={() => router.push('/compare')}>
          <View style={styles.compareIcon}>
            <Ionicons name="git-compare" size={22} color={Colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.compareTitle}>Comparer 2 produits</Text>
            <Text style={styles.compareSub}>Choisissez 2 articles scannés pour voir le meilleur</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.mutedForeground} />
        </TouchableOpacity>

        {/* Recent Scans */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Historique récent</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
            <Text style={styles.seeAll}>Voir tout</Text>
          </TouchableOpacity>
        </View>

        {recentScans.length > 0 ? (
          <FlatList
            data={recentScans.slice(0, 10)}
            renderItem={renderRecentItem}
            keyExtractor={(item) => item.scan_id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 16 }}
          />
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="time-outline" size={40} color={Colors.mutedForeground} />
            <Text style={styles.emptyTitle}>Aucun scan récent</Text>
            <Text style={styles.emptyText}>Commencez par scanner un produit</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/scan')}>
              <Text style={styles.emptyBtnText}>Scanner un produit</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* AI Coach Card — NOW CLICKABLE */}
        <TouchableOpacity
          style={styles.infoCard}
          activeOpacity={0.85}
          onPress={() => router.push('/ai-coach')}
        >
          <View style={styles.infoBlob} />
          <View style={styles.infoIcon}>
            <Ionicons name="sparkles" size={26} color={Colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Mangez mieux avec l'IA</Text>
            <Text style={styles.infoText}>
              Découvrez des conseils personnalisés et des alternatives plus saines.
            </Text>
            <View style={styles.infoCta}>
              <Text style={styles.infoCtaText}>Ouvrir le coach</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 2,
  },
  logoText: { fontSize: 21, fontWeight: '800', color: Colors.foreground, letterSpacing: -0.3 },
  avatarBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarText: { color: Colors.white, fontWeight: '700', fontSize: 16 },

  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  welcomeWrap: { marginBottom: 24 },
  welcome: { fontSize: 28, fontWeight: '800', color: Colors.foreground, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 15, color: Colors.mutedForeground, lineHeight: 21 },

  actions: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  actionScan: {
    flex: 1, backgroundColor: Colors.primary, borderRadius: 22, padding: 20, alignItems: 'center',
    position: 'relative', overflow: 'hidden',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 18, elevation: 5,
  },
  actionBlob: {
    position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.accent, opacity: 0.22,
  },
  actionSearch: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 22, padding: 20, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  actionIconWrap: {
    width: 54, height: 54, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  actionScanTitle: { fontSize: 17, fontWeight: '700', color: Colors.white },
  actionScanSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  actionSearchTitle: { fontSize: 17, fontWeight: '700', color: Colors.foreground },
  actionSearchSub: { fontSize: 12, color: Colors.mutedForeground, marginTop: 2 },

  compareRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.card, borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 26,
  },
  compareIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  compareTitle: { fontSize: 15, fontWeight: '700', color: Colors.foreground, marginBottom: 2 },
  compareSub: { fontSize: 12, color: Colors.mutedForeground },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: Colors.foreground },
  seeAll: { fontSize: 14, fontWeight: '600', color: Colors.primary },

  recentCard: {
    width: 144, backgroundColor: Colors.card, borderRadius: 18, padding: 10,
    borderWidth: 1, borderColor: Colors.border, marginRight: 12,
  },
  recentImage: {
    width: '100%', height: 84, borderRadius: 12, backgroundColor: Colors.muted,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8, overflow: 'hidden',
  },
  recentName: { fontSize: 13, fontWeight: '600', color: Colors.foreground, marginBottom: 6 },
  recentBadges: { flexDirection: 'row', gap: 6 },

  emptyCard: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 32, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, marginBottom: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.foreground, marginTop: 12 },
  emptyText: { fontSize: 13, color: Colors.mutedForeground, marginTop: 4, marginBottom: 16 },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: 22, paddingHorizontal: 22, paddingVertical: 11 },
  emptyBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },

  infoCard: {
    flexDirection: 'row', backgroundColor: Colors.secondary, borderRadius: 22, padding: 18,
    marginTop: 24, gap: 14, alignItems: 'flex-start',
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
  },
  infoBlob: {
    position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: 70,
    backgroundColor: Colors.accent, opacity: 0.12,
  },
  infoIcon: {
    width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 3,
  },
  infoTitle: { fontSize: 16, fontWeight: '700', color: Colors.foreground, marginBottom: 4 },
  infoText: { fontSize: 13, color: Colors.mutedForeground, lineHeight: 18 },
  infoCta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  infoCtaText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
});
