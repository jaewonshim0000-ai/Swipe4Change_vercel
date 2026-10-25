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
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 24,
          width: '100%',
          maxWidth: 640,
          alignSelf: 'center',
        }}
      >
        <Text style={[styles.label, { textAlign: 'center' }]}>Small actions. Shared progress.</Text>
        <Text accessibilityRole="header" style={[styles.hero, { textAlign: 'center' }]}>
          What would you change{'\n'}about your community?
        </Text>
        <Text style={[styles.body, { textAlign: 'center' }]}>
          Find a petition you care about, or start one of your own. A safer crossing, a park worth
          looking after, or something your neighborhood needs.
        </Text>
        {['Find what moves you.', 'Make your voice count.', 'Follow the next step.'].map(
          (text, index) => (
            <Text key={text} style={[styles.h3, { textAlign: 'center' }]}>
              {index + 1}. {text}
            </Text>
          ),
        )}
        <Button title="Find your next cause" onPress={onContinue} />
        <Text style={[styles.small, { textAlign: 'center' }]}>
          You can look around before signing up.
        </Text>
      </View>
    </ScrollView>
  );
}
