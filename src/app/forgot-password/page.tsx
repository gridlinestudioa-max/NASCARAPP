import Link from "next/link";
import Card from "@/components/ui/Card";
import AuthBrand from "@/components/shell/AuthBrand";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main>
      <AuthBrand />
      <h1 style={{ textAlign: "center" }}>Reset your password</h1>
      <Card>
        <p style={{ marginBottom: "var(--space-3)" }}>
          Enter your username and, if there&apos;s an email on file for that account, we&apos;ll send a link to reset
          your password.
        </p>
        <ForgotPasswordForm />
      </Card>
      <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        <Link href="/login">Back to sign in</Link>
      </p>
    </main>
  );
}
