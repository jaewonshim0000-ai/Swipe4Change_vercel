import { useState } from 'react';
import { Text, View } from 'react-native';
import { topics } from '../src/domain/model';
import { levelLabels, recipientDirectory } from '../src/domain/recipients';
import { Chip, Icon, Notice, Page, Panel, colors, styles } from '../src/components/ui';

/**
 * Who actually decides this?
 *
 * Sending a request to the wrong office is the most common way a real petition dies quietly, and
 * almost nobody knows off-hand that a crosswalk is Public Works rather than the mayor. The
 * "cannot decide" half of each entry is the part people get wrong, so it is given equal weight.
 */
export default function Recipients() {
  const [topic, setTopic] = useState('All topics');
  const offices = recipientDirectory.filter(
    (o) => topic === 'All topics' || o.topics.includes(topic as (typeof topics)[number]),
  );
  return (
    <Page
      back
      title="Who can actually decide this?"
      subtitle="Knowing which office controls a change is most of the work. Pick a topic to see who handles it, what they can do, and roughly how long they take."
      eyebrow="RECIPIENT DIRECTORY"
    >
      <Notice text="Every office listed here is fictional, invented for this demo. A real deployment would load its own town's directory, and response times would come from that jurisdiction's published service standards rather than from an app's estimate." />
      <View style={styles.row}>
        {['All topics', ...topics].map((t) => (
          <Chip key={t} label={t} selected={topic === t} onPress={() => setTopic(t)} />
        ))}
      </View>
      {offices.map((o) => (
        <Panel key={o.id}>
          <View style={styles.between}>
            <Text accessibilityRole="header" style={styles.h3}>
              {o.name}
            </Text>
            <Chip label={levelLabels[o.level]} />
          </View>
          <Text style={styles.small}>
            Usually publishes a response in about {o.responseDays} days · {o.topics.join(' · ')}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.label}>CAN DECIDE</Text>
          {o.controls.map((c) => (
            <View key={c} style={[styles.row, { gap: 8, flexWrap: 'nowrap' }]}>
              <Icon name="checkmark" size={14} color={colors.accent} />
              <Text style={[styles.body, { flexShrink: 1 }]}>{c}</Text>
            </View>
          ))}
          <Text style={styles.label}>CANNOT DECIDE</Text>
          <View style={[styles.row, { gap: 8, flexWrap: 'nowrap' }]}>
            <Icon name="close" size={14} color={colors.error} />
            <Text style={[styles.body, { flexShrink: 1 }]}>{o.notResponsibleFor}</Text>
          </View>
        </Panel>
      ))}
    </Page>
  );
}
