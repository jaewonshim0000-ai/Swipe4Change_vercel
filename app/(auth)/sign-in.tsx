import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Icon, Notice, Page, Panel, colors, fonts, styles } from '../../src/components/ui';
import { ClerkLogin } from '../../src/components/clerk-login';
import { isDemo, useBackend, useSnapshot } from '../../src/data/provider';
import { demoIds } from '../../src/data/seed';
export default function SignIn() {
  const { adapter } = useBackend();
  const client = useQueryClient();
  const q = useSnapshot();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function login(id: string) {
    setPending(true);
    try {
      await adapter.signIn(id);
      await client.invalidateQueries({ queryKey: ['snapshot'] });
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in.');
    } finally {
      setPending(false);
    }
  }
  return (
    <Page>
      <View
        style={{ maxWidth: 800, width: '100%', alignSelf: 'center', gap: 28, paddingVertical: 32 }}
      >
        <Text style={styles.label}>NOTICE SOMETHING. CHANGE SOMETHING.</Text>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: 52,
            lineHeight: 58,
            fontFamily: fonts.display,
            letterSpacing: -2,
            color: colors.ink,
          }}
        >
          A better place starts{'\n'}with a little awareness.
        </Text>
        <Text style={[styles.body, { maxWidth: 580, fontSize: 19, lineHeight: 29 }]}>
          Discover what matters nearby. Add your voice. Turn a shared concern into a clear next
          step.
        </Text>
        <Panel>
          <View style={styles.row}>
            <Icon name="finger-print-outline" size={32} />
            <Text style={styles.h2}>
              {isDemo ? 'Step into the neighborhood' : 'Welcome to Swipe4Change'}
            </Text>
          </View>
          <Text style={styles.muted}>
            {isDemo
              ? 'Choose a fictional account. Your demo changes stay on this device. No password or personal information is needed.'
              : 'Sign in with Clerk to keep your voice and your account secure.'}
          </Text>
          {isDemo ? (
            <>
              <Button
                title="Continue as Maya · student organizer"
                disabled={pending}
                onPress={() => {
                  void login(demoIds.maya);
                }}
              />
              <Button
                title="Continue as Sam · approved local resident"
                variant="secondary"
                disabled={pending}
                onPress={() => {
                  void login(demoIds.sam);
                }}
              />
              <Button
                title="Continue as Jordan · new community member"
                variant="secondary"
                disabled={pending}
                onPress={() => {
                  void login(demoIds.jordan);
                }}
              />
              <Button
                title="Explore first"
                variant="ghost"
                onPress={() => router.replace('/(tabs)')}
              />
            </>
          ) : q.data?.profile ? (
            <Button title="Continue to your feed" onPress={() => router.replace('/')} />
          ) : (
            <ClerkLogin />
          )}
          {!!error && <Notice error text={error} />}
        </Panel>
        <View style={styles.row}>
          {['Privacy is a choice', 'Ranking you can understand', 'No political profiling'].map(
            (t) => (
              <View key={t} style={styles.row}>
                <Icon name="checkmark-circle-outline" size={18} />
                <Text style={styles.muted}>{t}</Text>
              </View>
            ),
          )}
        </View>
      </View>
    </Page>
  );
}
