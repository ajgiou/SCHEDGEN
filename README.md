# SCHEDGEN

Paste your class schedule as plain text. SCHEDGEN turns it into a clean weekly timetable you can actually read, then saves it as a PNG image, a PDF, or a web page — or prints it.

## How to use

1. Open `index.html` in a browser. Nothing to install, no account needed.
2. Press **EXAMPLE** to see a sample, or paste your own schedule in the box on the left.
3. Press **GENERATE** (or `Ctrl+Enter`).
4. Use the buttons above the timetable to save or print it.

Everything runs in your browser. Your schedule is saved on your own device and comes back the next time you open the page. **CLEAR** empties the text box now; **CLEAR STORAGE** also removes the saved copy.

## Writing your schedule

Write a day name, then one line per class:

```
Monday
CC-102 Computer Programming 1: 8:00 AM - 11:00 AM (COM LAB 1) [Lab]
MATH-101 College Algebra: 1:00 PM - 3:00 PM (RM 204)

Tuesday
CC-101 Introduction to Computing: 9:00 AM - 12:00 PM (COM LAB 2) [Lab]
```

Each class line has: subject code and name, then the time range, then two optional extras — the room in `(parentheses)` and the kind of class in `[brackets]`.

- Times can be written as `8:00 AM - 11:00 AM`, `13:00 - 15:30`, or just `8 - 11`.
- Bullets like `•` or `-` at the start of a line are allowed but not needed.
- No room? It shows **TBA**. No `[Lab]` or `[Lecture]`? It counts as Lecture.
- Lines starting with `//` or `#` are ignored.
- A line the tool cannot read is listed under **PARSE WARNINGS** so you can fix it. Fix it and generate again.

## Reading the timetable

- Long subject names wrap and shrink to fit — text is never cut off. For very short classes, hover the block (or press Enter on it) to see the full details.
- Two classes at the same time sit side by side, marked with a dashed border.
- A line on today's column shows the current time.
- The **DARK** button switches between light and dark mode. Your choice is remembered.
- Turn on **AUTO-GENERATE** to update the timetable as you type.

## Saving the timetable

| Button | What you get |
|---|---|
| **PNG** | Image file |
| **PDF** | Image on an A4 page |
| **HTML** | Standalone web page that opens anywhere |
| **COPY** | Image on your clipboard, ready to paste |
| **PRINT** | Your printer's dialog, timetable only |

## Files

```
index.html   the page
style.css    the look
script.js    the brain
README.md    this file
```

No build step. Needs internet on first load for fonts and the export libraries; after that it works offline.

## Credits

Made with [html2canvas](https://html2canvas.hertzen.com/) and [jsPDF](https://github.com/parallax/jsPDF). Fonts: Open Sans and IBM Plex Mono. License: [AGPL-3.0](https://github.com/ajgiou/SCHEDGEN?tab=AGPL-3.0-1-ov-file).
