"use client";

/**
 * Runs directly after a Google login and cannot be dismissed:
 *   1. pick storage (our server / their own Supabase)
 *   2. when "own": URL + publishable/anon key of THEIR project (required)
 *   3. model API key (required) — this is what removes demo mode for good
 *
 * Rendered next to <AccountLayer/> in the page. Nothing renders while a guest.
 */

import { useOffice } from "@/lib/store";
import { OnboardingWizard } from "./OnboardingWizard";

/** marks the account as configured so the wizard does not return on reload */
function completeSetup() {
  const office = useOffice.getState();
  if (office.account) office.setAccount({ ...office.account, setupComplete: true });
  try {
    localStorage.setItem("kantor-orcai:setup-done", "1");
  } catch {
    /* private mode — the in-memory flag still covers this session */
  }
}

export function OnboardingGate() {
  const account = useOffice((s) => s.account);
  if (!account) return null;
  if (account.setupComplete) return null;
  return <OnboardingWizard onDone={completeSetup} />;
}
