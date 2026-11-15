# Hackathon presentation and interaction improvements

The original Sea Library home, navigation, service tiles, leaderboard, collection cards, Programs and footer are retained. Catalog search is a separate screen behind the original Catalog navigation entry. The themed challenge home is limited to the explicit demo route; game changes do not replace the library layout.

- The homepage names **Library × Because I’m Lazy** and explains the forgotten-title problem. Its original Unsplash sea photograph is retained, including the photo and photographer links; the hero photo loads eagerly.
- Answers advance with one tap. Undo and answer-history editing remain available. Keyboard shortcuts are visible on desktop; held keys and the second click of a double-click do not submit additional answers.
- Book reveals use brief motion; confirmation celebrates the actual number of answered questions. Reduced-motion preferences disable the animation. Choosing a shortlist is labelled as identification rather than a successful guess.
- A library handoff prioritizes the configured library catalog, otherwise clearly opens Open Library editions. Copying title/author has a selectable-text fallback. Optional holdings checks remain conditional on real configuration and a verified ISBN, with English/Korean text.
- **Try the live challenge** opens the full 10-book classic catalog with a reproducible question-order seed. Three suggested titles are displayed without selection controls, so the game never receives the audience's target. Demo saves are isolated from normal games.
- [Presentation guide](hackathon-demo.md): a 90-second run of show, a short script, likely questions and a rehearsal checklist.
- [Generated rehearsal traces](demo-rehearsal.md): three real-engine six-answer examples and an early wrong-guess recovery in seven answers. These establish consistency with prototype labels, not factual accuracy or expected human performance. `npm run rehearse -- --write` regenerates the document.

Validation includes `npm run verify`, actual browser rounds for all three demo books and the wrong-guess path, one-tap/Undo/keyboard behavior, separate saved sessions, copy success and fallback, mobile layouts, English/Korean copy, and reduced motion. No runtime model calls, matching-threshold changes or invented availability are introduced.
