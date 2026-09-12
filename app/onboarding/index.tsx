import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Topic, topics } from '../../src/domain/model';
import { useCommand, useSnapshot } from '../../src/data/provider';
import { Button, Chip, Field, Notice, Page, Panel, styles } from '../../src/components/ui';
export default function Onboarding() {
  const q = useSnapshot();
  const command = useCommand();
  const [selected, setSelected] = useState<Topic[]>(q.data?.profile?.interests ?? []);
  const [city, setCity] = useState(q.data?.profile?.city ?? 'Riverton, CA');
  function complete(skip = false) {
    command.mutate(
      { type: 'onboard', city, interests: skip ? [] : selected },
      { onSuccess: () => router.replace('/(tabs)') },
    );
  }
  return (
    <Page
      title="What matters to you?"
      subtitle="A few choices help us find your corner of the community."
      eyebrow="MAKE YOURSELF AT HOME"
    >
      <Panel>
        <Text style={styles.h2}>Choose at least three interests</Text>
        <View style={styles.row}>
          {topics.map((t) => (
            <Chip
              key={t}
              label={t}
              selected={selected.includes(t)}
              onPress={() =>
                setSelected(
                  selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t],
                )
              }
            />
          ))}
        </View>
        <Field label="Approximate city and state" value={city} onChangeText={setCity} />
        <Notice text="City-level matching only. We never need your street address, GPS location, or political affiliation to personalize your feed." />
        <Button
          title="Find my community"
          disabled={selected.length < 3 || command.isPending}
          onPress={() => complete()}
        />
        <Button
          title="Skip interests for now"
          variant="ghost"
          disabled={command.isPending}
          onPress={() => complete(true)}
        />
        {command.error && <Notice error text={command.error.message} />}
      </Panel>
    </Page>
  );
}
