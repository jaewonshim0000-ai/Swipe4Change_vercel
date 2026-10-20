import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Place, normalizeCity, sampleCities } from '../domain/location';
import { cityFromDevice, searchCities } from '../data/places';
import { isDemo } from '../data/provider';
import { Press, Sheet } from './kit';
import { Glyph } from './glyph';
import { Notice, colors, fonts, styles } from './ui';

/** Search real US cities or detect the current one. Only "City, ST" is ever handed back. */
export function CitySheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (city: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      searchCities(query, controller.signal)
        .then((r) => {
          setResults(r);
          setError('');
        })
        .catch((e: Error) => {
          if (!controller.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function pick(city: string) {
    setQuery('');
    setError('');
    onPick(city);
    onClose();
  }

  async function locate() {
    setLocating(true);
    setError('');
    try {
      pick(await cityFromDevice());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We couldn’t find your city.');
    } finally {
      setLocating(false);
    }
  }

  const typed = normalizeCity(query);
  const samples = isDemo ? sampleCities.filter((c) => normalizeCity(c.city).startsWith(typed)) : [];
  const found = typed.length >= 2 ? results : [];
  const list = [...samples, ...found.filter((r) => !samples.some((s) => s.city === r.city))];

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: fonts.display,
          fontSize: 24,
          lineHeight: 29,
          letterSpacing: -0.4,
          color: colors.ink,
          marginBottom: 12,
        }}
      >
        Your city
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: colors.canvas,
          borderRadius: 999,
          paddingHorizontal: 16,
          minHeight: 50,
        }}
      >
        <Glyph name="search" size={18} color={colors.muted} />
        <TextInput
          accessibilityLabel="Search for a city"
          value={query}
          onChangeText={setQuery}
          placeholder="Start typing a city"
          placeholderTextColor="#8C9086"
          autoCorrect={false}
          autoFocus
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: fonts.body,
            fontSize: 15,
            color: colors.ink,
            paddingVertical: 12,
          }}
        />
        {searching && <ActivityIndicator color={colors.muted} />}
      </View>
      <Press
        accessibilityLabel="Use my current location"
        disabled={locating}
        onPress={() => void locate()}
        style={{
          marginTop: 12,
          minHeight: 48,
          borderRadius: 999,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: colors.soft,
        }}
      >
        <Glyph name="pin" size={18} color={colors.accent} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>
          {locating ? 'Finding your city…' : 'Use my current location'}
        </Text>
      </Press>
      {!!error && (
        <View style={{ marginTop: 12 }}>
          <Notice error text={error} />
        </View>
      )}
      <View style={{ marginTop: 8 }}>
        {list.map((p) => (
          <Pressable
            key={p.city}
            accessibilityRole="button"
            accessibilityLabel={`${p.city}, ${p.detail}`}
            onPress={() => pick(p.city)}
            style={{
              minHeight: 52,
              paddingVertical: 8,
              justifyContent: 'center',
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
            }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>
              {p.city}
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>
              {p.detail}
            </Text>
          </Pressable>
        ))}
        {typed.length >= 2 && !searching && !list.length && !error && (
          <Text style={[styles.muted, { paddingVertical: 12 }]}>
            No US city matches “{query.trim()}”.
          </Text>
        )}
      </View>
      <Text style={[styles.micro, { marginTop: 12 }]}>
        Only your city and state are saved — never your exact location.
      </Text>
    </Sheet>
  );
}

/** A form field that shows the chosen city and opens the city sheet. */
export function CityField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (city: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || 'not chosen'}. Change`}
        onPress={() => setOpen(true)}
        style={[
          styles.input,
          { flexDirection: 'row', alignItems: 'center', gap: 8 },
          error ? { borderWidth: 1, borderColor: colors.error } : null,
        ]}
      >
        <Glyph name="pin" size={16} color={colors.accent} />
        <Text
          style={{
            flex: 1,
            fontFamily: fonts.body,
            fontSize: 15,
            color: value ? colors.ink : colors.placeholder,
          }}
        >
          {value || 'Choose a city'}
        </Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.accent }}>
          Change
        </Text>
      </Pressable>
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <CitySheet visible={open} onClose={() => setOpen(false)} onPick={onChange} />
    </View>
  );
}
