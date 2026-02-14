import ClearcutSessionApp from '../../components/ui/ClearcutSessionApp';

export default async function ClearCutEditSessionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ClearcutSessionApp token={token} mode="edit" />;
}
