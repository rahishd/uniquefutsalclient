import type { Viewport } from "next";
import HomeScreen from "@/components/HomeScreen";

// Home starts with the navy header, so the phone's status bar area takes that colour (the other pages are white). Without this the
// phone paints a white frosted layer over the navy header whenever you come back to Home.
export const viewport: Viewport = { themeColor: "#0c0b5d" };

export default function Home() {
  return <HomeScreen />;
}
