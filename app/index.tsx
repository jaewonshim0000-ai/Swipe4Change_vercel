import { Redirect } from 'expo-router';
import { useSnapshot } from '../src/data/provider';
import { Button, Loading, Notice, Page } from '../src/components/ui';
export default function Index() {
  const q = useSnapshot();
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
      href={
        !q.data.profile ? '/(auth)/sign-in' : !q.data.profile.onboarded ? '/onboarding' : '/(tabs)'
      }
    />
  );
}
