"use client";

import { LanguageSwitch, useLocale } from "../locale";
import styles from "./hackathon.module.css";

export function HackathonHeader() {
  const { t } = useLocale();

  return (
    <header className={styles.header}>
      <a className={styles.brand} href="/hackathon" aria-label={t("NoteFlow Agent home", "NoteFlow Agent 首页")}>
        <span className={styles.brandMark}>N</span>
        <span>NoteFlow Agent</span>
      </a>
      <div className={styles.headerActions}>
        <div className={styles.category}>
          {t("Collaborative Partner · 2026 entry", "协作伙伴 · 2026 参赛作品")}
        </div>
        <LanguageSwitch className={styles.languageSwitch} />
        <a className={styles.learningLink} href="/demo">
          {t("Try the learning workspace", "体验学习空间")} <span aria-hidden="true">→</span>
        </a>
      </div>
    </header>
  );
}
