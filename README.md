# SCHEDGEN — Visual Timetable Generator

**SCHEDGEN** is a lightweight, zero-dependency browser app that converts plain-text schedule data into a clean, visual weekly timetable — no accounts, no backend, no setup required.

![SCHEDGEN v1.0](https://img.shields.io/badge/SCHEDGEN-v1.0-orange) ![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-yellow) ![No Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)

---

## Features

- **Plain-text input** — paste your schedule in a simple, human-readable format and generate a visual grid instantly
- **Smart parser** — handles 12-hour and 24-hour time formats, optional room labels, class types (Lab/Lecture), and skips malformed lines gracefully
- **Color-coded subjects** — each subject is assigned a consistent color deterministically based on its code, so the same subject always gets the same color
- **Export options** — save your timetable as a PNG image, PDF, or standalone HTML file, or send it straight to the printer
- **Auto-save** — your last input is saved to `localStorage` and restored on your next visit
- **Keyboard shortcuts** — press `Ctrl+Enter` (or `Cmd+Enter`) to generate without leaving the keyboard

---

## Getting Started

SCHEDGEN is a static site — no build step, no server required.

```bash
git clone https://github.com/ajgiou/schedgen.git
cd schedgen
```

Then open `index.html` in your browser. That's it.

> Alternatively, drag `index.html` into any modern browser window.

---

## Input Format

```
Day
• SubjectCode Subject Name: Start - End (Room) [Type]
```

**Example:**

```
Monday
• CC-102 Computer Programming 1: 8:00 AM - 11:00 AM (COM LAB 1) [Lab]
• MATH-101 College Algebra: 1:00 PM - 3:00 PM (RM 204)

Tuesday
• ENG-101 Technical Writing: 2:00 PM - 4:00 PM (RM 101) [Lecture]
```

| Field | Required | Notes |
|---|---|---|
| Day | ✅ | Full day name (Monday–Sunday) |
| Subject Code | ✅ | Alphanumeric + hyphens (e.g. `CC-102`) |
| Subject Name | ✅ | Free text following the code |
| Time Range | ✅ | `8:00 AM - 11:00 AM` or `08:00 - 11:00` |
| Room | ❌ | In parentheses — defaults to `TBA` |
| Type | ❌ | `[Lab]` or `[Lecture]` — defaults to `Lecture` |

Bullet points (`•`, `-`, `*`) are optional. Blank lines and malformed entries are silently skipped.

---

## Project Structure

```
schedgen/
├── index.html    # App shell and layout
├── style.css     # All styling (dark theme, timetable grid)
└── script.js     # Parser, Renderer, Exporter, UI Controller
```

`script.js` is organized into four self-contained IIFE modules:

- **Parser** — tokenizes raw text into structured day/class objects
- **Renderer** — builds the timetable grid from parsed data
- **Exporter** — handles PNG (html2canvas), PDF (jsPDF), HTML, and print export
- **UI Controller** — manages state, event bindings, localStorage, and status feedback

---

## Dependencies

All loaded from CDN — no `npm install` needed.

| Library | Purpose |
|---|---|
| [html2canvas](https://html2canvas.hertzen.com/) | PNG export |
| [jsPDF](https://github.com/parallax/jsPDF) | PDF export |
| [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) | Monospace UI font |
| [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) | UI body font |
| [Normalize.css](https://necolas.github.io/normalize.css/) | CSS reset |

---

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Requires JavaScript enabled. Export features depend on CDN availability.

---

## License

MIT
