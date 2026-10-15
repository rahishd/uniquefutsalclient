import ThreadView from "@/components/chat/ThreadView";

export default async function Page({ params }: PageProps<"/chat/[id]">) {
  const { id } = await params;
  return <ThreadView id={id} />;
}
