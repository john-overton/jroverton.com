import ClearcutSessionApp from '../../components/ui/ClearcutSessionApp';

export default async function ClearCutReadonlySessionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ClearcutSessionApp token={token} mode="readonly" />;
}
