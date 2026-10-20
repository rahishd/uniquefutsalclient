"use client";

import Splash from "@/components/Splash";
import { useLoginSplash } from "@/lib/splash";

// Shows the splash screen only right after a sign-in. Opening the site, refreshing or opening a new tab or window shows nothing.
export default function LoginSplash() {
  return useLoginSplash() ? <Splash /> : null;
}
