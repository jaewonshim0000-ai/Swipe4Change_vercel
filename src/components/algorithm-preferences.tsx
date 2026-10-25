import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useCommand } from '../data/provider';
import { Profile, Topic, topics } from '../domain/model';
import { CityField } from './city-picker';
import { Glyph } from './glyph';
import { PillChip, Press, Sheet, Switch, toast } from './kit';
import { Button, Notice, colors, fonts, styles } from './ui';

/** Shared entry point; mounting the editor on open starts each draft from saved preferences. */
export function AlgorithmPreferences({ profile }: { profile: Profile | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Press
        accessibilityLabel="Algorithm preferences"
        accessibilityHint="Opens your recommendation settings"
        onPress={() => setOpen(true)}
        style={{
          minHeight: 44,
          minWidth: 44,
          paddingHorizontal: 12,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.white,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Glyph name="filters" size={19} color={colors.accent} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>
          Algorithm
        </Text>
      </Press>
      {open &&
        (profile ? (
          <PreferencesEditor profile={profile} onClose={() => setOpen(false)} />
        ) : (
          <Sheet visible onClose={() => setOpen(false)}>
            <Text accessibilityRole="header" style={styles.title}>
              Algorithm preferences
            </Text>
            <Text style={[styles.muted, { marginVertical: 12 }]}>
              Sign in to choose your interests, city and activity preferences.
            </Text>
            <Button
              title="Sign in"
              onPress={() => {
                setOpen(false);
                router.push('/(auth)/sign-in');
              }}
            />
            <Button title="Close" variant="ghost" onPress={() => setOpen(false)} />
          </Sheet>
        ))}
    </>
  );
}

function PreferencesEditor({ profile: p, onClose }: { profile: Profile; onClose: () => void }) {
  const [interests, setInterests] = useState<Topic[]>(p.interests);
  const [city, setCity] = useState(p.city);
  const [history, setHistory] = useState(p.useSigningHistory !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const m = useCommand();
  async function save() {
    if (interests.length > 0 && interests.length < 3) {
      setError('Choose at least three interests, or clear them to explore all topics.');
      return;
    }
    if (city.trim().length < 2) {
      setError('Choose a city and state.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      if (
        city !== p.city ||
        topics.some((t) => interests.includes(t) !== p.interests.includes(t))
      ) {
        await m.mutateAsync({ type: 'onboard', interests, city });
      }
      if (history !== (p.useSigningHistory !== false)) {
        await m.mutateAsync({
          type: 'profile',
          name: p.name,
          bio: p.bio ?? '',
          useSigningHistory: history,
        });
      }
      toast('Algorithm preferences saved.');
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not save all preferences. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Sheet visible onClose={onClose} locked={saving}>
      <View style={{ gap: 16 }}>
        <Text accessibilityRole="header" style={[styles.title, { fontSize: 24, lineHeight: 29 }]}>
          Algorithm preferences
        </Text>
        <Text style={styles.muted}>
          Choose what helps shape your recommendations. These settings are shared across the app.
        </Text>
        <View pointerEvents={saving ? 'none' : 'auto'} style={{ gap: 16 }}>
          <Text style={styles.label}>Your interests</Text>
          <Text style={styles.small}>Choose at least three, or leave all topics unselected.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {topics.map((topic) => (
              <PillChip
                key={topic}
                label={topic}
                selected={interests.includes(topic)}
                onPress={() =>
                  setInterests((current) =>
                    current.includes(topic)
                      ? current.filter((t) => t !== topic)
                      : [...current, topic],
                  )
                }
              />
            ))}
          </View>
          <Button
            title="Clear interests"
            variant="ghost"
            disabled={saving}
            onPress={() => setInterests([])}
          />
          <CityField label="Recommendation location" value={city} onChange={setCity} />
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Personalize using my activity"
            accessibilityState={{ checked: history, disabled: saving }}
            disabled={saving}
            onPress={() => setHistory((current) => !current)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>
                Personalize using my activity
              </Text>
              <Text style={styles.small}>
                Use signing, saving, swiping and reading to tailor petitions.
              </Text>
            </View>
            <Switch on={history} />
          </Pressable>
        </View>
        <Text style={styles.micro}>
          Petition ranking also considers joined communities, freshness and community backing.
          Community recommendations prioritize your interests and city. Activity personalization
          affects petitions only. Only your city and state are saved.
        </Text>
        {!!error && <Notice error text={error} />}
        <Button
          title={saving ? 'Saving preferences…' : 'Save preferences'}
          disabled={saving}
          onPress={() => void save()}
        />
        <Button title="Cancel" variant="ghost" disabled={saving} onPress={onClose} />
      </View>
    </Sheet>
  );
}
