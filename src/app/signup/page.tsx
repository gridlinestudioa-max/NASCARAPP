import Link from "next/link";
import Card from "@/components/ui/Card";
import SignupForm from "./SignupForm";

export default function SignupPage() {
  return (
    <main>
      <h1>Create your account</h1>
      <Card>
        <SignupForm />
        <p style={{ marginTop: "var(--space-4)" }}>
          Already have an account? <Link href="/login">Sign in</Link>.
        </p>
      </Card>
    </main>
  );
}
