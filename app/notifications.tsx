import { useSnapshot } from '../src/data/provider';
import { Entries } from '../src/components/entries';
import { Loading, Notice, Page } from '../src/components/ui';
export default function Notifications() {
  const q = useSnapshot();
  if (q.isPending) return <Loading />;
  return (
    <Page
      back
      title="Your community, keeping you posted."
      subtitle="Signature confirmations and important changes."
    >
      <Notice text="These are in-app notifications. Push notifications and daily digests are not enabled in this competition demo." />
      {q.error ? (
        <Notice error text={q.error.message} />
      ) : (
        <Entries entries={q.data?.notifications ?? []} empty="You’re all caught up" />
      )}
    </Page>
  );
}
