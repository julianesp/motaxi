"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function SSOComplete() {
  const { user: clerkUser, isLoaded } = useUser();
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (!isLoaded || done.current) return;
    if (!clerkUser) {
      router.push("/");
      return;
    }

    done.current = true;

    const sync = async () => {
      try {
        const email = clerkUser.primaryEmailAddress?.emailAddress;
        const name =
          clerkUser.fullName ||
          clerkUser.firstName ||
          email?.split("@")[0] ||
          "Usuario";
        const googleAccount = clerkUser.externalAccounts?.find(
          (a) => a.provider === "google"
        ) as any;
        const googleId = googleAccount?.externalId || googleAccount?.id || clerkUser.id;

        if (!email) {
          router.push("/");
          return;
        }

        const API_URL =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

        const res = await fetch(`${API_URL}/auth/google-clerk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, name, googleId }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            document.cookie = `authToken=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}`;
          }
          // Si es usuario nuevo, pedir teléfono antes de continuar
          if (data.isNewUser) {
            router.push("/auth/complete-profile");
          } else {
            router.push("/");
          }
        } else {
          router.push("/");
        }
      } catch (e) {
        console.error("SSO complete error:", e);
        router.push("/");
      }
    };

    sync();
  }, [isLoaded, clerkUser]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008000] mx-auto"></div>
        <p className="mt-4 text-white">Iniciando sesión...</p>
      </div>
    </div>
  );
}
