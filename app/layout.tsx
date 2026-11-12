import type { Metadata, Viewport } from "next";
import { Anton, Poppins } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import FooterGate from "@/components/FooterGate";
import CompanyHeader from "@/components/CompanyHeader";
import SwRegister from "@/components/SwRegister";
import InstallPrompt from "@/components/InstallPrompt";
import ArrivalPrompt from "@/components/ArrivalPrompt";
import ForcePasswordChange from "@/components/ForcePasswordChange";
import WinPrompt from "@/components/captain/WinPrompt";
import ThankYouPrompt from "@/components/ThankYouPrompt";
import AdPopup from "@/components/ads/AdPopup";
import VisitTracker from "@/components/VisitTracker";
import { LangSync } from "@/components/HeaderToggles";
import PageTranslator from "@/components/PageTranslator";
import ConfirmHost from "@/components/ConfirmHost";
import LoginSplash from "@/components/LoginSplash";
import CallHost from "@/components/chat/CallHost";
import ChatPopup from "@/components/chat/ChatPopup";

// the tall bold letters of the Home banner heading (components/DeskHero.tsx)
const anton = Anton({ variable: "--font-anton", subsets: ["latin"], weight: "400" });
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Unique Futsal",
  description: "Book courts, find opponents and earn rewards at Unique Futsal.",
  appleWebApp: { capable: true, title: "Unique Futsal", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // the light blue of the phone top bars
  themeColor: "#e4efff", // the light blue of the top bars: the browser toolbar and the Android status bar take it (dark icons)
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${poppins.variable} ${anton.variable} h-full antialiased`}>
      <head>
        {/* apply the saved light/dark choice before the first paint, so there is no flash */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("uf-theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}` }} />
      </head>
      <body className="min-h-full">
        <LoginSplash />
        <LangSync />
        <PageTranslator />
        <ConfirmHost />
        <CompanyHeader />
        <main className="mx-auto w-full max-w-md px-5 pb-6 pt-5 min-h-[60vh] tab:max-w-3xl tab:px-8 desk:max-w-[1320px] desk:px-10 desk:pb-8 desk:pt-8">{children}</main>
        <FooterGate />
        <BottomNav />
        <CallHost />
        <ChatPopup />
        <SwRegister />
        <InstallPrompt />
        <ArrivalPrompt />
        <ForcePasswordChange />
        <WinPrompt />
        <ThankYouPrompt />
        <AdPopup />
        <VisitTracker />
      </body>
    </html>
  );
}
