import { Text, View } from 'react-native';
import { isDemo } from '../data/provider';
import { colors, fonts } from './theme';

/**
 * Text people read about the beta. Sign-in is a Clerk development instance on a vercel.app
 * address, capped at 100 accounts that cannot move to the production instance later.
 */
export const betaNotice =
  'Public beta: open to the first 100 accounts. Accounts may need to sign up again when the full version launches.';

/** "Swipe4Change", with a Beta pill in the live app (the demo is labelled fictional instead). */
export function Wordmark({ size, color = colors.ink }: { size: number; color?: string }) {
  return (
    <View
      accessibilityRole="header"
      accessibilityLabel={isDemo ? 'Swipe4Change' : 'Swipe4Change, public beta'}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <Text style={{ fontFamily: fonts.display, fontSize: size, color }}>Swipe4Change</Text>
      {!isDemo && (
        <View
          style={{
            backgroundColor: colors.pale,
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 11,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: colors.accent,
            }}
          >
            Beta
          </Text>
        </View>
      )}
    </View>
  );
}
