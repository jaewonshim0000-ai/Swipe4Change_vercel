import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Empty, Page, styles } from '../src/components/ui';

/** Any address the app does not know, instead of Expo Router's developer screen. */
export default function NotFound() {
  return (
    <Page title="Page not found">
      <Empty
        title="Nothing lives at this address"
        body="The link may be mistyped, or the petition may have been archived or taken down."
      />
      <View style={styles.row}>
        <Button title="Go to your feed" onPress={() => router.replace('/(tabs)')} />
        <Button
          title="Explore petitions"
          variant="secondary"
          onPress={() => router.replace('/(tabs)/explore')}
        />
      </View>
    </Page>
  );
}
