# Bookinator hackathon demo

**Theme: Library × Because I’m Lazy**

**One sentence:** You remember the story. Bookinator chooses the search questions and helps you find the book.

## Open the live challenge

Use the deployed app’s **Try the live challenge** link, or add `?collection=classic&demo=1` to its URL. This keeps the existing deployment path intact and opens the challenge instructions.

The audience chooses Harry Potter and the Philosopher’s Stone, The Hobbit, or Murder on the Orient Express **in secret**. The app never asks which one they chose. It searches all 10 classic books using the normal engine. Only the question-order seed is fixed for rehearsal. The regular game still varies question order and supports the larger research collection.

## A 90-second presentation

| Time | Action |
| --- | --- |
| 0–15 seconds | Explain the forgotten-title problem and the chosen keyword. |
| 15–45 seconds | Invite someone to choose a book privately and tap the answers themselves. |
| 45–60 seconds | Reveal the book, confirm it, and point to the matching clues and actual answer count. |
| 60–75 seconds | Open the library next step or copy the title and author for a catalog search. |
| 75–90 seconds | Explain the question selection and close with the product’s promise. |

The timing is a rehearsal target, not a claim about how long everyone’s game takes. If the reader is unsure, let them use Not sure. If the round runs longer, show the current best guess and explain its tentative status.

## Spoken script

“Remember a scene from a book, but not the title? Searching means guessing the right words. We chose Library with ‘Because I’m Lazy’: let the app choose what to ask.

“Pick one of these books without telling me. Tap what you remember. You can undo a mistake.”

**Let the volunteer answer. Do not tell them the rehearsal answers.**

“Was this your book? Here are the matching clues and the actual question count.

“Now find editions on Open Library, or copy the title and author into your library’s catalog.

“The questions and matching run in your browser. ‘Not sure’ keeps every book possible, and a wrong guess leads to more questions.

“Remember the story. We’ll handle the search.”

## Show recovery honestly

Use the generated [rehearsal traces](demo-rehearsal.md) for a separate practice round. With Murder on the Orient Express in mind, answer the first question, then request an early guess. The current rehearsal produces a different title. Reject that guess and continue answering to show ordinary recovery.

During a live audience round, accept a correct book. If a real guess misses, say: “That was an early guess. Let’s keep looking.” If someone realizes they misremembered a detail, use Undo or edit an earlier answer; subsequent dependent answers are cleared.

## Rehearse before presenting

1. Run `npm ci` and `npm run verify`.
2. Run `npm run rehearse` to inspect the current traces. Run `npm run rehearse -- --write` to regenerate the committed trace document after engine/catalog changes. These use the prototype’s labels, so check the wording against your own reading.
3. Play each of the three examples with the actual buttons. Try one keyboard round (`1`–`5`, `U`) and one phone round.
4. Practice the early wrong-guess path, Undo, reload/resume and a miss outside the supported collection.
5. Open the original Unsplash photo, a summary and an Open Library record on the presentation network. External images and summaries can fail; readable title cards and the game remain usable.
6. For a specific library, set a **verified** `VITE_LOCAL_LIBRARY_SEARCH_URL` with `{query}`. Holdings checks also need the existing proxy, library code and name. Test a known edition in that library before showing availability. The default Open Library action makes no availability promise.
7. Keep the app open before speaking. Matching works locally after the app loads; loading the page, fetching images/summaries and following external catalog links need network access. `npm run build` plus `npm run preview -- --host 0.0.0.0` provides a local presentation server.

## Short answers to likely questions

**“How is this different from a title search?”** You can start without the title, author or a useful search phrase. The app chooses questions about remembered details.

**“Is it calling a chatbot?”** No language model runs during the game. It uses local Bayesian matching and question selection. AI-labelled catalog data is visibly marked; agreement between labels is not measured factual accuracy.

**“Can it find every book?”** It searches the selected collection. Counts come from the active catalog. For an unsupported book, readers can save their clues or request a title for review.

**“Does this guarantee my library has it?”** No. A catalog record identifies a work. Actual availability depends on the library, edition and freshness of its data. The optional availability check labels its source and check time.

**“What happens to my answers?”** Playing and the clue download work locally. Sending game answers is a separate opt-in action at the end.

## What to make visible to voters

- **Idea:** a forgotten-title search that starts with a memory.
- **Technical achievement:** adaptive questions, neutral uncertainty, explainable clues and exact Undo.
- **Design:** one-tap answers, the original sea photograph, an accessible reveal and an obvious library next step.
- **Presentation:** a volunteer operates the real game and confirms the result.
- **Practical use:** the recovered title becomes a catalog search or a set of clues a librarian can use.
