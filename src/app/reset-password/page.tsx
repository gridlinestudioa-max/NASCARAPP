import Link from "next/link";
import Card from "@/components/ui/Card";
import AuthBrand from "@/components/shell/AuthBrand";
import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const searchParams = await props.searchParams;
  const token = typeof searchParams.token === "string" ? searchParams.token : "";

  return (
    <main>
      <AuthBrand />
      <h1 style={{ textAlign: "center" }}>Set a new password</h1>
      <Card>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <p role="alert">This reset link is missing its token — request a new one from the forgot password page.</p>
        )}
      </Card>
      <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        <Link href="/forgot-password">Request a new link</Link> · <Link href="/login">Back to sign in</Link>
      </p>
    </main>
  );
}
