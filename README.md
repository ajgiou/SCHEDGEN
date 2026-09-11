# SCHEDGEN v2.2 — Visual Timetable Generator

Turn a plain-text schedule into a weekly timetable. SCHEDGEN supports a light theme and a dark theme, and it marks the current time on today's column. Export the result as PNG, PDF, or HTML, or print it directly.

## Contents

1. [Quick Start](#quick-start)
2. [Input Format](#input-format)
3. [Generating the Timetable](#generating-the-timetable)
4. [Theme](#theme)
5. [Current Time Line](#current-time-line)
6. [Export Options](#export-options)
7. [Overlap Resolution](#overlap-resolution)
8. [Color Coding](#color-coding)
9. [Storage](#storage)
10. [Keyboard Shortcuts](#keyboard-shortcuts)
11. [Accessibility](#accessibility)
12. [Browser Support](#browser-support)
13. [Files and Dependencies](#files-and-dependencies)
14. [Credits and License](#credits-and-license)

## Quick Start

1. Open `index.html` in a modern browser.
2. Press **EXAMPLE** to load a sample schedule, or paste your own.
3. Press **GENERATE**, or use `Ctrl+Enter`.
4. Switch light and dark mode with the theme button in the header.
5. Export the result with the buttons above the timetable.

SCHEDGEN needs no server, account, or install. After the first load of the fonts and export libraries, it works offline.

## Input Format

Each day block starts with a day name, followed by one or more class lines:

```
Monday
• CC-102 Computer Programming 1: 8:00 AM - 11:00 AM (COM LAB 1) [Lab]
• MATH-101 College Algebra: 1:00 PM - 3:00 PM (RM 204)

Tuesday
- CC-101 Introduction to Computing: 9:00 AM - 12:00 PM (COM LAB 2) [Lab]
ENG-101 Technical Writing: 2:00 PM - 4:00 PM (RM 101) [Lecture]
```

**Day names:** full name, or a 3-letter or 2-letter short form (`Monday` / `Mon` / `Mo`), case-insensitive.

**Line prefix:** optional. Use `•`, `-`, `*`, `→`, or no mark at all.

**Time formats:**

| Format | Example |
|---|---|
| 12-hour with AM/PM | `8:00 AM - 11:00 AM` |
| 24-hour | `13:00 - 15:30` |
| 24-hour, no AM/PM | `8:00 - 11:00` (read as morning) |
| Hour only | `8 - 11` (parser guesses AM/PM) |
| No spaces | `8:30-11:00` |

If a time has no AM/PM mark and the hour is 12 or less, and the end time falls at or before the start time, the parser reads the end time as PM. So `8 - 5` becomes 8 AM to 5 PM.

**Optional fields**, in any order after the time range:

| Field | Syntax | Default |
|---|---|---|
| Room | `(Room Name)` | `TBA` |
| Type | `[Lab]` or `[Lecture]` | `Lecture` |

**Comments:** a line starting with `//` or `#` is a comment. The parser skips comments and blank lines.

**Parsing rules:**
- The subject code is the first token that starts with a letter. It may contain letters, digits, hyphens, and underscores.
- The subject name is the text between the code and the time range. It may contain a colon — the parser finds the time range by pattern, not by the first colon.
- A line the parser cannot read produces a warning, shown in the warnings box below the input.
- A day with no valid classes does not appear in the timetable.

## Generating the Timetable

Press **GENERATE**, or use `Ctrl+Enter` (`Cmd+Enter` on Mac), to render the timetable.

Turn on **AUTO-GENERATE** to update the timetable 500 ms after you stop typing. On large inputs this can feel slow — turn it off and use `Ctrl+Enter` instead.

The status line below the input shows the number of classes, days, and parse warnings, with a color for the result: green for success, amber for warnings, red for an error. The parse count badge gives a short summary, such as `12 classes · 1 warn`.

## Theme

The theme button sits at the top right of the header. Its label names the mode you get **after** you press it. So in light mode, the button reads **DARK**. Press it, and the label changes to **LIGHT**.

SCHEDGEN saves your choice to `localStorage` under `schedgen_v2_theme` and applies it on your next visit.

Colors come from CSS custom properties in `style.css`. A set of `--theme-*` tokens holds the raw colors for each mode. A set of `--c-*` names aliases those tokens, and most rules in the file use the short `--c-*` names. Light values live in `:root`; dark values live in `body[data-theme='dark']`. Both layers are set again inside the dark block, since a `--c-*` name takes its value from the block where it is set, not from `:root`. The dark block must set both layers for the theme switch to reach every element.

## Current Time Line

When the current day appears on the timetable, and the current time falls inside the visible range, a red line marks that time on today's column. The line does not appear on other days or outside the visible range.

SCHEDGEN draws this line once, when it renders the timetable, and does not move it while the page stays open. Press **GENERATE** again to update it.

## Export Options

The export buttons sit above the timetable and stay disabled until a timetable exists.

| Button | Result | File name |
|---|---|---|
| **PNG** | Image of the full timetable at 2x pixel density, with a header bar showing the SCHEDGEN name and generation date. Captures the whole timetable, even parts outside the viewport. | `schedgen-YYYYMMDD.png` |
| **PDF** | The timetable image centered on an A4 page. Orientation (landscape or portrait) follows the timetable's width and height. | `schedgen-YYYYMMDD.pdf` |
| **HTML** | A single file with all styles inline and fonts linked from Google Fonts. Opens in any browser, with no dependency on SCHEDGEN. | `schedgen-YYYYMMDD.html` |
| **COPY** | Copies the timetable as a PNG to the system clipboard, through the Clipboard API. Downloads a file instead if the browser lacks `ClipboardItem` support. | — |
| **PRINT** | Opens the browser print dialog with the input panel, header, footer, and export bar hidden, and colors printed as shown on screen. | — |

Clipboard copy needs a secure context (HTTPS or `localhost`). Some browsers, including Firefox, may ask you to allow clipboard access.

## Overlap Resolution

When classes on the same day overlap, SCHEDGEN places them in side-by-side columns:

1. Sort classes by start time. For a tie, place the longer class first.
2. Track a list of active columns. Each entry holds the end time of the last class placed there.
3. Place each class in the lowest-numbered column whose last class has already ended.
4. If no such column exists, open a new column.

The number of columns for a day equals the largest number of classes active at once. This method keeps overlapping classes out of the same column, using the smallest possible number of columns. A block that overlaps another gets a dashed border, so you can spot it at a glance.

## Color Coding

A hash function (a djb2 variant) assigns each subject code one color from an 8-color set, so the same code always gets the same color.

| Color | Hex | Typical use |
|---|---|---|
| Orange | `#e8571a` | Accent / primary |
| Sky Blue | `#57b8ff` | Computing |
| Lime | `#b8ff57` | Sciences |
| Magenta | `#ff5797` | Arts / Humanities |
| Amber | `#ffd557` | Mathematics |
| Teal | `#57ffd5` | Languages |
| Violet | `#d557ff` | Special topics |
| Coral | `#ff8c57` | Physical education |

**Block styles:**
- **Lab:** filled background (15% opacity), solid 3px left border, solid outer border, and a filled type badge.
- **Lecture:** faint background (7% opacity), translucent outer border, solid left border, and an outlined type badge.
- **Short blocks** (under 52px tall) show only the code and type badge. Hover for full details in a tooltip.
- **Tiny blocks** (under 36px tall) show only the type badge and code.

## Storage

| Key | Holds | Set by |
|---|---|---|
| `schedgen_v2_input` | Your schedule text, saved as you type | Auto-save |
| `schedgen_v2_theme` | Light or dark mode | Theme button |
| `schedgen_v2_autogen` | Auto-generate checkbox state | Auto-generate checkbox |

**CLEAR** empties the textarea now. **CLEAR STORAGE** removes the saved input for next time, without touching the current textarea. The two buttons do different things.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Enter` / `Cmd+Enter` | Generate the timetable |
| `Escape` | Close the Format Guide modal |
| `Tab` | Move between interactive elements |
| `Enter` / `Space` | Show the tooltip for a focused class block |

## Accessibility

- Semantic HTML: `<header>`, `<main>`, `<section>`, `<footer>`, with roles where needed.
- An `aria-label` on every interactive element. The timetable grid uses `role="grid"`, `role="row"`, and `role="gridcell"`.
- Live regions on the status text and warnings box, so a screen reader announces changes.
- Focus trapped inside the modal while open. `Escape` closes it and returns focus to the button that opened it.
- Every button and class block reachable by keyboard.
- A "Skip to timetable" link, shown on the first `Tab` press.
- Transitions and animations turned off when the system sets `prefers-reduced-motion: reduce`.
- A visible `focus-visible` outline on every focusable element.

## Browser Support

Chrome 90+, Firefox 90+, Safari 15+, Edge 90+, iOS Safari 15+, and Opera 76+ are fully supported.

**Known limits:**
- Clipboard copy needs HTTPS or `localhost`. Over plain HTTP, SCHEDGEN downloads a file instead.
- Firefox may prompt for clipboard permission on first use.
- Old browsers, such as IE11 or pre-Chromium Edge, are not supported.

## Files and Dependencies

```
schedgen/
├── index.html     ← HTML structure. No inline scripts or styles.
├── style.css      ← Layout, timetable, blocks, modal, print, and theme tokens
├── script.js      ← Parser, OverlapResolver, Renderer, Exporter, UI
└── README.md      ← This file
```

No build step, and no `node_modules` folder.

| Library | Version | CDN URL |
|---|---|---|
| html2canvas | 1.4.1 | `cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js` |
| jsPDF | 2.5.1 | `cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js` |

**For offline use:** download both `.js` files, update the `<script src="...">` paths in `index.html`, and either host the fonts locally or remove the font links. Without the Google Fonts link, SCHEDGEN falls back to system monospace and sans-serif fonts.

## Credits and License

- **html2canvas** (Niklas von Hertzen) renders the DOM to a canvas for PNG and PDF export.
- **jsPDF** (jsPDF Team) builds the PDF file in the browser.
- **IBM Plex Mono** and **Space Grotesk** are Google Fonts, loaded from the CDN.
- The visual style follows Nothing and Teenage Engineering product design: industrial monospaced type, a minimal dark interface, and high-contrast accents.

License: [AGPL-3.0](https://github.com/ajgiou/SCHEDGEN?tab=AGPL-3.0-1-ov-file)
