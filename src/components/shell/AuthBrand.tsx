import styles from "./AuthBrand.module.css";

// Both theme variants always render; CSS shows only the one matching the
// live data-theme (see AppShell.module.css's brandLogoDark/Light — same
// swap pattern, kept in sync here rather than shared since this is the
// only other place a themed brand asset appears).
export default function AuthBrand() {
  return (
    <div className={styles.brand}>
      {/* eslint-disable-next-line @next/next/no-img-element -- bundled brand asset, not photographic content next/image needs to optimize */}
      <img src="/brand/ftg-wordmark-dark.svg" alt="FindTheGroove" className={`${styles.wordmark} ${styles.dark}`} />
      {/* eslint-disable-next-line @next/next/no-img-element -- bundled brand asset, not photographic content next/image needs to optimize */}
      <img src="/brand/ftg-wordmark-light.svg" alt="FindTheGroove" className={`${styles.wordmark} ${styles.light}`} />
    </div>
  );
}
