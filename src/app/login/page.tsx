import Link from "next/link";
import Card from "@/components/ui/Card";
import LoginForm from "./LoginForm";

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const claimed = searchParams.claimed === "1";

  return (
    <main>
      <h1>Sign in</h1>
      <Card>
        {claimed && <p style={{ marginBottom: "var(--space-3)" }}>Account claimed — sign in below.</p>}
        <LoginForm />
        <p style={{ marginTop: "var(--space-4)" }}>
          New here? <Link href="/signup">Create an account</Link>.
        </p>
        <p>
          Have a pre-2026 account to claim instead? <Link href="/claim">Claim it here</Link>.
        </p>
      </Card>
    </main>
  );
}
