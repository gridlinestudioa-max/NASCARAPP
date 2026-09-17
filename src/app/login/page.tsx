import Link from "next/link";
import LoginForm from "./LoginForm";

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const claimed = searchParams.claimed === "1";

  return (
    <main>
      <h1>Sign in</h1>
      {claimed && <p>Account claimed — sign in below.</p>}
      <LoginForm />
      <p>
        New here? <Link href="/signup">Create an account</Link>.
      </p>
      <p>
        Have a pre-2026 account to claim instead? <Link href="/claim">Claim it here</Link>.
      </p>
    </main>
  );
}
