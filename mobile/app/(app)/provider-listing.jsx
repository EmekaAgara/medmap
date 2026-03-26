import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  TextInput,
  Image,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useThemeMode } from '../_layout';
import ScreenHeader from '../components/ScreenHeader';
import { apiRequest, apiUpload } from '../../src/api/client';
import { ui, spacing, radii } from '../../theme/tokens';
import { normalizeCatalogProducts } from '../../src/utils/catalog';
import { ShimmerBlock, ShimmerText } from '../components/Shimmer';

const PROVIDER_TYPES = [
  { value: 'doctor', label: 'Doctor' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'hospital', label: 'Hospital' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatTimeHHMM(date) {
  if (!date) return '';
  const h = date.getHours();
  const m = date.getMinutes();
  return `${pad2(h)}:${pad2(m)}`;
}

function parseWorkingHours(workingHours) {
  const text = String(workingHours || '').toLowerCase();

  // Days
  const dayFlags = {};
  DAYS.forEach((d) => (dayFlags[d] = false));

  const allDaily =
    text.includes('daily') || text.includes('24/7') || text.includes('24h') || text.includes('open 24') || text.includes('open 24/7');
  if (allDaily) {
    DAYS.forEach((d) => (dayFlags[d] = true));
  } else {
    const dayHints = {
      Mon: ['mon', 'monday'],
      Tue: ['tue', 'tues', 'tuesday'],
      Wed: ['wed', 'weds', 'wednesday'],
      Thu: ['thu', 'thur', 'thurs', 'thursday'],
      Fri: ['fri', 'friday'],
      Sat: ['sat', 'saturday'],
      Sun: ['sun', 'sunday'],
    };
    Object.entries(dayHints).forEach(([k, hints]) => {
      if (hints.some((h) => text.includes(h))) dayFlags[k] = true;
    });
  }

  // Times (best-effort): grab first two time tokens.
  const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi;
  const matches = [];
  let m;
  // eslint-disable-next-line no-cond-assign
  while ((m = timeRegex.exec(text)) !== null) {
    const hour = parseInt(m[1], 10);
    const minute = m[2] ? parseInt(m[2], 10) : 0;
    const ampm = m[3] ? String(m[3]).toLowerCase() : null;
    if (!Number.isFinite(hour) || hour < 0 || hour > 24) continue;
    matches.push({ hour, minute, ampm });
    if (matches.length >= 2) break;
  }

  const now = new Date();
  const applyToken = ({ hour, minute, ampm }) => {
    let h = hour;
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    const d = new Date(now);
    d.setHours(h, minute, 0, 0);
    return d;
  };

  const start = matches[0] ? applyToken(matches[0]) : (() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  })();

  const end = matches[1] ? applyToken(matches[1]) : (() => {
    const d = new Date();
    d.setHours(17, 0, 0, 0);
    return d;
  })();

  // If we failed to detect any days, assume weekdays.
  const anyDay = DAYS.some((d) => dayFlags[d]);
  if (!anyDay) {
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach((d) => (dayFlags[d] = true));
  }

  return { dayFlags, start, end };
}

function workingHoursSummary(dayFlags, startTime, endTime) {
  const selected = DAYS.filter((d) => dayFlags?.[d]);
  if (!selected.length) return 'Closed';

  const isAll = selected.length === 7;
  const isMonFri = selected.join(',') === ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].join(',');
  const isSatSun = selected.join(',') === ['Sat', 'Sun'].join(',');
  const rangeLabel = isAll ? 'Daily' : isMonFri ? 'Mon–Fri' : isSatSun ? 'Sat–Sun' : selected.join(', ');

  const start = formatTimeHHMM(startTime);
  const end = formatTimeHHMM(endTime);
  if (!start || !end) return rangeLabel;
  return `${rangeLabel} ${start}-${end}`;
}

function accountTypeToProviderType(accountType) {
  const t = String(accountType || '').toLowerCase();
  if (t === 'doctor') return 'doctor';
  if (t === 'pharmacy_admin') return 'pharmacy';
  if (t === 'hospital_admin') return 'hospital';
  return 'doctor';
}

export default function ProviderListingScreen() {
  const { token, user } = useAuth();
  const { theme } = useThemeMode();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [moderationStatus, setModerationStatus] = useState('pending');

  const [providerType, setProviderType] = useState(accountTypeToProviderType(user?.accountType));
  const [name] = useState(user?.fullName || '');
  const [phone] = useState(user?.phone || '');

  const [imageUrl, setImageUrl] = useState('');
  const [isOpenNow, setIsOpenNow] = useState(true);
  const [hourlyRate, setHourlyRate] = useState('');

  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('Nigeria');

  const [dayFlags, setDayFlags] = useState(() => {
    const initial = {};
    DAYS.forEach((d) => (initial[d] = false));
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach((d) => (initial[d] = true));
    return initial;
  });
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  });
  const [endTime, setEndTime] = useState(() => {
    const d = new Date();
    d.setHours(17, 0, 0, 0);
    return d;
  });

  const [availabilityMode, setAvailabilityMode] = useState('always'); // always | fromDate
  const [availableFrom, setAvailableFrom] = useState(null);

  const [servicesList, setServicesList] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [newService, setNewService] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductDescription, setNewProductDescription] = useState('');
  const [newProductImageUrl, setNewProductImageUrl] = useState('');

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [timePicker, setTimePicker] = useState(null); // 'start' | 'end' | null
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const workingHoursText = useMemo(() => workingHoursSummary(dayFlags, startTime, endTime), [dayFlags, startTime, endTime]);
  const availabilityText = useMemo(() => {
    if (availabilityMode === 'fromDate' && availableFrom) {
      const iso = availableFrom.toISOString().slice(0, 10);
      return `Available from ${iso}`;
    }
    return 'Open daily';
  }, [availabilityMode, availableFrom]);

  const applyProviderFromMine = (provider) => {
    if (!provider) return;
    setModerationStatus(provider.moderationStatus || 'pending');
    setProviderType(provider.providerType || accountTypeToProviderType(user?.accountType));
    setImageUrl(provider.imageUrl || '');
    setIsOpenNow(provider.isOpenNow !== undefined ? !!provider.isOpenNow : true);
    setHourlyRate(provider.hourlyRate != null ? String(provider.hourlyRate) : '');
    setCity(provider.city || '');
    setAddress(provider.address || '');
    setCountry(provider.country || 'Nigeria');

    if (provider.location?.coordinates?.length === 2) {
      setLongitude(Number(provider.location.coordinates[0]));
      setLatitude(Number(provider.location.coordinates[1]));
    }

    if (provider.workingHours) {
      const parsed = parseWorkingHours(provider.workingHours);
      setDayFlags(parsed.dayFlags);
      setStartTime(parsed.start);
      setEndTime(parsed.end);
    }

    const avail = String(provider.availabilityText || '');
    if (avail.toLowerCase().includes('available from')) {
      const match = avail.match(/(\d{4}-\d{2}-\d{2})/);
      if (match?.[1]) {
        const d = new Date(match[1] + 'T00:00:00');
        if (!Number.isNaN(d.getTime())) {
          setAvailabilityMode('fromDate');
          setAvailableFrom(d);
        }
      }
    }

    setServicesList(provider.services || []);
    setProductsList(normalizeCatalogProducts(provider.products || []));
  };

  const loadMine = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/providers/mine', { method: 'GET', token });
      applyProviderFromMine(res.data || null);
    } catch (e) {
      // If no provider exists yet, stay in defaults.
      setError(e.message || 'Could not load your listing');
    } finally {
      setLoading(false);
    }
  }, [token, user?.accountType]);

  useEffect(() => {
    if (!token) return;
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const requestLocationAndAddress = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location permission needed', 'Allow location so we can set your provider coordinates and address.');
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      setLatitude(lat);
      setLongitude(lng);

      try {
        const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        const best = places?.[0];
        if (best) {
          const nextCity =
            best.city ||
            best.region ||
            best.subregion ||
            best.country ||
            city ||
            '';
          setCity(nextCity);

          const addr = [best.streetNumber ? `${best.streetNumber}` : '', best.name ? best.name : '', best.street ? best.street : '']
            .filter(Boolean)
            .join(' ')
            .trim();
          // expo-location reverse geocode varies by platform; fallback to a sensible string.
          setAddress(addr || best.formattedAddress || address || '');
          setCountry(best.country || country || 'Nigeria');
        }
      } catch {
        // Reverse geocode optional; coords are mandatory.
      }
    } catch (e) {
      Alert.alert('Location error', e.message || 'Could not get current location');
    }
  }, [city, address, country]);

  useEffect(() => {
    // Auto set coordinates on first entry.
    if (!token) return;
    requestLocationAndAddress();
  }, [token, requestLocationAndAddress]);

  const pickAvatar = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      const formData = new FormData();
      formData.append('avatar', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: `provider_${Date.now()}.jpg`,
      });

      setAvatarUploading(true);
      setError('');
      const res = await apiUpload('/providers/mine/avatar', { formData, token });
      if (res?.data?.imageUrl) setImageUrl(res.data.imageUrl);
    } catch (e) {
      Alert.alert('Upload failed', e.message || 'Could not upload image');
    } finally {
      setAvatarUploading(false);
    }
  }, [token]);

  const addItem = (kind, value) => {
    if (kind === 'service') {
      const v = String(value || '').trim();
      if (!v) return;
      setServicesList((prev) => (prev.includes(v) ? prev : [...prev, v]));
      setNewService('');
      return;
    }
    const name = String(newProductName || '').trim();
    if (!name) return;
    const price = Math.max(0, Number(newProductPrice) || 0);
    const row = { name, price };
    const desc = String(newProductDescription || '').trim();
    const img = String(newProductImageUrl || '').trim();
    if (desc) row.description = desc;
    if (img) row.imageUrl = img;
    setProductsList((prev) => [...prev, row]);
    setNewProductName('');
    setNewProductPrice('');
    setNewProductDescription('');
    setNewProductImageUrl('');
  };

  const removeItem = (kind, valueOrIndex) => {
    if (kind === 'service') setServicesList((prev) => prev.filter((x) => x !== valueOrIndex));
    else setProductsList((prev) => prev.filter((_, i) => i !== valueOrIndex));
  };

  const save = useCallback(async () => {
    try {
      if (!token) return;
      setSaving(true);
      setError('');

      if (!providerType) throw new Error('Provider type is required');
      if (!name?.trim()) throw new Error('Provider name is required');
      if (!phone?.trim()) throw new Error('Provider phone is required');
      if (latitude == null || longitude == null) throw new Error('Location coordinates are required');

      const nextHourly = hourlyRate === '' ? 0 : Number(hourlyRate);
      if (!Number.isFinite(nextHourly) || nextHourly < 0) throw new Error('Hourly rate must be a valid number');

      await apiRequest('/providers/mine', {
        method: 'POST',
        token,
        body: {
          providerType,
          name: name.trim(),
          phone: phone.trim(),
          email: user?.email || undefined,
          city: city.trim(),
          address: address.trim(),
          country: country || 'Nigeria',
          imageUrl: imageUrl.trim() || undefined,
          isOpenNow,
          hourlyRate: nextHourly,
          availabilityText,
          workingHours: workingHoursText,
          services: servicesList,
          products: productsList.map((p) => {
            const o = { name: p.name, price: p.price };
            if (p.description?.trim()) o.description = p.description.trim();
            if (p.imageUrl?.trim()) o.imageUrl = p.imageUrl.trim();
            return o;
          }),
          location: {
            latitude,
            longitude,
          },
          chatEnabled: true,
        },
      });

      Alert.alert('Saved', 'Your listing has been updated. Clinician accounts are usually published immediately.');
      await loadMine();
    } catch (e) {
      setError(e.message || 'Unable to save listing');
    } finally {
      setSaving(false);
    }
  }, [
    token,
    providerType,
    name,
    phone,
    latitude,
    longitude,
    hourlyRate,
    city,
    address,
    country,
    imageUrl,
    isOpenNow,
    availabilityText,
    workingHoursText,
    servicesList,
    productsList,
    user?.email,
    loadMine,
  ]);

  const toggleDay = (d) => {
    setDayFlags((prev) => ({ ...prev, [d]: !prev[d] }));
  };

  const timeValue = timePicker === 'end' ? endTime : startTime;
  const onChangeTime = (event, date) => {
    if (!date) {
      setTimePicker(null);
      return;
    }
    setTimePicker(null);
    if (timePicker === 'end') setEndTime(date);
    else setStartTime(date);
  };

  return (
    <SafeAreaView style={ui.screen(theme)} edges={['top']}>
      <ScreenHeader title="Provider listing" />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing['2xl'] }}>
        {loading ? (
          <View style={{ gap: spacing.md }}>
            <ShimmerBlock theme={theme} style={{ height: 120, borderRadius: radii.lg }} />
            <View style={[ui.card(theme), { padding: spacing.md }]}>
              <ShimmerText theme={theme} lines={3} />
            </View>
            <View style={[ui.card(theme), { padding: spacing.md }]}>
              <ShimmerText theme={theme} lines={3} />
            </View>
          </View>
        ) : null}
        {error ? <Text style={ui.errorText(theme)}>{error}</Text> : null}

        {moderationStatus ? (
          <View style={[ui.card(theme), { padding: spacing.md, marginBottom: spacing.md, backgroundColor: theme.card }]}>
            <Text style={[ui.caption(theme), { fontWeight: '800', marginBottom: spacing.xs }]}>Approval status</Text>
            <Text style={{ color: theme.text }}>{moderationStatus === 'approved' ? 'Approved' : moderationStatus === 'rejected' ? 'Rejected' : 'Pending approval'}</Text>
          </View>
        ) : null}

        <View style={[ui.card(theme), { padding: spacing.md, marginBottom: spacing.md, backgroundColor: theme.card }]}>
          <Text style={[ui.caption(theme), { fontWeight: '800', marginBottom: spacing.sm }]}>Provider image</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              />
            ) : (
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  borderWidth: 1,
                  borderColor: theme.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.secondary,
                }}
              >
                <Text style={{ color: theme.text, fontWeight: '900' }}>{(name || '?').slice(0, 2).toUpperCase()}</Text>
              </View>
            )}

            <TouchableOpacity style={[ui.buttonOutline(theme), { marginLeft: 'auto' }]} onPress={pickAvatar} disabled={avatarUploading}>
              <Text style={ui.buttonText(theme)}>{avatarUploading ? 'Uploading...' : imageUrl ? 'Change photo' : 'Upload photo'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[ui.card(theme), { padding: spacing.md, marginBottom: spacing.md, backgroundColor: theme.card }]}>
          <Text style={[ui.caption(theme), { fontWeight: '800', marginBottom: spacing.sm }]}>Provider type</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {PROVIDER_TYPES.map((item) => (
              <TouchableOpacity
                key={item.value}
                onPress={() => setProviderType(item.value)}
                style={{
                  borderWidth: 1,
                  borderColor: providerType === item.value ? theme.primary : theme.border,
                  borderRadius: 999,
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.md,
                  backgroundColor: providerType === item.value ? theme.primary + '22' : 'transparent',
                }}
              >
                <Text style={{ color: theme.text }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ marginTop: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={ui.caption(theme)}>{isOpenNow ? 'Currently open' : 'Currently closed'}</Text>
            <Switch value={isOpenNow} onValueChange={(v) => setIsOpenNow(v)} />
          </View>

          <View style={{ marginTop: spacing.md }}>
            <Text style={[ui.caption(theme), { fontWeight: '700', marginBottom: spacing.xs }]}>Hourly rate (NGN)</Text>
            <TextInput
              value={hourlyRate}
              onChangeText={setHourlyRate}
              keyboardType="numeric"
              placeholder="e.g. 15000"
              placeholderTextColor={theme.subtleText}
              style={ui.input(theme)}
            />
          </View>
        </View>

        <View style={[ui.card(theme), { padding: spacing.md, marginBottom: spacing.md, backgroundColor: theme.card }]}>
          <Text style={[ui.caption(theme), { fontWeight: '800', marginBottom: spacing.sm }]}>Working hours</Text>

          <Text style={[ui.caption(theme), { fontWeight: '700', marginBottom: spacing.xs }]}>Open days</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {DAYS.map((d) => {
              const active = !!dayFlags[d];
              return (
                <TouchableOpacity
                  key={d}
                  onPress={() => toggleDay(d)}
                  style={{
                    borderWidth: 1,
                    borderColor: active ? theme.primary : theme.border,
                    backgroundColor: active ? theme.primary + '22' : 'transparent',
                    borderRadius: 999,
                    paddingVertical: spacing.xs,
                    paddingHorizontal: spacing.md,
                  }}
                >
                  <Text style={{ color: active ? theme.text : theme.subtleText, fontWeight: '800' }}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <TouchableOpacity style={[ui.buttonOutline(theme), { justifyContent: 'center' }]} onPress={() => setTimePicker('start')}>
              <Text style={ui.buttonText(theme)}>
                Open time: {formatTimeHHMM(startTime)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[ui.buttonOutline(theme), { justifyContent: 'center' }]} onPress={() => setTimePicker('end')}>
              <Text style={ui.buttonText(theme)}>
                Close time: {formatTimeHHMM(endTime)}
              </Text>
            </TouchableOpacity>
          </View>

          {timePicker ? (
            <DateTimePicker
              value={timeValue}
              mode="time"
              display="default"
              onChange={onChangeTime}
            />
          ) : null}

          <View style={{ marginTop: spacing.md }}>
            <Text style={[ui.caption(theme), { fontWeight: '700', marginBottom: spacing.xs }]}>Available from</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={ui.caption(theme)}>{availabilityMode === 'fromDate' ? 'Using date' : 'Open daily'}</Text>
              <Switch value={availabilityMode === 'fromDate'} onValueChange={(v) => setAvailabilityMode(v ? 'fromDate' : 'always')} />
            </View>

            {availabilityMode === 'fromDate' ? (
              <View style={{ marginTop: spacing.sm }}>
                <TouchableOpacity
                  style={[ui.buttonOutline(theme)]}
                  onPress={() => setDatePickerVisible(true)}
                >
                  <Text style={ui.buttonText(theme)}>
                    {availableFrom ? `Start: ${availableFrom.toISOString().slice(0, 10)}` : 'Pick a date'}
                  </Text>
                </TouchableOpacity>
                {datePickerVisible ? (
                  <DateTimePicker
                    value={availableFrom || new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setDatePickerVisible(false);
                      if (!date) return;
                      setAvailableFrom(date);
                    }}
                  />
                ) : null}
              </View>
            ) : null}
          </View>

          <Text style={[ui.caption(theme), { marginTop: spacing.sm }]}>Summary: {workingHoursText}</Text>
        </View>

        <View style={[ui.card(theme), { padding: spacing.md, marginBottom: spacing.md, backgroundColor: theme.card }]}>
          <Text style={[ui.caption(theme), { fontWeight: '800', marginBottom: spacing.sm }]}>Location</Text>
          <Text style={ui.caption(theme)}>{latitude != null && longitude != null ? `Lat ${latitude.toFixed(4)} · Lng ${longitude.toFixed(4)}` : 'Fetching coordinates...'}</Text>
          <Text style={ui.caption(theme)}>{city ? `City: ${city}` : 'Fetching city...'}</Text>
          <Text style={ui.caption(theme)}>{address ? `Address: ${address}` : 'Fetching address...'}</Text>
        </View>

        <View style={[ui.card(theme), { padding: spacing.md, marginBottom: spacing.md, backgroundColor: theme.card }]}>
          <Text style={[ui.caption(theme), { fontWeight: '800', marginBottom: spacing.sm }]}>Services</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.sm }}>
            <TextInput
              value={newService}
              onChangeText={setNewService}
              placeholder="Add a service"
              placeholderTextColor={theme.subtleText}
              style={[ui.input(theme), { flex: 1, marginBottom: 0 }]}
            />
            <TouchableOpacity style={[ui.buttonPrimary(theme)]} onPress={() => addItem('service', newService)}>
              <Text style={ui.buttonTextPrimary(theme)}>Add</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {servicesList.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => removeItem('service', s)}
                style={{
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: 999,
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.md,
                  backgroundColor: theme.secondary,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                }}
              >
                <Text style={{ color: theme.text, fontWeight: '800' }} numberOfLines={1}>
                  {s}
                </Text>
                <Text style={{ color: theme.subtleText, fontWeight: '900' }}>×</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[ui.card(theme), { padding: spacing.md, marginBottom: spacing.md, backgroundColor: theme.card }]}>
          <Text style={[ui.caption(theme), { fontWeight: '800', marginBottom: spacing.xs }]}>Products for sale</Text>
          <Text style={[ui.caption(theme), { marginBottom: spacing.md, color: theme.subtleText }]}>
            Add name, price (0 = free), optional description and image URL for your shop.
          </Text>
          <TextInput
            value={newProductName}
            onChangeText={setNewProductName}
            placeholder="Product name *"
            placeholderTextColor={theme.subtleText}
            style={[ui.input(theme), { marginBottom: spacing.sm }]}
          />
          <TextInput
            value={newProductPrice}
            onChangeText={setNewProductPrice}
            placeholder="Price in ₦ (0 for free)"
            placeholderTextColor={theme.subtleText}
            keyboardType="numeric"
            style={[ui.input(theme), { marginBottom: spacing.sm }]}
          />
          <TextInput
            value={newProductDescription}
            onChangeText={setNewProductDescription}
            placeholder="Short description (optional)"
            placeholderTextColor={theme.subtleText}
            multiline
            style={[ui.input(theme), { marginBottom: spacing.sm, minHeight: 72, textAlignVertical: 'top' }]}
          />
          <TextInput
            value={newProductImageUrl}
            onChangeText={setNewProductImageUrl}
            placeholder="Image URL (optional)"
            placeholderTextColor={theme.subtleText}
            autoCapitalize="none"
            style={[ui.input(theme), { marginBottom: spacing.md }]}
          />
          <TouchableOpacity
            onPress={() => addItem('product')}
            activeOpacity={0.88}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              backgroundColor: theme.primary,
              borderRadius: radii.lg,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
            }}
          >
            <Ionicons name="add-circle" size={22} color={theme.primaryForeground} />
            <Text style={{ color: theme.primaryForeground, fontWeight: '800', fontSize: 16 }}>Add to catalog</Text>
          </TouchableOpacity>

          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {productsList.map((p, i) => (
              <TouchableOpacity
                key={`${p.name}-${p.price}-${i}`}
                onPress={() => removeItem('product', i)}
                activeOpacity={0.85}
                style={{
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderRadius: radii.md,
                  padding: spacing.sm,
                  backgroundColor: theme.secondary,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                {p.imageUrl ? (
                  <Image source={{ uri: p.imageUrl }} style={{ width: 44, height: 44, borderRadius: radii.sm }} />
                ) : (
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radii.sm,
                      backgroundColor: theme.card,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: theme.border,
                    }}
                  >
                    <Ionicons name="cube-outline" size={20} color={theme.subtleText} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontWeight: '800' }} numberOfLines={2}>
                    {p.name}
                  </Text>
                  <Text style={{ color: theme.primary, fontWeight: '700', marginTop: 2 }}>
                    {p.price > 0 ? `₦${Number(p.price).toLocaleString()}` : 'Free'}
                  </Text>
                </View>
                <Ionicons name="close-circle" size={24} color={theme.subtleText} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={ui.buttonPrimary(theme)} onPress={save} disabled={saving}>
          <Text style={ui.buttonTextPrimary(theme)}>{saving ? 'Submitting...' : 'Submit for approval'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
