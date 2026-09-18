import Link from "next/link";
import Card from "@/components/ui/Card";
import AuthBrand from "@/components/shell/AuthBrand";
import LoginForm from "./LoginForm";

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const claimed = searchParams.claimed === "1";

  return (
    <main>
      <AuthBrand />
      <h1 style={{ textAlign: "center" }}>Welcome back</h1>
      <Card>
        {claimed && <p style={{ marginBottom: "var(--space-3)" }}>Account claimed — sign in below.</p>}
        <LoginForm />
      </Card>
      <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        New here? <Link href="/signup">Create an account</Link> ·{" "}
        <Link href="/claim">Claim a pre-2026 account</Link>
      </p>
    </main>
  );
}
