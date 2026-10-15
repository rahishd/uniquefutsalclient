import JoinGroup from "@/components/chat/JoinGroup";

// The invite link of a group: /chat/join/<code>
export default async function Page({ params }: PageProps<"/chat/join/[code]">) {
  const { code } = await params;
  return <JoinGroup code={code} />;
}
