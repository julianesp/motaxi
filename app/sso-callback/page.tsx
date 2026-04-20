"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallback() {
  return (
    <AuthenticateWithRedirectCallback
      fallbackRedirectUrl="/sso-callback/complete"
      forceRedirectUrl="/sso-callback/complete"
    />
  );
}
