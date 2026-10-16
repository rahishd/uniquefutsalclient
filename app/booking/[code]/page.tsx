import BookingDetail from "@/components/booking/BookingDetail";

export default async function Page({ params }: PageProps<"/booking/[code]">) {
  const { code } = await params;
  return <BookingDetail code={decodeURIComponent(code)} />;
}
