# Contributing to the Guide to Trust

The guide is the site we host at **trust.hitchhikers.earth** for the Hitchhikers' nights. Each partner project already
has a place in it. Here is where yours is, and how to make it say what you want.

## The flow: fork, improve, verify back

1. **Fork** this repo.
2. **Improve** your project's entries (below). Keep the change to your own entries, and run it locally to see it:
   `cd site && node serve.mjs`, then open http://localhost:8788/guide/?path=iiw
3. **Verify back**: open a pull request saying which scenes you changed and why. We review it, check it fits the style
   and stays true (see *What we check*), and merge it. Merged changes go on trust.hitchhikers.earth for the event.

Everything you'll touch is in one file, `site/public/guide/index.html`, as small lists of text. Search for the names
below; no build step.

## Where each project lives

| Project | Where it appears | What to search for |
|---|---|---|
| **Bonfires** | *A community and their towels* (the ring card) · *Three different graphs* (the knowledge row) · *How the pieces fit* | `{name: 'Bonfires'` · `const GR =` · `const BUILT =` |
| **Chathackers** | the ring card · *Four principles* (the Chat first card) · *How the pieces fit* | `{name: 'Chathackers'` · `{name: 'Chat', card:` · `const BUILT =` |
| **The local co-op** | the ring card · *Four principles* (the Local first card) · *How the pieces fit* | `{name: 'The local co-op'` · `{name: 'Local', card:` · `const BUILT =` |
| **Field Guide** | *Every place unlocks the next chapter* · *What a community owns first* · *Connected cities* (the guide walked through the city) · *How the pieces fit* | `data-sec="Field Guide"` · `data-sec="The guide"` · `WALK_TXT = [` · `const BUILT =` |
| **First Person project** | *A community and their towels* (the OpenVTC card) · *The hitchhiker mage* (the higher network) | `The First Person network:` · `const HIGHER =` |
| **Internet Identity Workshop** | its night on the chain (`/iiw43`) · the IIW path's cover and *Over to you* questions | `iiw43:` in `site/src/worker.js` · `data-sec="Cover"` · `data-sec="Discussion"` |
| **Internet Archive** | the ring card · its night on the chain (`/archive`), the same night as Newspeak House · *Don't panic: tonight, a new page* (the genesis scene that opens each night) | `{name: 'Internet Archive'` · `archive:` in `site/src/worker.js` · `data-sec="Genesis"` |

Each entry is a few short fields: a name, a role in a few words, one or two sentences, and sometimes a short list.
The speaker notes (`<aside class="notes">`) are where longer context and sources go.

**Field Guide**: the scene says "Max's live Guide goes here". A real Guide (a link, or a few chapters with places)
is the most useful thing to send.

**IIW**: send the night's date, place and wording, and any questions you'd like the room to discuss.

**Internet Archive**: send the night's place and wording. The chain page already labels its stars as the Archive's
night; a line about what the Archive brings (keeping the record) can go in the genesis scene's notes.

**Want a scene of your own?** Open an issue first with the one idea it should carry. We'll shape it with you so it
fits the thread.

## What we check before merging

- **True and current.** Say what is live, what is built but not yet running, and what is planned. No overclaiming.
- **Plain and short.** One idea per card. Sentences a newcomer can read aloud. No marketing language.
- **The style.** Keep the guide's look: cream and night backgrounds, cobalt blue, the existing fonts. Don't add
  colours, fonts or scripts from other sites.
- **Images.** Only images you have the right to share, credited in the scene. Keep them small (under 100 KB each).
- **Privacy.** No personal data, no tracking, no third-party embeds. The chain only ever holds hashes and sealed boxes.
- **Your entries only.** Changes to another project's text go through that project.

Questions: open an issue, or ask in the Hitchhikers chat.
