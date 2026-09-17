import Link from "next/link";
import SignupForm from "./SignupForm";

export default function SignupPage() {
  return (
    <main>
      <h1>Create your account</h1>
      <SignupForm />
      <p>
        Already have an account? <Link href="/login">Sign in</Link>.
      </p>
    </main>
  );
}
