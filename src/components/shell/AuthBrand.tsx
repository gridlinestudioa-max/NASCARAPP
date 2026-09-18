import styles from "./AuthBrand.module.css";

export default function AuthBrand() {
  return (
    <div className={styles.brand}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 3v18M4 4h12l-2.5 3L16 10H4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      Fantasy NASCAR HQ
    </div>
  );
}
