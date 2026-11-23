# 🔮 Arcana Coach — Tarot Reading Trainer PWA

An offline-first Progressive Web App (PWA) for practical tarot reading training—going beyond isolated card memorization to help you practice full card spreads, build cohesive narratives, and receive structured coaching feedback right in your browser.

---

## ✨ Features

### 🌐 Languages
- **Japanese by default, English available.** Switch with the 🌐 button in the header; the choice is saved on the device (`localStorage`). The coach feedback follows the selected language and understands readings written in either language.

### ① Guide (Input & Reference Mode)
- **Complete 78-Card Dictionary:** Browse and search all 22 Major Arcana and 56 Minor Arcana cards (Wands, Cups, Swords, Pentacles).
- **Detailed Card Profiles:** View upright and reversed meanings, core keywords, elemental associations, and visual symbolism.
- **Tarot Basics Primer:** Quick-reference overview covering arcana structure, suits, elements, and reading reversals.

### ② Quiz (Output & Recall Mode)
- **Single-Card Multiple Choice:** Draw a random upright or reversed card and test your recall against smart, orientation-matched decoys.
- **Instant Feedback & Mastery Tracking:** Get immediate `○ / ×` grading while `localStorage` tracks per-card accuracy and prioritizes cards you miss most often.

### ③ Expand (Practical Spreads & AI Reading Review)
- **Interactive Spread Layouts:** Shuffle and deal cards into **Three-Card** (Past / Present / Future), **Heart Sonar** (5-card romance spread), and **Celtic Cross** (10-card classic layout) formations.
- **Realistic Consultation Prompts:** Practice with built-in prompts across *Romance*, *Career*, and *Personal Growth*, or enter your own question.
- **Tap-to-Peek Assistance:** Tap any dealt card during a session to check its core keywords without losing your draft.
- **In-Browser AI Reading Coach:** Write your interpretation in your own words and receive structured feedback across three criteria:
  1. **Card & Position Alignment** — Checks whether your reading matches each card's upright/reversed meaning and its specific slot in the spread.
  2. **Narrative Cohesion** — Evaluates how smoothly you connect individual cards into a single answer to the question.
  3. **Professional Reader's Perspective** — Highlights cross-card patterns such as suit dominance, reversal ratios, Major Arcana density, and repeated numbers.

### 📖 Reading Journal & Portable Backup
- Every saved spread, written reading, and coach critique is stored privately on your device.
- **Zero-Database Portability:** Use **Export Backup (.json)** and **Import Backup (.json)** anytime to transfer your quiz progress and reading journal to another device.

---

## 📱 Install on Your Phone (100% Offline)

Once deployed to GitHub Pages, you can install Arcana Coach to your home screen so it launches full-screen like a native app and works in airplane mode:

- **Android (Chrome / Samsung Internet):**
  1. Open your live GitHub Pages URL.
  2. Tap **Install App** in the app header (or open the browser menu `⋮` → **Add to Home screen**).
- **iPhone / iPad (Safari):**
  1. Open your live GitHub Pages URL in **Safari**.
  2. Tap the **Share** button in the toolbar.
  3. Scroll down and tap **Add to Home Screen** (keep **Open as Web App** enabled), then tap **Add**.

---

## 🧱 Architecture & Tech Stack

- **Zero-Build Frontend:** Pure Vanilla HTML5, CSS3, and ES6+ JavaScript—no React, `npm`, bundlers, or external CDNs required.
- **Offline-First Service Worker (`sw.js`):** Pre-caches all HTML, CSS, JS, vector artwork, and card datasets on first load.
- **Client-Side Storage:** All 78 cards and spread layouts live in static local files (`data/`), while user progress and journal entries persist in `localStorage`.
- **Modular AI Engine (`engine.js`):**
  - *Phase 1:* Deterministic Tarot Rule & Pattern Engine for instant, offline concept matching and multi-card pattern analysis.
  - *Phase 2 Ready:* Isolated `evaluateReading()` interface designed to layer in client-side `Transformers.js` semantic similarity embeddings without changing the UI.

---

## 🚀 Deploy on GitHub Pages

1. Push this repository to a **Public** GitHub repository.
2. Open your repository on GitHub and go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Select branch **`main`** and folder **`/ (root)`**, then click **Save**.
5. Your PWA will go live at `https://<your-username>.github.io/<repo-name>/`.

---

## 📂 Project Structure

```text
├── index.html          # App shell, bottom navigation, and install modal
├── styles.css          # Mobile-first mystical dark theme & card flip animations
├── app.js              # UI state, SVG card renderer, quiz logic, and JSON backup
├── art.js              # Original line-art symbols for the Major Arcana, drawn in code
├── i18n.js             # Language state (default Japanese), UI strings & localized data accessors
├── engine.js           # In-browser AI Reading Coach & cross-card pattern detector (ja/en)
├── manifest.json       # Standalone PWA manifest
├── sw.js               # Cache-first Service Worker for offline execution
├── CLAUDE.md           # Project architecture rules & AI development guide
├── data/
│   ├── cards.js        # Complete 78-card dataset with upright/reversed concept tags (English)
│   ├── cards.ja.js     # Japanese text for the same 78 cards
│   └── spreads.js      # Three-Card, Heart Sonar, Celtic Cross & prompt bank (English + Japanese)
└── icons/
    └── icon.svg        # Vector home-screen app icon
