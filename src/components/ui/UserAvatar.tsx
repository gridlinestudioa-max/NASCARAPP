import styles from "./UserAvatar.module.css";

// Small avatar shown next to a member's name anywhere a league lists its
// players — falls back to an initial-letter tile, same treatment as the
// league/app icon avatars elsewhere in the app.
export default function UserAvatar({
  name,
  avatarUrl,
  size = "sm",
}: {
  name: string;
  avatarUrl: string | null | undefined;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "md" ? styles.md : styles.sm;
  return (
    <span className={`${styles.avatar} ${sizeClass}`}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary uploaded Vercel Blob URL, not a static/local asset
        <img src={avatarUrl} alt="" className={styles.img} />
      ) : (
        (name.charAt(0) || "?").toUpperCase()
      )}
    </span>
  );
}
