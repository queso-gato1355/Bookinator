# Bookinator frontend improvements

The Sea Library interface now centers on identifying a remembered book within the selected catalog.

1. **Focused home.** The primary action is Find my book. Collection choice, the active title count and the demo's scope appear before starting. A searchable catalog uses actual supported books and series volumes, replacing sample rankings, sample book recommendations and placeholder library programs.
2. **Compact questions.** Decorative photography and the disabled free-text search are removed. Five uncertainty-aware choices, Previous and Next fit the tested 390px mobile screen. Answer history is collapsible; editing rewinds to the selected answer and discards dependent later events. Keyboard shortcuts and heading focus remain available.
3. **Useful feedback.** Question counts are shown as answers completed rather than a misleading fixed completion percentage. A leading-match count summarizes the smallest set carrying 90% of current search weight, without eliminating other books or presenting that weight as accuracy. After an informative answer, readers can request a tentative best guess. Confirming, rejecting, undoing and resuming use the ordinary session engine; automatic matching thresholds are unchanged.
4. **Working controls.** Navigation includes Home, the supported shelf and starting a game. The mobile menu works with keyboard support. Placeholder login, library-card, program and saving controls are removed. The disabled runtime free-text search is removed rather than implying a chatbot exists.
5. **Recognition first.** Results and shortlists show title, author, edition-independent metadata and matching clues before secondary actions. Strong conflicting catalog labels can be inspected. Summaries come from the stored Wikipedia article and its Korean language link, with source attribution and correct language tags. Open Library descriptions without dependable language metadata are not displayed as English. Covers use IDs returned by a stored Open Library work record; readable title cards remain while covers load or fail. The production CSP permits the observed Internet Archive image redirect. External metadata failures never block play.
6. **Recover from a miss.** The mobile form's intrinsic-width overflow is fixed. A reader who does not know the title can download a local text file containing remembered scenes and game answers for a librarian. Catalog submissions retain their title requirement, optional author, duplicate checks and existing consent/CAPTCHA flow. A clue download is explicitly local and is never described as a successful server submission.

## Validation

- `npm run verify`: both TypeScript configurations, 92 application/data/engine tests, 21 database tests, 16 Python tests, 31 research tests, 8 research-tool tests, research demo checks, catalog validation and production build passed.
- Chromium, English and Korean: desktop 1440px, mobile 390px and narrow 320px layouts inspected; no horizontal overflow on the inspected screens.
- Exercised answer selection, next/back, early guess, rejection, history editing, reload/resume, no-match search, memory-only download and mobile menu/catalog navigation. The downloaded file contained the scene and recorded answer.
- Latest research catalog (388 targets covering 488 titles): replayed a valid Harry Potter game, confirmed the series and selected a volume.
- Actual English and Korean Wikipedia summaries and an Open Library cover loaded. Production rendering was checked separately from Vite development rendering.
- Existing large-catalog build warnings remain. No live Supabase submissions were made from this checkout; database behavior is covered by the existing database suite.
