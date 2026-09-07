# SCHEDGEN v2.1 — Visual Timetable Generator

> **PLAIN TEXT → VISUAL TIMETABLE**
>
> Turns a plain-text schedule into a weekly timetable. It supports a light theme and a dark theme, and it shows the current time on today's column. Export the result as PNG, PDF, or HTML, or print it directly.

---

## Table of Contents

1. [Purpose](#purpose)
2. [Quick Start](#quick-start)
3. [Input Format](#input-format)
4. [Generating the Timetable](#generating-the-timetable)
5. [Theme (Light / Dark)](#theme-light--dark)
6. [Current Time Line](#current-time-line)
7. [Export Options](#export-options)
8. [Overlap Resolution](#overlap-resolution)
9. [Color Coding](#color-coding)
10. [Storage & Auto-Generate](#storage--auto-generate)
11. [Keyboard Shortcuts](#keyboard-shortcuts)
12. [Accessibility](#accessibility)
13. [Browser Compatibility](#browser-compatibility)
14. [File Structure](#file-structure)
15. [Dependencies](#dependencies)
16. [Credits](#credits)
17. [License](#license)

---

## Purpose

SCHEDGEN turns a plain-text schedule into a color-coded weekly timetable. It needs no spreadsheet, no calendar import, and no account. Paste the text and press **GENERATE**.

Typical users:
- Students who organize class schedules
- Staff who build weekly teaching overviews
- Anyone who gets a schedule as plain text in an email

---

## Quick Start

1. Open `index.html` in a modern browser (Chrome, Firefox, Safari, or Edge).
2. Press **EXAMPLE** to load a sample schedule.
3. Press **GENERATE**, or use `Ctrl+Enter`.
4. Use the theme button in the header to switch between light and dark mode.
5. Check the timetable in the output panel on the right.
6. Export the timetable with the buttons at the top of the output panel.

The app needs no server and no install. After the first load of the fonts and export libraries, it works without internet access.

---

## Input Format

### Basic Structure

```
DayName
• SubjectCode Subject Name: StartTime - EndTime (Room) [Type]
```

Each day block starts with a day name on its own line. One or more class lines follow it.

### Full Example

```
Monday
• CC-102 Computer Programming 1: 8:00 AM - 11:00 AM (COM LAB 1) [Lab]
• MATH-101 College Algebra: 1:00 PM - 3:00 PM (RM 204)
• PE-101 Physical Education: 5:00 PM - 6:30 PM (GYM)

Tuesday
• CC-101 Introduction to Computing: 9:00 AM - 12:00 PM (COM LAB 2) [Lab]
• ENG-101 Technical Writing: 2:00 PM - 4:00 PM (RM 101) [Lecture]

Wednesday
- CC-102 Computer Programming 1: 8:00 AM - 11:00 AM (COM LAB 1) [Lab]
MATH-101 College Algebra: 1:00 PM - 3:00 PM (RM 204)

Thursday
• SCI-101 Earth Science: 4:30 PM - 6:00 PM (RM 202)

Friday
• MATH-101 College Algebra: 10:00 AM - 12:00 PM (RM 204)
```

### Day Names

Day names do not need a specific case. The parser accepts the full name and two shorter forms.

| Full Name   | Abbreviation | Short |
|-------------|-------------|-------|
| `Monday`    | `Mon`       | `Mo`  |
| `Tuesday`   | `Tue`       | `Tu`  |
| `Wednesday` | `Wed`       | `We`  |
| `Thursday`  | `Thu`       | `Th`  |
| `Friday`    | `Fri`       | `Fr`  |
| `Saturday`  | `Sat`       | `Sa`  |
| `Sunday`    | `Sun`       | `Su`  |

### Line Prefixes (optional)

A class line can start with any of these marks, or with none at all.

```
• CC-102 ...      ← bullet
- CC-102 ...      ← hyphen
* CC-102 ...      ← asterisk
→ CC-102 ...      ← arrow
CC-102 ...        ← no mark
```

### Time Formats

The parser accepts these time formats.

```
8:00 AM - 11:00 AM    ← 12-hour with AM/PM (preferred)
13:00 - 15:30         ← 24-hour
8:00 - 11:00          ← 24-hour, no AM/PM (read as morning)
8 - 11                ← hour only (the parser guesses AM/PM)
8:30-11:00            ← no space around the dash
```

**AM/PM guess:** When a time has no AM/PM mark and the hour is 12 or less, the parser checks the end time against the start time. If the end time is at or before the start time, the parser reads the end time as PM. Example: `8 - 5` becomes 8 AM to 5 PM.

### Optional Fields

| Field    | Syntax           | Default   |
|----------|-----------------|-----------|
| Room     | `(Room Name)`   | `TBA`     |
| Type     | `[Lab]` or `[Lecture]` | `Lecture` |

Both fields are optional. Place them in any order after the time range.

### Comments and Blank Lines

```
// This is a comment. The parser ignores it.
# This is also a comment.

The parser ignores blank lines too.
```

### Parser Rules Summary

- The subject **code** is the first token that starts with a letter. It may hold letters, digits, hyphens, and underscores (for example, `CC-102`, `MATH101`, `PE_101`).
- The subject **name** is the text between the code and the time range.
- A name may hold a colon. The parser finds the time range by pattern, not by the first colon in the line.
- A line the parser cannot read produces a warning. The warning shows in the warnings box below the textarea.
- A day with no valid classes does not appear in the timetable.

---

## Generating the Timetable

### Manual Generation

1. Type or paste the schedule text in the **SCHEDULE DATA** box.
2. Press **GENERATE**, or use `Ctrl+Enter` (`Cmd+Enter` on Mac).
3. The timetable renders in the output panel on the right.

### Auto-Generate

Turn on the **AUTO-GENERATE** checkbox to update the timetable 500 ms after you stop typing. This helps with fast iteration. On large inputs it can feel slow. Turn it off and use `Ctrl+Enter` instead if that happens.

### Status Indicators

The status line below the textarea shows:
- The number of classes parsed
- The number of days
- The number of parse warnings
- A color for the result: green for success, amber for warnings, red for an error

The parse count badge next to the status line shows a short `N classes · N warn` summary.

---

## Theme (Light / Dark)

The theme button sits at the top right of the header. Its label always names the mode you get **after** you press it, not the current mode. So while the app is in light mode, the button reads **DARK**. Press it to switch to dark mode, and the label then reads **LIGHT**.

The app saves your choice to `localStorage` under the key `schedgen_v2_theme` and applies it again on your next visit.

Colors for both modes come from CSS custom properties in `style.css`:
- A set of `--theme-*` tokens holds the raw colors for each mode (background, text, borders, accent, and status colors).
- A set of `--c-*` names is a short alias for those tokens. Most rules in the file use the short `--c-*` names.
- The default (light) values live in `:root`. The dark values live in a `body[data-theme='dark']` block, which the theme button turns on and off.
- Both the `--theme-*` tokens and the `--c-*` names are set again inside the dark block. A `--c-*` name takes its value from the block where it is set, not from `:root`, so the dark block must set both layers for the theme switch to reach every element.

---

## Current Time Line

While the current day is on the timetable, and the current time falls inside the visible time range, a red line marks the current time on that day's column. The line does not appear on other days, and it does not appear if the current time falls before or after the visible range.

The app draws this line once, when it renders the timetable. It does not move the line while the page stays open. Press **GENERATE** again to update it.

---

## Export Options

Find the export buttons in the output panel header. They stay disabled until a timetable exists.

### PNG — Save as Image

Saves a PNG of the full timetable at twice the normal pixel density. The image includes a header bar with the SCHEDGEN name and the generation date. The export captures the whole timetable, even the part outside the visible viewport.

File name: `schedgen-YYYYMMDD.png`

### PDF — Save as PDF Document

Builds a PDF with the timetable image centered on an A4 page. The app picks landscape or portrait orientation based on the width and height of the timetable.

File name: `schedgen-YYYYMMDD.pdf`

### HTML — Save as Standalone HTML

Saves a single `.html` file with all styles inside it, fonts loaded from Google Fonts, and the timetable structure intact. Open this file in any browser. It does not need SCHEDGEN.

File name: `schedgen-YYYYMMDD.html`

### COPY — Copy to Clipboard

Copies the timetable as a PNG image to the system clipboard, through the Clipboard API. If the browser does not support `ClipboardItem`, the app downloads a file instead.

> **Note:** Clipboard write needs a secure context (HTTPS or `localhost`). Some browsers, such as Firefox, may ask you to allow clipboard access.

### PRINT

Opens the browser print dialog with print styles applied:
- The input panel, header, footer, and export bar stay hidden.
- The timetable fills the page.
- Colors print as shown on screen (`print-color-adjust: exact`).

---

## Overlap Resolution

When two or more classes on the same day overlap in time, SCHEDGEN places them in side-by-side columns with this method.

1. Sort the classes by start time. For a tie, place the longer class first.
2. Track an "active columns" list. Each entry holds the end time of the last class placed in that column.
3. Place each class in the lowest-numbered column where the last class has already ended.
4. If no such column exists, open a new column.
5. The number of columns for a day equals the largest number of classes active at the same time.

This method gives two guarantees.
- No two overlapping classes share a column.
- The timetable uses the smallest possible number of columns.

A class block that overlaps another one gets a dashed border, so you can spot it at a glance.

---

## Color Coding

Each subject code gets one color from an 8-color set. A hash function (a djb2 variant) picks the color, so the same code always gets the same color, in any session or browser.

### Palette

| Color   | Hex       | Typical Use |
|---------|-----------|-------------|
| Orange  | `#e8571a` | Accent / primary |
| Sky Blue| `#57b8ff` | Computing subjects |
| Lime    | `#b8ff57` | Sciences |
| Magenta | `#ff5797` | Arts / Humanities |
| Amber   | `#ffd557` | Mathematics |
| Teal    | `#57ffd5` | Languages |
| Violet  | `#d557ff` | Special topics |
| Coral   | `#ff8c57` | Physical education |

### Block Styles

- **Lab blocks:** a filled background (15% of the subject color), a solid 3px left border, and a solid outer border. The type badge has a solid background for contrast.
- **Lecture blocks:** a faint background (7% of the subject color), a translucent outer border, and a solid left border. The type badge has an outline only.
- **Short blocks (under 52px tall):** show only the subject code and the type badge. Hover the block to see the full details in a tooltip.
- **Tiny blocks (under 36px tall):** show only the type badge and the code.

---

## Storage & Auto-Generate

### LocalStorage Auto-Save

The app saves your schedule text to `localStorage` under the key `schedgen_v2_input` as you type, and restores it the next time you open the app.

### Clear Storage

Press **CLEAR STORAGE** to remove the saved input from `localStorage`. This does not clear the textarea for the current session. Use it when you want a clean slate on your next visit.

> **CLEAR** empties the textarea now. **CLEAR STORAGE** removes the saved copy for next time. The two buttons do different things.

### Auto-Generate Preference

The app saves the auto-generate checkbox state to `localStorage` under the key `schedgen_v2_autogen`, and restores it on load.

---

## Keyboard Shortcuts

| Shortcut             | Action                          |
|---------------------|---------------------------------|
| `Ctrl+Enter`         | Generate the timetable              |
| `Cmd+Enter` (Mac)    | Generate the timetable              |
| `Escape`             | Close the Format Guide modal    |
| `Tab`                | Move between interactive elements |
| `Enter` / `Space`    | Activate a focused class block (shows the tooltip) |

---

## Accessibility

SCHEDGEN v2.1 includes these accessibility features.

- **Semantic HTML:** proper `<header>`, `<main>`, `<section>`, and `<footer>` elements, with roles where needed.
- **ARIA labels:** every interactive element has an `aria-label`. The timetable grid uses `role="grid"`, `role="row"`, and `role="gridcell"`.
- **Live regions:** the status text and the warnings box use `aria-live="polite"`, so a screen reader announces changes.
- **Focus management:** the modal dialog traps focus while open. `Escape` closes it and returns focus to the button that opened it.
- **Keyboard navigation:** you can reach every button and class block with the keyboard.
- **Skip link:** a "Skip to timetable" link appears on the first `Tab` press.
- **Reduced motion:** the app turns off transitions and animations when the system sets `prefers-reduced-motion: reduce`.
- **Focus indicators:** every focusable element shows a visible `focus-visible` outline.

---

## Browser Compatibility

SCHEDGEN v2.1 targets current browser versions.

| Browser            | Support |
|-------------------|---------|
| Chrome 90+         | Full  |
| Firefox 90+        | Full  |
| Safari 15+         | Full  |
| Edge 90+           | Full  |
| iOS Safari 15+     | Full  |
| Opera 76+          | Full  |

**Known limits:**
- Clipboard copy (`navigator.clipboard.write`) needs HTTPS or `localhost`. Over plain HTTP, the app downloads a file instead.
- Firefox may ask for clipboard permission on first use.
- The app does not support old browsers such as IE11 or pre-Chromium Edge.

---

## File Structure

```
schedgen/
├── index.html     ← HTML structure. No inline scripts or styles.
├── style.css      ← All styles: layout, timetable, blocks, modal, print, theme tokens
├── script.js      ← All JavaScript: Parser, OverlapResolver, Renderer, Exporter, UI
└── README.md      ← This file
```

These four files are all the app needs. There is no build step and no `node_modules` folder.

---

## Dependencies

SCHEDGEN loads two libraries from a CDN for export.

| Library       | Version | CDN URL |
|--------------|---------|---------|
| html2canvas  | 1.4.1   | `https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js` |
| jsPDF        | 2.5.1   | `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js` |

**For fully offline use:** download both `.js` files, update the `<script src="...">` paths in `index.html`, and either host the fonts locally or remove the font links. Without the Google Fonts link, the app falls back to the system monospace and sans-serif fonts.

---

## Credits

- **html2canvas** by Niklas von Hertzen — renders the DOM to a canvas for PNG and PDF export.
- **jsPDF** by the jsPDF Team — builds the PDF file in the browser.
- **IBM Plex Mono** and **Space Grotesk** — Google Fonts, loaded from the CDN.
- The visual style draws on Nothing and Teenage Engineering product design: industrial monospaced type, a minimal dark interface, and high-contrast accents.

---

## License

https://github.com/ajgiou/SCHEDGEN?tab=AGPL-3.0-1-ov-file
