// A minimal stand-in for the shadcn/animate-ui "cn" helper (normally
// clsx + tailwind-merge). This app has no Tailwind config, so there are
// no utility-class conflicts to resolve — a plain join covers every real
// call site (merging a caller-supplied className with a component's own).
// Typed `unknown` rather than `string | ...` because motion's
// SVGMotionProps["className"] admits a MotionValue<string> too; that
// case never occurs here in practice (nothing animates className), so it
// is simply filtered out rather than modeled.
export function cn(...inputs: unknown[]): string {
  return inputs.filter((v): v is string => typeof v === "string" && v.length > 0).join(" ");
}
