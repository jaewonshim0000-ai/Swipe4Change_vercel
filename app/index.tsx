import { Redirect } from 'expo-router';
import { isDemo, useBackend, useSnapshot } from '../src/data/provider';
import { Button, Loading, Notice, Page } from '../src/components/ui';
export default function Index() {
  const { sessionKey } = useBackend();
  const q = useSnapshot();
  // Guests land directly in discovery without waiting for a profile request.
  if (!isDemo && sessionKey === 'guest') return <Redirect href="/(tabs)" />;
  if (q.isPending) return <Loading />;
  if (q.error)
    return (
      <Page>
        <Notice error text={q.error.message} />
        <Button
          title="Try again"
          onPress={() => {
            void q.refetch();
          }}
        />
      </Page>
    );
  return (
    <Redirect
      href={!q.data.profile ? '/(tabs)' : !q.data.profile.onboarded ? '/onboarding' : '/(tabs)'}
    />
  );
}
