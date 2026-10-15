import DealPage from "@/components/findplayer/DealPage";

// The deal behind a "players needed" notification: /find-player/<id>
export default async function Page({ params }: PageProps<"/find-player/[id]">) {
  const { id } = await params;
  return <DealPage id={id} />;
}
