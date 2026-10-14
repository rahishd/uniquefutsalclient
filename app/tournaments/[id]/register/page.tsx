import RegisterPage from "@/components/tournament/RegisterPage";

// The shareable team-registration link of one tournament: /tournaments/<id>/register
export default async function Page({ params }: PageProps<"/tournaments/[id]/register">) {
  const { id } = await params;
  return <RegisterPage id={id} />;
}
