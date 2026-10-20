import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import FooterGate from "@/components/FooterGate";
import CompanyHeader from "@/components/CompanyHeader";
import SwRegister from "@/components/SwRegister";
import InstallPrompt from "@/components/InstallPrompt";
import ArrivalPrompt from "@/components/ArrivalPrompt";
import ForcePasswordChange from "@/components/ForcePasswordChange";
import WinPrompt from "@/components/captain/WinPrompt";
import AdPopup from "@/components/ads/AdPopup";
import VisitTracker from "@/components/VisitTracker";
import { LangSync } from "@/components/HeaderToggles";
import PageTranslator from "@/components/PageTranslator";
import ConfirmHost from "@/components/ConfirmHost";
import LoginSplash from "@/components/LoginSplash";
import BackToTop from "@/components/BackToTop";
import CallHost from "@/components/chat/CallHost";
import ChatPopup from "@/components/chat/ChatPopup";

const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Unique Futsal",
  description: "Book courts, find opponents and earn rewards at Unique Futsal.",
  appleWebApp: { capable: true, title: "Unique Futsal", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  // navy like the home header, so the phone's status bar strip above it is not white
  themeColor: "#0c0b5d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${poppins.variable} h-full antialiased`}>
      <head>
        {/* apply the saved light/dark choice before the first paint, so there is no flash */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("uf-theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}` }} />
      </head>
      <body className="min-h-full">
        {/* iPhone home-screen app: the status bar is see-through, so this navy strip (as tall as the status bar, nothing in a normal browser) sits behind the clock on every page */}
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[200] bg-[#0c0b5d]" style={{ height: "env(safe-area-inset-top)" }} />
        <LoginSplash />
        <LangSync />
        <PageTranslator />
        <ConfirmHost />
        <CompanyHeader />
        <main className="mx-auto w-full max-w-md px-5 pb-6 pt-5 min-h-[60vh] tab:max-w-3xl tab:px-8 desk:max-w-none desk:px-10 desk:pb-8 desk:pt-8">{children}</main>
        <FooterGate />
        <BottomNav />
        <BackToTop />
        <CallHost />
        <ChatPopup />
        <SwRegister />
        <InstallPrompt />
        <ArrivalPrompt />
        <ForcePasswordChange />
        <WinPrompt />
        <AdPopup />
        <VisitTracker />
      </body>
    </html>
  );
}
