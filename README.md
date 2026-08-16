# SCHEDGEN v2.0 — Visual Timetable Generator

***August 2026 update: Development is still happening, but at a slow pace. I've been making fixes and changing the formats to make them easier.***

**PLAIN TEXT → VISUAL TIMETABLE**
> A fully static, offline-capable web application that parses plain-text academic schedules and renders them as pixel-perfect weekly timetables. Export as PNG, PDF, HTML, or print directly.

---

## Table of Contents

1. [Purpose](#purpose)
2. [Quick Start](#quick-start)
3. [Input Format](#input-format)
4. [Generating the Timetable](#generating-the-timetable)
5. [Export Options](#export-options)
6. [Overlap Resolution](#overlap-resolution)
7. [Color Coding](#color-coding)
8. [Storage & Auto-Generate](#storage--auto-generate)
9. [Keyboard Shortcuts](#keyboard-shortcuts)
10. [Accessibility](#accessibility)
11. [Browser Compatibility](#browser-compatibility)
12. [File Structure](#file-structure)
13. [Dependencies](#dependencies)
14. [Credits](#credits)

---

## Purpose

SCHEDGEN converts a plain-text schedule into a professional, color-coded weekly timetable. No spreadsheets, no Google Calendar imports, no account required — just paste your text and click **GENERATE**.

Primary use cases:
- Students organizing class schedules
- Academic staff creating weekly teaching overviews
- Anyone who receives schedules in plain-text email format

---

## Quick Start

1. Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge).
2. Click **EXAMPLE** to load a sample schedule.
3. Click **GENERATE** (or press `Ctrl+Enter`).
4. View the rendered timetable on the right.
5. Export via the buttons in the top-right of the output panel.

No server, no installation, no internet required after the initial font/library load.

---

## Input Format

### Basic Structure

```
DayName
• SubjectCode Subject Name: StartTime - EndTime (Room) [Type]
```

Each **day block** starts with a day name on its own line, followed by one or more class entries.

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

Day headers are **case-insensitive** and support full names and abbreviations:

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

Class entries accept any of the following line prefixes, or none at all:

```
• CC-102 ...      ← bullet character
- CC-102 ...      ← hyphen/dash
* CC-102 ...      ← asterisk
→ CC-102 ...      ← arrow
CC-102 ...        ← no prefix (plain text)
```

### Time Formats

The parser accepts a wide range of time formats:

```
8:00 AM - 11:00 AM    ← 12-hour with AM/PM (preferred)
13:00 - 15:30         ← 24-hour
8:00 - 11:00          ← 24-hour (ambiguous — treated as morning)
8 - 11                ← bare hours (smart AM/PM guess applied)
8:30-11:00            ← no spaces around separator
```

**Smart AM/PM guessing:** When times are ambiguous (no AM/PM and hour ≤ 12), the parser checks if the end time is less than or equal to the start time. If so, it assumes the end time is PM. Otherwise, it treats both as the given values.

### Optional Fields

| Field    | Syntax           | Default   |
|----------|-----------------|-----------|
| Room     | `(Room Name)`   | `TBA`     |
| Type     | `[Lab]` or `[Lecture]` | `Lecture` |

Both fields are optional and may appear in any order at the end of the line (after the time range).

### Comments & Blank Lines

```
// This is a comment — ignored by parser
# This too

Blank lines are ignored entirely.
```

### Parser Rules Summary

- Subject **code** = first token starting with a letter, may contain letters, digits, hyphens, underscores (e.g., `CC-102`, `MATH101`, `PE_101`).
- Subject **name** = everything between the code and the time range (colons/dashes stripped from boundaries).
- Names containing colons are supported because the time range is detected by a pattern match, not by splitting on the first colon.
- Malformed lines that cannot be parsed generate a **warning** shown in the warnings box below the textarea.
- Days with no valid classes are excluded from the rendered timetable.

---

## Generating the Timetable

### Manual Generation

1. Enter or paste your schedule text in the **SCHEDULE DATA** textarea.
2. Press the **GENERATE** button or use `Ctrl+Enter` (`Cmd+Enter` on Mac).
3. The timetable renders in the output panel on the right.

### Auto-Generate

Enable the **AUTO-GENERATE** checkbox to have the timetable automatically update 500ms after you stop typing. This is useful for rapid iteration but may feel slow with large inputs — disable it and use `Ctrl+Enter` instead.

### Status Indicators

The status line below the textarea shows:
- Number of classes parsed
- Number of days
- Number of parse warnings
- Color-coded: green (success), amber (warnings), red (error)

The **parse count badge** next to the status shows a quick `N classes · N warn` summary.

---

## Export Options

All export buttons are located in the **output panel header**. They are disabled until a schedule is generated.

### PNG — Save as Image

Saves a high-resolution PNG (2× pixel density) of the full timetable, including a header bar with the SCHEDGEN logo and generation date. The export captures the **entire** timetable even if it extends beyond the visible viewport.

File name: `schedgen-YYYYMMDD.png`

### PDF — Save as PDF Document

Generates a PDF with the timetable image centered on an A4 page. Orientation (landscape/portrait) is automatically selected based on the timetable's aspect ratio — wide timetables use landscape, tall ones use portrait.

File name: `schedgen-YYYYMMDD.pdf`

### HTML — Save as Standalone HTML

Exports a self-contained `.html` file with all styles embedded, Google Fonts loaded via CDN, and the timetable structure preserved. Open it in any browser without needing SCHEDGEN.

File name: `schedgen-YYYYMMDD.html`

### COPY — Copy to Clipboard

Copies the timetable as a PNG image to the system clipboard using the Clipboard API. Falls back to a file download if the browser does not support `ClipboardItem`.

> **Note:** Clipboard write requires a secure context (HTTPS or localhost). On some browsers (Firefox), you may need to grant clipboard permissions.

### PRINT

Opens the browser's print dialog with print-specific CSS applied:
- Input panel, header, footer, and export bar are hidden.
- Timetable fills the page.
- Colors are preserved (`print-color-adjust: exact`).

---

## Overlap Resolution

When two or more classes on the same day have overlapping time ranges, SCHEDGEN uses an **interval-graph coloring algorithm** to resolve them:

1. Classes are sorted by start time (longest duration first on ties).
2. An "active columns" array tracks the end time of each column's last class.
3. Each new class is assigned to the **lowest-numbered free column** (one where the current class starts at or after the previous class's end time).
4. If no free column exists, a new column is created.
5. The total number of columns for a day equals the **maximum number of simultaneously active classes** (the clique number of the interval graph).

This guarantees:
- No two overlapping classes share the same sub-column.
- Columns are used as efficiently as possible (minimum total columns).
- Partial overlaps (A overlaps B but not C, while B overlaps C) are handled correctly.

Overlapping blocks are rendered with a **dashed border** to visually distinguish them from non-overlapping blocks.

---

## Color Coding

Each unique subject code receives a **deterministic color** from an 8-color palette using a hash function (djb2-variant). The same code always receives the same color across sessions and browsers.

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

- **Lab blocks:** Filled background (15% opacity of subject color) + solid left accent border (3px) + solid outer border. Badge has solid background for high contrast.
- **Lecture blocks:** Very subtle background (7% opacity) + translucent outer border + solid left accent border. Badge is outlined.
- **Short classes (< 52px height):** Only the subject code and type badge are shown. Full details appear in the native tooltip on hover.
- **Tiny classes (< 36px height):** Only the type badge and code are shown.

---

## Storage & Auto-Generate

### LocalStorage Auto-Save

Your schedule text is automatically saved to `localStorage` under the key `schedgen_v2_input` as you type. It is restored when you return to the app.

### Clear Storage

Click **CLEAR STORAGE** to remove the saved input from localStorage without clearing the textarea. This is useful if you want to start fresh next visit.

> Note: **CLEAR** only clears the textarea for the current session. **CLEAR STORAGE** removes the persisted data.

### Auto-Generate Preference

The auto-generate checkbox state is saved to `localStorage` under `schedgen_v2_autogen` and restored on load.

---

## Keyboard Shortcuts

| Shortcut             | Action                          |
|---------------------|---------------------------------|
| `Ctrl+Enter`         | Generate timetable              |
| `Cmd+Enter` (Mac)    | Generate timetable              |
| `Escape`             | Close the Format Guide modal    |
| `Tab`                | Navigate between interactive elements |
| `Enter` / `Space`    | Activate focused class block (shows tooltip alert) |

---

## Accessibility

SCHEDGEN v2.0 includes the following accessibility features:

- **Semantic HTML**: Proper `<header>`, `<main>`, `<section>`, `<footer>`, `<dialog>` roles.
- **ARIA labels**: All interactive elements have `aria-label` attributes. The timetable grid uses `role="grid"`, `role="row"`, and `role="gridcell"`.
- **Live regions**: Status text and warnings use `aria-live="polite"` for screen reader announcements.
- **Focus management**: Modal dialog traps focus correctly. Escape closes it and returns focus to the trigger button.
- **Keyboard navigation**: All buttons and class blocks are keyboard-accessible.
- **Skip link**: A "Skip to timetable" link appears on first Tab press.
- **Reduced motion**: All transitions and animations are disabled when `prefers-reduced-motion: reduce` is set.
- **Focus indicators**: All focusable elements have visible `focus-visible` outlines.

---

## Browser Compatibility

SCHEDGEN v2.0 targets **modern evergreen browsers**:

| Browser            | Support |
|-------------------|---------|
| Chrome 90+         | ✅ Full  |
| Firefox 90+        | ✅ Full  |
| Safari 15+         | ✅ Full  |
| Edge 90+           | ✅ Full  |
| iOS Safari 15+     | ✅ Full  |
| Opera 76+          | ✅ Full  |

**Known limitations:**
- **Clipboard copy** (`navigator.clipboard.write`) requires HTTPS or `localhost`. On HTTP, it falls back to a file download.
- Firefox may prompt for clipboard permissions on first use.
- Very old browsers (IE11, pre-Chromium Edge) are not supported.

---

## File Structure

```
schedgen/
├── index.html     ← Semantic HTML structure, no inline scripts or styles
├── style.css      ← All styles (layout, timetable, blocks, modal, print)
├── script.js      ← All JavaScript (Parser, OverlapResolver, Renderer, Exporter, UI)
└── README.md      ← This file
```

Everything runs from these four files. No build step, no `node_modules`, no server.

---

## Dependencies

SCHEDGEN loads two CDN libraries for export functionality:

| Library       | Version | CDN URL |
|--------------|---------|---------|
| html2canvas  | 1.4.1   | `https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js` |
| jsPDF        | 2.5.1   | `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js` |

**For fully offline use:** Download these two `.js` files locally, update the `<script src="...">` paths in `index.html`, and load fonts via local copies or remove them (the app falls back to system monospace/sans fonts gracefully).

---

## Credits

- **html2canvas** by Niklas von Hertzen — DOM-to-canvas rendering for PNG/PDF export.
- **jsPDF** by the jsPDF Team — PDF generation in the browser.
- **IBM Plex Mono** and **Space Grotesk** — Google Fonts (loaded via CDN).
- Design language inspired by Nothing and Teenage Engineering product aesthetics: industrial monospaced type, dark minimal interface, high-contrast accents.

---

## License

https://github.com/ajgiou/SCHEDGEN?tab=AGPL-3.0-1-ov-file
