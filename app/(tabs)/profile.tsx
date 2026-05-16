import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { confirmDialog, alertDialog } from '../../utils/dialog';

interface Objectives {
  low_sugar?: boolean;
  low_salt?: boolean;
  low_fat?: boolean;
  high_protein?: boolean;
  high_fiber?: boolean;
  vegetarian?: boolean;
  vegan?: boolean;
  gluten_free?: boolean;
  lactose_free?: boolean;
}

interface Stats {
  total_scans: number;
  healthy_scans: number;
  healthy_ratio: number;
  by_nutriscore: Record<string, number>;
  by_nova: Record<string, number>;
}

const OBJECTIVES: { key: keyof Objectives; label: string; icon: any; description: string }[] = [
  { key: 'low_sugar', label: 'Peu de sucre', icon: 'ice-cream-outline', description: 'Privilégier moins de 5g/100g' },
  { key: 'low_salt', label: 'Peu de sel', icon: 'water-outline', description: 'Moins de 1,5g/100g' },
  { key: 'low_fat', label: 'Peu de graisses', icon: 'flame-outline', description: 'Réduire les matières grasses' },
  { key: 'high_protein', label: 'Riche en protéines', icon: 'barbell-outline', description: 'Plus de 10g/100g' },
  { key: 'high_fiber', label: 'Riche en fibres', icon: 'leaf-outline', description: 'Plus de 6g/100g' },
  { key: 'vegetarian', label: 'Végétarien', icon: 'nutrition-outline', description: 'Sans viande ni poisson' },
  { key: 'vegan', label: 'Végan', icon: 'flower-outline', description: 'Aucun produit animal' },
  { key: 'gluten_free', label: 'Sans gluten', icon: 'close-circle-outline', description: 'Éviter le gluten' },
  { key: 'lactose_free', label: 'Sans lactose', icon: 'cafe-outline', description: 'Éviter le lactose' },
];

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [objectives, setObjectives] = useState<Objectives>({});
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [profileRes, statsRes] = await Promise.all([
        api.get('/users/profile'),
        api.get('/users/stats').catch(() => ({ data: null })),
      ]);
      setObjectives(profileRes.data.objectives || {});
      setNameDraft(profileRes.data.name || '');
      if (statsRes.data) setStats(statsRes.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleObjective = async (key: keyof Objectives) => {
    const next = { ...objectives, [key]: !objectives[key] };
    setObjectives(next);
    setSaving(true);
    try {
      await api.put('/users/profile', { objectives: { [key]: next[key] } });
    } catch {
      setObjectives(objectives); // rollback
      await alertDialog('Erreur', "Impossible de sauvegarder l'objectif.");
    } finally {
      setSaving(false);
    }
  };

  const saveName = async () => {
    const newName = nameDraft.trim();
    if (!newName) return;
    setSaving(true);
    try {
      await api.put('/users/profile', { name: newName });
      await refreshUser();
      setEditingName(false);
    } catch {
      await alertDialog('Erreur', "Impossible de mettre à jour le nom.");
    } finally {
      setSaving(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    const ok = await confirmDialog(
      'Déconnexion',
      'Voulez-vous vraiment vous déconnecter ?',
      { confirmText: 'Déconnexion', destructive: true }
    );
    if (!ok) return;
    await logout();
    router.replace('/login');
  };

  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const activeCount = Object.values(objectives).filter(Boolean).length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* User header */}
        <View style={styles.userCard}>
          <View style={styles.userBlob} />
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>

          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="Votre nom"
                placeholderTextColor="rgba(255,255,255,0.5)"
                autoFocus
                onSubmitEditing={saveName}
              />
              <TouchableOpacity onPress={saveName} disabled={saving} style={styles.nameEditBtn}>
                <Ionicons name="checkmark" size={20} color={Colors.white} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setEditingName(false); setNameDraft(user?.name || ''); }} style={styles.nameEditBtn}>
                <Ionicons name="close" size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditingName(true)} style={styles.nameRow} activeOpacity={0.8}>
              <Text style={styles.userName}>{user?.name || 'Utilisateur'}</Text>
              <Ionicons name="pencil" size={14} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          )}

          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Stats card */}
        {stats && (
          <View style={styles.statsCard}>
            <Text style={styles.cardTitle}>Vos statistiques</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats.total_scans}</Text>
                <Text style={styles.statLabel}>Scans</Text>
              </View>
              <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}>
                <Text style={[styles.statValue, { color: Colors.nutriScore.A }]}>{stats.healthy_scans}</Text>
                <Text style={styles.statLabel}>A & B</Text>
              </View>
              <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}>
                <Text style={styles.statValue}>{Math.round((stats.healthy_ratio || 0) * 100)}%</Text>
                <Text style={styles.statLabel}>Sain</Text>
              </View>
            </View>

            {/* Nutri-Score breakdown bar */}
            {stats.total_scans > 0 && (
              <View style={styles.barWrap}>
                <Text style={styles.barLabel}>Répartition Nutri-Score</Text>
                <View style={styles.barRow}>
                  {(['A', 'B', 'C', 'D', 'E'] as const).map((g) => {
                    const count = stats.by_nutriscore[g] || 0;
                    const pct = (count / stats.total_scans) * 100;
                    if (count === 0) return null;
                    return (
                      <View
                        key={g}
                        style={{
                          flex: pct,
                          backgroundColor: Colors.nutriScore[g],
                          height: 10,
                        }}
                      />
                    );
                  })}
                </View>
                <View style={styles.barLegend}>
                  {(['A', 'B', 'C', 'D', 'E'] as const).map((g) => (
                    stats.by_nutriscore[g] ? (
                      <View key={g} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: Colors.nutriScore[g] }]} />
                        <Text style={styles.legendText}>{g} · {stats.by_nutriscore[g]}</Text>
                      </View>
                    ) : null
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Objectives section */}
        <View style={styles.objectivesCard}>
          <View style={styles.objHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Objectifs nutritionnels</Text>
              <Text style={styles.cardSub}>
                {activeCount > 0
                  ? `${activeCount} objectif${activeCount > 1 ? 's' : ''} actif${activeCount > 1 ? 's' : ''}`
                  : 'Personnalisez vos recommandations IA'}
              </Text>
            </View>
            {saving ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
          </View>

          <View style={styles.objList}>
            {OBJECTIVES.map((obj) => (
              <View key={obj.key} style={styles.objRow}>
                <View style={[styles.objIcon, objectives[obj.key] && { backgroundColor: Colors.primary }]}>
                  <Ionicons
                    name={obj.icon}
                    size={20}
                    color={objectives[obj.key] ? Colors.white : Colors.mutedForeground}
                  />
                </View>
                <View style={styles.objText}>
                  <Text style={styles.objLabel}>{obj.label}</Text>
                  <Text style={styles.objDesc}>{obj.description}</Text>
                </View>
                <Switch
                  value={!!objectives[obj.key]}
                  onValueChange={() => toggleObjective(obj.key)}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={Colors.white}
                  ios_backgroundColor={Colors.border}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Quick links */}
        <View style={styles.quickCard}>
          <TouchableOpacity style={styles.quickRow} onPress={() => router.push('/ai-coach')} activeOpacity={0.7}>
            <View style={[styles.quickIcon, { backgroundColor: Colors.accent }]}>
              <Ionicons name="sparkles" size={18} color={Colors.white} />
            </View>
            <Text style={styles.quickText}>Coach IA personnalisé</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.mutedForeground} />
          </TouchableOpacity>
          <View style={styles.quickDivider} />
          <TouchableOpacity style={styles.quickRow} onPress={() => router.push('/compare')} activeOpacity={0.7}>
            <View style={[styles.quickIcon, { backgroundColor: Colors.primary }]}>
              <Ionicons name="git-compare" size={18} color={Colors.white} />
            </View>
            <Text style={styles.quickText}>Comparer 2 produits</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={Colors.destructive} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, paddingBottom: 40 },

  // User card
  userCard: {
    backgroundColor: Colors.primary, borderRadius: 24, padding: 22, alignItems: 'center',
    marginBottom: 16, position: 'relative', overflow: 'hidden',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 6,
  },
  userBlob: {
    position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: 90,
    backgroundColor: Colors.accent, opacity: 0.18,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: { color: Colors.white, fontSize: 32, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { color: Colors.white, fontSize: 22, fontWeight: '700' },
  userEmail: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  nameInput: {
    color: Colors.white, fontSize: 18, fontWeight: '600',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.5)',
    minWidth: 140, paddingVertical: 2,
  },
  nameEditBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },

  // Stats
  statsCard: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.foreground, marginBottom: 4 },
  cardSub: { fontSize: 12, color: Colors.mutedForeground, marginBottom: 4 },
  statsRow: { flexDirection: 'row', marginTop: 12, marginBottom: 16 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  statValue: { fontSize: 26, fontWeight: '700', color: Colors.foreground },
  statLabel: { fontSize: 11, color: Colors.mutedForeground, marginTop: 2 },
  barWrap: { marginTop: 8 },
  barLabel: { fontSize: 12, fontWeight: '600', color: Colors.mutedForeground, marginBottom: 8 },
  barRow: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: Colors.muted },
  barLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: Colors.mutedForeground },

  // Objectives
  objectivesCard: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 16,
  },
  objHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  objList: { gap: 12 },
  objRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  objIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.muted,
    alignItems: 'center', justifyContent: 'center',
  },
  objText: { flex: 1 },
  objLabel: { fontSize: 14, fontWeight: '600', color: Colors.foreground },
  objDesc: { fontSize: 12, color: Colors.mutedForeground, marginTop: 1 },

  // Quick links
  quickCard: {
    backgroundColor: Colors.card, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 16, overflow: 'hidden',
  },
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 16 },
  quickIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.foreground },
  quickDivider: { height: 1, backgroundColor: Colors.border, marginLeft: 66 },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 50, borderRadius: 14, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2',
  },
  logoutText: { color: Colors.destructive, fontSize: 14, fontWeight: '600' },
});
