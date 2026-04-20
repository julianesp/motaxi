"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallback() {
  return (
    <AuthenticateWithRedirectCallback
      signInFallbackRedirectUrl="/sso-callback/complete"
      signUpFallbackRedirectUrl="/sso-callback/complete"
      signInForceRedirectUrl="/sso-callback/complete"
      signUpForceRedirectUrl="/sso-callback/complete"
    />
  );
}
