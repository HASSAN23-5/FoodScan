import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import ProductCard from '../../components/ProductCard';
import { Product } from '../../types';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await api.get('/products/search', { params: { query: q } });
      setResults(data.products || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <View style={styles.searchInput}>
          <Ionicons name="search" size={20} color={Colors.mutedForeground} />
          <TextInput
            style={styles.input}
            placeholder="Rechercher un produit..."
            placeholderTextColor={Colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            autoFocus
          />
          {query ? (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
              <Ionicons name="close-circle" size={20} color={Colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : searched ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.code}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ProductCard
              code={item.code}
              product_name={item.product_name}
              brands={item.brands}
              image_url={item.image_small_url || item.image_url}
              nutriscore_grade={item.nutriscore_grade}
              nova_group={item.nova_group}
            />
          )}
          ListHeaderComponent={
            <Text style={styles.resultCount}>
              {results.length} résultat{results.length !== 1 ? 's' : ''} pour "{query}"
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="search-outline" size={48} color={Colors.mutedForeground} />
              <Text style={styles.emptyTitle}>Aucun résultat</Text>
              <Text style={styles.emptyText}>Essayez avec un autre terme ou scannez le code-barres</Text>
            </View>
          }
        />
      ) : (
        <View style={styles.center}>
          <View style={styles.initialIcon}>
            <Ionicons name="search" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.initialTitle}>Rechercher un produit</Text>
          <Text style={styles.initialText}>Entrez le nom d'un produit alimentaire</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBar: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchInput: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.muted, borderRadius: 24, paddingHorizontal: 16, height: 48,
  },
  input: { flex: 1, fontSize: 15, color: Colors.foreground },
  list: { padding: 16 },
  resultCount: { fontSize: 13, color: Colors.mutedForeground, marginBottom: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  initialIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.secondary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  initialTitle: { fontSize: 20, fontWeight: '600', color: Colors.foreground, marginBottom: 6 },
  initialText: { fontSize: 14, color: Colors.mutedForeground },
  emptyCard: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 32, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.foreground, marginTop: 12 },
  emptyText: { fontSize: 13, color: Colors.mutedForeground, marginTop: 4, textAlign: 'center' },
});
