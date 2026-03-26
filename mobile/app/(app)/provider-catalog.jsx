import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import ScreenHeader from '../components/ScreenHeader';
import { useAuth, useThemeMode } from '../_layout';
import { apiRequest } from '../../src/api/client';
import { ui, spacing, radii, typography } from '../../theme/tokens';

function asNumber(v, fallback = 0) {
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : fallback;
}

export default function ProviderCatalogScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { theme } = useThemeMode();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/providers/mine/products', { method: 'GET', token });
      setRows(res.data?.products || []);
    } catch (e) {
      setError(e.message || 'Could not load catalog');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const normalized = useMemo(() => {
    return (rows || []).map((p) => ({
      name: String(p?.name || '').trim(),
      price: asNumber(p?.price, 0),
      stockQty: p?.stockQty == null ? '' : String(p.stockQty),
      requiresPrescription: !!p?.requiresPrescription,
      isRestricted: !!p?.isRestricted,
      description: p?.description ? String(p.description) : '',
      imageUrl: p?.imageUrl ? String(p.imageUrl) : '',
      category: p?.category ? String(p.category) : '',
      sku: p?.sku ? String(p.sku) : '',
    }));
  }, [rows]);

  const save = async () => {
    if (!token) return;
    const products = normalized
      .filter((p) => p.name)
      .map((p) => ({
        ...p,
        price: asNumber(p.price, 0),
        stockQty: p.stockQty === '' ? undefined : Math.max(0, Math.floor(asNumber(p.stockQty, 0))),
        description: p.description?.trim() || undefined,
        imageUrl: p.imageUrl?.trim() || undefined,
        category: p.category?.trim() || undefined,
        sku: p.sku?.trim() || undefined,
      }));

    try {
      setBusy(true);
      setError('');
      const res = await apiRequest('/providers/mine/products', { method: 'PUT', token, body: { products } });
      setRows(res.data?.products || []);
      Alert.alert('Catalog', 'Saved.');
    } catch (e) {
      setError(e.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const addRow = () => {
    setRows((r) => [
      ...(r || []),
      { name: '', price: 0, stockQty: 0, requiresPrescription: false, isRestricted: false },
    ]);
  };

  const updateRow = (idx, patch) => {
    setRows((r) => (r || []).map((it, i) => (i === idx ? { ...(it || {}), ...(patch || {}) } : it)));
  };

  if (loading) {
    return (
      <SafeAreaView style={ui.screen(theme)} edges={['top']}>
        <ScreenHeader title="Catalog" onBack={() => router.back()} />
        <ActivityIndicator color={theme.primary} style={{ marginTop: spacing.lg }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={ui.screen(theme)} edges={['top']}>
      <ScreenHeader title="Catalog" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }}>
        {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}

        <Text style={[ui.caption(theme), { color: theme.subtleText, lineHeight: 18 }]}>
          Update product name, price, and stock. StockQty = 0 means out of stock. Turn on prescription for restricted
          medicines.
        </Text>

        <TouchableOpacity style={[ui.buttonOutline(theme), { marginTop: spacing.md }]} onPress={addRow}>
          <Text style={ui.buttonText(theme)}>Add product</Text>
        </TouchableOpacity>

        {(rows || []).map((p, idx) => (
          <View key={`${p?.name || 'row'}-${idx}`} style={[ui.card(theme), { padding: spacing.md, marginTop: spacing.md }]}>
            <Text style={[ui.caption(theme), { fontFamily: typography.fontFamilySemiBold, marginBottom: spacing.xs }]}>
              Product {idx + 1}
            </Text>
            <TextInput
              value={String(p?.name || '')}
              onChangeText={(t) => updateRow(idx, { name: t })}
              placeholder="Name"
              placeholderTextColor={theme.subtleText}
              style={{ borderWidth: 1, borderColor: theme.border, borderRadius: radii.lg, padding: spacing.md, color: theme.text }}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <TextInput
                value={String(p?.price ?? '')}
                onChangeText={(t) => updateRow(idx, { price: t })}
                placeholder="Price (NGN)"
                placeholderTextColor={theme.subtleText}
                keyboardType="number-pad"
                style={{ flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: radii.lg, padding: spacing.md, color: theme.text }}
              />
              <TextInput
                value={p?.stockQty == null ? '' : String(p.stockQty)}
                onChangeText={(t) => updateRow(idx, { stockQty: t })}
                placeholder="StockQty"
                placeholderTextColor={theme.subtleText}
                keyboardType="number-pad"
                style={{ flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: radii.lg, padding: spacing.md, color: theme.text }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <TouchableOpacity
                style={[ui.buttonOutline(theme), p?.requiresPrescription ? { borderColor: theme.primary } : null]}
                onPress={() => updateRow(idx, { requiresPrescription: !p?.requiresPrescription })}
              >
                <Text style={ui.buttonText(theme)}>Prescription</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ui.buttonOutline(theme), p?.isRestricted ? { borderColor: theme.primary } : null]}
                onPress={() => updateRow(idx, { isRestricted: !p?.isRestricted })}
              >
                <Text style={ui.buttonText(theme)}>Restricted</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity style={[ui.buttonPrimary(theme), { marginTop: spacing.lg, opacity: busy ? 0.8 : 1 }]} onPress={save} disabled={busy}>
          <Text style={ui.buttonTextPrimary(theme)}>{busy ? 'Saving…' : 'Save catalog'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

