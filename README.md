# Pády – Czech cases practice app

A small app for drilling the 7 Czech cases. It runs in Chrome on your phone,
works offline, and keeps your progress on the device. No account and no internet
needed after the first visit.

---

## 1. What is in this folder

| File / folder | What it is |
|---|---|
| `index.html` | The app's page |
| `css/style.css` | How it looks |
| `js/app.js` | How it works (checking answers, spaced repetition, progress) |
| `data/exercises/*.json` | **The exercises**, one file per case: `nom` `gen` `dat` `acc` `voc` `loc` `ins` |
| `data/rules.json` | Grammar rules (title, explanation, tip) linked to exercises |
| `data/tables.json` | Declension tables shown after a mistake and in Reference |
| `data/prepositions.json` | Preposition list for the Reference page |
| `data/index.json` | List of exercise files the app loads |
| `sw.js`, `manifest.webmanifest`, `icons/` | Make it installable and work offline |
| `start.bat` | Double-click to run the app on your computer |
| `validate.bat` | Double-click to check the exercise data for mistakes |
| `tools/selftest.html` | Automatic test of the answer checker |

---

## 2. Run it on your computer

1. Double-click **`start.bat`**.
2. A black window opens and your browser shows the app at `http://localhost:8080`.
3. Keep the black window open while you practise. Close it when you're done.

> Double-clicking `index.html` directly does **not** work: browsers block
> the data files when a page is opened that way. Always use `start.bat`.

---

## 3. Put it online for free (GitHub Pages) – one-time setup

You don't need to install anything; it's all done in the browser.

1. Go to **https://github.com** and create a free account (or log in).
2. Click the **+** at the top right → **New repository**.
   - Name: `pady` (any name works)
   - Choose **Public** (free GitHub Pages needs a public repository).
   - Click **Create repository**.
3. On the new page, click the link **"uploading an existing file"**.
4. Open the `czech-cases` folder in File Explorer, select **everything inside it**
   (Ctrl+A) and drag it into the browser window. Folders upload too.
5. Scroll down and click **Commit changes**. Wait until the upload finishes.
6. Go to **Settings** (tab at the top of the repository) → **Pages** (left menu).
   - Under "Build and deployment", Source: **Deploy from a branch**
   - Branch: **main**, folder **/ (root)** → **Save**.
7. Wait 1–2 minutes, then refresh the page. It shows your address, e.g.
   `https://YOUR-NAME.github.io/pady/`. That is your app.

*Alternative: Netlify.* Create a free account at https://app.netlify.com,
choose **Add new site → Deploy manually**, and drag the `czech-cases` folder
onto the page. You get an address like `https://something.netlify.app`.

---

## 4. Install it on your Pixel 9

1. On the phone, open **Chrome** and go to your address (e.g. `https://YOUR-NAME.github.io/pady/`).
2. Tap the **⋮** menu (top right) → **Install app** (or **Add to Home screen → Install**).
3. The **Pády** icon appears on your home screen and in the app drawer.
   It opens full-screen like a normal app.
4. Open it once while online. After that it also works **offline** (train, plane, metro).

Tip: in Gboard, add Czech as a second language (Settings → Languages) and
switch with the 🌐 key. Long-press a letter to get á, č, ě, ř, š, ů…

---

## 5. Update the app on your phone after changes

1. Change the files on your computer (for example add exercises).
2. Double-click `validate.bat` and check that it says **ERRORS (0)**.
3. On GitHub, open your repository → **Add file → Upload files** → drag the
   changed files **in the same folders** (e.g. drag the `data` folder again) → **Commit changes**.
4. Wait 1–2 minutes. On the phone, close the app completely and open it again
   while online. It always loads the newest version when there is internet.

Your progress is **not** lost by updating. It is stored on the phone, separate from the app files.

---

## 6. Back up your progress

Settings → **Export progress** saves a small `.json` file to your Downloads.
**Import progress** loads it back (e.g. on a new phone). Do this now and then;
clearing Chrome's site data would erase your progress.

---

## 7. Add your own exercises

Open the file of the right case (e.g. `data/exercises/gen.json` for the genitive) in a text editor (Notepad works; **VS Code** is nicer
and is free). Each exercise is one line between `{ }`, separated by commas.
Copy an existing line, paste it below, and change it. **Give it a new unique `id`.**

```json
{"id":"acc-n-100","case":"acc","num":"sg","cat":"nouns","type":"fill","g":"Ma",
 "prompt":"Čekám na ___ .","base":"bratr","hint":"I'm waiting for my brother.",
 "answers":["bratra"],"rule":"acc-ma-hard",
 "explain":"čekat na + accusative. bratr is masculine animate, hard stem → -a: bratra.",
 "tags":["hard"]}
```

| Field | Meaning | Values |
|---|---|---|
| `id` | Unique name | e.g. `acc-n-100` (never reuse one, progress is stored by id) |
| `case` | Case being practised | `nom` `gen` `dat` `acc` `voc` `loc` `ins` |
| `num` | Singular / plural | `sg` or `pl` |
| `cat` | Category (for progress stats) | `nouns` `adjectives` `pronouns` `prepositions` `phrases` |
| `type` | Exercise type | see below |
| `g` | Gender (highlights the table row) | `Ma` (Mž) `Mi` (Mn) `F` `N` |
| `prompt` | Sentence or instruction; `___` = blank | put a space before `.`/`?` after a blank: `Vidím ___ .` |
| `base` | The word/phrase/sentence you transform | `Tomáš` |
| `hint` | English translation (optional) | |
| `answers` | **All** accepted answers; the first is the "main" one | `["mou","moji"]` |
| `rule` | Id of a rule in `data/rules.json` | `acc-ma-soft` |
| `explain` | Why: shown after a mistake | |
| `tags` | Free labels; `exception` puts it on the check list | `["exception"]` |
| `options` | Only for `chooseprep` / `choose`: buttons to choose from | `["na","v"]` |
| `full` | Only for `error`: the corrected sentence | `"Vidím Tomáše."` |

**Exercise types**

| `type` | What you see | What you type |
|---|---|---|
| `fill` | `Jdu pro ___ .` → Tomáš | `Tomáše` |
| `phrase` | `Vidím ___ ___ ___ .` → ten dobrý student | `toho dobrého studenta` |
| `decline` | Give the accusative singular of: muž | `muže` |
| `prepcase` | Which case does **pro** take? | tap 1–7 (answers: `["acc"]`) |
| `chooseprep` | `Děkuji ___ dárek.` + buttons | `za` |
| `choose` | `___ místnost` + buttons ten / ta / to | `ta` |
| `translate` | I see Tomáš. | `Vidím Tomáše.` (list word-order variants in `answers`) |
| `error` | Vidím Tomáš. | `Tomáše` (or the whole corrected sentence) |

After editing, **double-click `validate.bat`**. It tells you about missing fields,
typos in field names, duplicate ids and broken JSON (with the line number).

For a **plural** exercise write `"num":"pl"`: the app then shows a "plural" badge and the
plural table after a mistake. All 7 cases (singular and plural) already have tables
(`tables.json`, ids like `gen-sg`, `gen-pl`) and rules (`rules.json`).

If you ever add a brand-new exercise **file**, list it in `data/index.json` and in the
`CORE` list in `sw.js` (the checker reminds you).

---

## 8. How the repetition works (Leitner boxes)

Every exercise sits in a box from 1 to 6.
- **Correct:** it moves up one box and comes back later: box 2 → 1 day, 3 → 3 days,
  4 → 7 days, 5 → 16 days, 6 → 35 days. Box 4+ counts as "mastered".
- **Wrong:** it drops to box 1, comes back **in the same session** a few
  questions later, and again tomorrow.

Sessions always take the items that are **due** first, then new ones.

## 9. Practice modes

- **1. – 7. (one case):** singular and plural of that case. New items come in the
  order of the file, so you start with the easier singular ones.
- **🔀 All cases mixed:** a longer session (40 by default, change it in Settings)
  with new items spread evenly over all 7 cases.
- **Singular / Plural switch** above the case buttons: limits the case and mixed
  sessions to singular or plural only.
- **⚡ 5-minute practice**, **🧭 Prepositions only**, **🎯 Weak spots**.
