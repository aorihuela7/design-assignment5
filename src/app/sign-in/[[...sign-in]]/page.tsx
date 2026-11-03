import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";
import { AuthLayout } from "@/components/AuthLayout";

export const metadata: Metadata = { title: "Sign in" };

// Clerk's form reads the address and loads in the browser; until then, say what's coming.
const loading = <p role="status" className="text-muted">Loading sign-in…</p>;

// A catch-all route, so Clerk's later steps (like the email code) stay on this page.
export default function SignInPage() {
  return (
    <AuthLayout title="Sign in">
      <Suspense fallback={loading}>
        <SignIn fallback={loading} />
      </Suspense>
    </AuthLayout>
  );
}
