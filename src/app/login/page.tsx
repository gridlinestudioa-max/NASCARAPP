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
        Haven&apos;t claimed your account yet? <Link href="/claim">Claim it here</Link>.
      </p>
    </main>
  );
}
