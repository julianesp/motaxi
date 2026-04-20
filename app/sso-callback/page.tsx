"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallback() {
  return (
    <AuthenticateWithRedirectCallback
      afterSignInUrl="/sso-callback/complete"
      afterSignUpUrl="/sso-callback/complete"
    />
  );
}
