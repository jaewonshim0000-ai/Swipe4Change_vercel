import { ScrollView, Text, View } from 'react-native';
import { Button } from './ui';
import { colors, styles } from './theme';
import { Wordmark } from './wordmark';
export function Intro({ onContinue }: { onContinue: () => void }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 64, gap: 32 }}
    >
      <Wordmark size={27} />
      <View style={{ flex: 1, justifyContent: 'center', gap: 24 }}>
        <Text style={styles.label}>Small actions. Shared progress.</Text>
        <Text accessibilityRole="header" style={styles.hero}>
          A little swipe.{'\n'}A bigger change.
        </Text>
        <Text style={styles.body}>
          Discover petitions that matter to you, find your people, and help move your community
          forward.
        </Text>
        {['Find what moves you.', 'Make your voice count.', 'Follow the next step.'].map(
          (text, index) => (
            <Text key={text} style={styles.h3}>
              {index + 1}. {text}
            </Text>
          ),
        )}
        <Button title="Find your next cause" onPress={onContinue} />
        <Text style={styles.small}>Start with curiosity. Browse freely.</Text>
      </View>
    </ScrollView>
  );
}
