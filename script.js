/* ================================================================
   SCHEDGEN — SCRIPT.JS
   Modules: Parser, Renderer, Exporter, UI Controller
   ================================================================ */

(() => {
  'use strict';

  /* ── STATE ────────────────────────────────────────────────────── */
  const state = {
    rawInput: '',
    parsedData: null,
    hasSchedule: false,
  };

  /* ── CONSTANTS ────────────────────────────────────────────────── */
  const STORAGE_KEY = 'schedgen_input';
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DAY_SHORT = { Monday: 'MON', Tuesday: 'TUE', Wednesday: 'WED', Thursday: 'THU', Friday: 'FRI', Saturday: 'SAT', Sunday: 'SUN' };

  // Curated color palette (Nothing / TE aesthetic)
  const SUBJECT_COLORS = [
    '#e8571a', // muted orange
    '#b8ff57', // dot-matrix green
    '#57b8ff', // cool blue
    '#ff5797', // magenta-pink
    '#ffd557', // warm yellow
    '#57ffd5', // teal
    '#d557ff', // purple
    '#ff8c57', // coral
    '#57ff8c', // lime
    '#8c57ff', // indigo
  ];

  /* ── DOM REFERENCES ───────────────────────────────────────────── */
  const $ = (sel) => document.querySelector(sel);
  const textarea = $('#scheduleInput');
  const btnGenerate = $('#btnGenerate');
  const btnClear = $('#btnClear');
  const btnLoadExample = $('#btnLoadExample');
  const statusBar = $('#statusBar');
  const statusText = $('#statusText');
  const timetableEl = $('#timetable');
  const timetableEmpty = $('#timetableEmpty');
  const timetableWrapper = $('#timetableWrapper');
  const inputIndicator = $('#inputIndicator');
  const outputIndicator = $('#outputIndicator');
  const btnExportPNG = $('#btnExportPNG');
  const btnExportPDF = $('#btnExportPDF');
  const btnExportHTML = $('#btnExportHTML');
  const btnPrint = $('#btnPrint');

  /* ── EXAMPLE DATA ─────────────────────────────────────────────── */
  const EXAMPLE_INPUT = `Monday
• CC-102 Computer Programming 1: 8:00 AM - 11:00 AM (COM LAB 1) [Lab]
• MATH-101 College Algebra: 1:00 PM - 3:00 PM (RM 204)
• PE-101 Physical Education: 5:00 PM - 6:30 PM (GYM)

Tuesday
• CC-101 Introduction to Computing: 9:00 AM - 12:00 PM (COM LAB 2) [Lab]
• ENG-101 Technical Writing: 2:00 PM - 4:00 PM (RM 101) [Lecture]

Wednesday
• CC-102 Computer Programming 1: 8:00 AM - 11:00 AM (COM LAB 1) [Lab]
• MATH-101 College Algebra: 1:00 PM - 3:00 PM (RM 204)
• HUM-101 Art Appreciation: 3:30 PM - 5:00 PM (RM 305)

Thursday
• CC-101 Introduction to Computing: 9:00 AM - 12:00 PM (COM LAB 2) [Lab]
• ENG-101 Technical Writing: 2:00 PM - 4:00 PM (RM 101) [Lecture]
• SCI-101 Earth Science: 4:30 PM - 6:00 PM (RM 202) [Lecture]

Friday
• MATH-101 College Algebra: 10:00 AM - 12:00 PM (RM 204)
• PE-101 Physical Education: 1:00 PM - 2:30 PM (GYM)`;


  /* ================================================================
     PARSER MODULE
     parseSchedule(rawText) → { days: [...], warnings: [...] }
     ================================================================ */
  const Parser = (() => {

    /**
     * Parse a time string like "8:00 AM", "1:00 PM", "13:00", "08:00"
     * Returns minutes from midnight, or null if invalid.
     */
    function parseTime(str) {
      if (!str) return null;
      str = str.trim();

      // 12-hour format: 8:00 AM, 12:30 PM, etc.
      const match12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (match12) {
        let hours = parseInt(match12[1], 10);
        const mins = parseInt(match12[2], 10);
        const period = match12[3].toUpperCase();
        if (hours < 1 || hours > 12 || mins < 0 || mins > 59) return null;
        if (period === 'AM' && hours === 12) hours = 0;
        if (period === 'PM' && hours !== 12) hours += 12;
        return hours * 60 + mins;
      }

      // 24-hour format: 08:00, 13:30, etc.
      const match24 = str.match(/^(\d{1,2}):(\d{2})$/);
      if (match24) {
        const hours = parseInt(match24[1], 10);
        const mins = parseInt(match24[2], 10);
        if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return null;
        return hours * 60 + mins;
      }

      return null;
    }

    /**
     * Format minutes from midnight to display string.
     */
    function formatTime(minutes) {
      let h = Math.floor(minutes / 60);
      const m = minutes % 60;
      const period = h >= 12 ? 'PM' : 'AM';
      if (h === 0) h = 12;
      else if (h > 12) h -= 12;
      return `${h}:${m.toString().padStart(2, '0')} ${period}`;
    }

    /**
     * Hash a string to pick a color index deterministically.
     */
    function hashCode(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit int
      }
      return Math.abs(hash);
    }

    /**
     * Check if a line is a day header.
     */
    function isDayLine(line) {
      const trimmed = line.trim();
      return DAY_NAMES.some(d => d.toLowerCase() === trimmed.toLowerCase());
    }

    /**
     * Normalize day name to title case.
     */
    function normalizeDay(line) {
      const trimmed = line.trim().toLowerCase();
      return DAY_NAMES.find(d => d.toLowerCase() === trimmed) || trimmed;
    }

    /**
     * Parse a single class entry line.
     * Expected: • SubjectCode Subject Name: StartTime - EndTime (Room) [Type]
     * Returns class object or null.
     */
    function parseClassLine(line) {
      // Remove leading bullet, dash, or whitespace
      let cleaned = line.replace(/^[\s•\-\*·▸►]+/, '').trim();
      if (!cleaned) return null;

      // Try to extract [Type] — Lab or Lecture
      let type = 'Lecture'; // default
      const typeMatch = cleaned.match(/\[(Lab|Lecture|LEC|LAB)\]\s*$/i);
      if (typeMatch) {
        const t = typeMatch[1].toLowerCase();
        type = (t === 'lab') ? 'Lab' : 'Lecture';
        cleaned = cleaned.substring(0, typeMatch.index).trim();
      }

      // Try to extract (Room)
      let room = 'TBA';
      const roomMatch = cleaned.match(/\(([^)]+)\)\s*$/);
      if (roomMatch) {
        room = roomMatch[1].trim();
        cleaned = cleaned.substring(0, roomMatch.index).trim();
      }

      // Try to split by colon → left is code+name, right is time range
      const colonIdx = cleaned.indexOf(':');
      // We need to be careful — time strings also contain colons
      // Strategy: find the colon that separates name from time
      // The time part will be like "8:00 AM - 11:00 AM" or "08:00 - 11:00"
      // So we look for a colon where the left side doesn't look like just a number

      let leftPart = '';
      let timePart = '';

      // Find time pattern in the string
      // Pattern: digit:digit(space?AM/PM)? - digit:digit(space?AM/PM)?
      const timePattern = /(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–—]\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i;
      const timeMatch = cleaned.match(timePattern);

      if (timeMatch) {
        const timeStartIdx = cleaned.indexOf(timeMatch[0]);
        leftPart = cleaned.substring(0, timeStartIdx).trim();
        // Remove trailing colon or dash from left part
        leftPart = leftPart.replace(/[:;\-–—]\s*$/, '').trim();
        timePart = timeMatch[0];
      } else {
        return null; // Can't find time — malformed
      }

      // Parse times
      const startTimeStr = timeMatch[1].trim();
      const endTimeStr = timeMatch[2].trim();
      const startMinutes = parseTime(startTimeStr);
      const endMinutes = parseTime(endTimeStr);

      if (startMinutes === null || endMinutes === null) return null;

      // Split left part into code and name
      // Code is the first "word" (alphanumeric + hyphens)
      const codeMatch = leftPart.match(/^([A-Za-z0-9][\w\-]*)/);
      let code = '';
      let name = leftPart;

      if (codeMatch) {
        code = codeMatch[1].toUpperCase();
        name = leftPart.substring(codeMatch[0].length).trim();
      }

      if (!name && code) {
        name = code; // Fallback: use code as name
      }

      if (!code) return null;

      // Determine color
      const colorIdx = hashCode(code) % SUBJECT_COLORS.length;
      const color = SUBJECT_COLORS[colorIdx];

      return {
        code,
        name,
        startTime: formatTime(startMinutes),
        endTime: formatTime(endMinutes),
        startMinutes,
        endMinutes: endMinutes <= startMinutes ? endMinutes + 1440 : endMinutes, // handle midnight crossing
        room,
        type,
        color,
      };
    }

    /**
     * Main parse function.
     */
    function parseSchedule(rawText) {
      const lines = rawText.split('\n');
      const days = [];
      const warnings = [];
      let currentDay = null;
      let lineNum = 0;

      for (const line of lines) {
        lineNum++;
        const trimmed = line.trim();

        // Skip blank lines
        if (!trimmed) continue;

        // Check if it's a day header
        if (isDayLine(trimmed)) {
          const dayName = normalizeDay(trimmed);
          currentDay = { day: dayName, classes: [] };
          days.push(currentDay);
          continue;
        }

        // If no day has been set yet, this might be a malformed line
        if (!currentDay) {
          warnings.push(`Line ${lineNum}: "${trimmed.substring(0, 40)}..." — no day header found above this line`);
          continue;
        }

        // Try to parse as a class entry
        const classObj = parseClassLine(trimmed);
        if (classObj) {
          currentDay.classes.push(classObj);
        } else {
          warnings.push(`Line ${lineNum}: "${trimmed.substring(0, 50)}${trimmed.length > 50 ? '...' : ''}" — could not parse`);
        }
      }

      // Remove days with no classes
      const filteredDays = days.filter(d => d.classes.length > 0);

      // Sort days by canonical order
      filteredDays.sort((a, b) => DAY_NAMES.indexOf(a.day) - DAY_NAMES.indexOf(b.day));

      return { days: filteredDays, warnings };
    }

    return { parseSchedule, formatTime, parseTime };
  })();


  /* ================================================================
     RENDERER MODULE
     renderTimetable(parsedData) → DOM manipulation
     ================================================================ */
  const Renderer = (() => {

    /**
     * Find the global min/max time across all classes, with 30-min buffer.
     */
    function getTimeRange(days) {
      let minTime = Infinity;
      let maxTime = -Infinity;

      for (const day of days) {
        for (const cls of day.classes) {
          if (cls.startMinutes < minTime) minTime = cls.startMinutes;
          if (cls.endMinutes > maxTime) maxTime = cls.endMinutes;
        }
      }

      // Buffer: round down to nearest 30 and subtract 30; round up to nearest 30 and add 30
      minTime = Math.floor(minTime / 30) * 30 - 30;
      maxTime = Math.ceil(maxTime / 30) * 30 + 30;

      // Clamp
      minTime = Math.max(0, minTime);
      maxTime = Math.min(1440, maxTime);

      return { minTime, maxTime };
    }

    /**
     * Generate time slot labels for the range.
     */
    function generateTimeSlots(minTime, maxTime) {
      const slots = [];
      for (let t = minTime; t <= maxTime; t += 30) {
        slots.push(t);
      }
      return slots;
    }

    /**
     * Detect overlapping classes within a day and assign sub-column indices.
     */
    function resolveOverlaps(classes) {
      // Sort by start time, then by duration (longer first)
      const sorted = [...classes].sort((a, b) => {
        if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
        return (b.endMinutes - b.startMinutes) - (a.endMinutes - a.startMinutes);
      });

      // Assign columns using a greedy algorithm
      const columns = []; // each column is an array of classes

      for (const cls of sorted) {
        let placed = false;
        for (let i = 0; i < columns.length; i++) {
          const lastInCol = columns[i][columns[i].length - 1];
          if (cls.startMinutes >= lastInCol.endMinutes) {
            columns[i].push(cls);
            cls._overlapIndex = i;
            placed = true;
            break;
          }
        }
        if (!placed) {
          cls._overlapIndex = columns.length;
          columns.push([cls]);
        }
      }

      // Set total columns for each class
      const totalCols = columns.length;
      for (const cls of sorted) {
        cls._overlapTotal = totalCols;
      }

      return sorted;
    }

    /**
     * Adjust color opacity for background.
     */
    function colorWithAlpha(hex, alpha) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Render the timetable into the DOM.
     */
    function renderTimetable(parsedData) {
      const { days } = parsedData;
      if (!days.length) return;

      const { minTime, maxTime } = getTimeRange(days);
      const slots = generateTimeSlots(minTime, maxTime);
      const totalMinutes = maxTime - minTime;
      const slotHeight = 48; // px per 30 min
      const totalHeight = (totalMinutes / 30) * slotHeight;

      // Clear previous
      timetableEl.innerHTML = '';

      // ── Header Row ──
      const headerRow = document.createElement('div');
      headerRow.className = 'timetable__header-row';

      const corner = document.createElement('div');
      corner.className = 'timetable__corner';
      corner.textContent = 'TIME';
      headerRow.appendChild(corner);

      for (const day of days) {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'timetable__day-header';
        dayHeader.textContent = DAY_SHORT[day.day] || day.day.toUpperCase();
        headerRow.appendChild(dayHeader);
      }

      timetableEl.appendChild(headerRow);

      // ── Body ──
      const body = document.createElement('div');
      body.className = 'timetable__body';
      body.style.height = `${totalHeight}px`;

      // ── Time Column ──
      const timeCol = document.createElement('div');
      timeCol.className = 'timetable__time-col';
      timeCol.style.height = `${totalHeight}px`;

      for (const slot of slots) {
        const label = document.createElement('div');
        label.className = 'timetable__time-label';
        const topPos = ((slot - minTime) / 30) * slotHeight;
        label.style.top = `${topPos}px`;
        label.textContent = Parser.formatTime(slot);
        timeCol.appendChild(label);
      }

      body.appendChild(timeCol);

      // ── Days Container ──
      const daysContainer = document.createElement('div');
      daysContainer.className = 'timetable__days-container';

      for (const day of days) {
        const dayCol = document.createElement('div');
        dayCol.className = 'timetable__day-col';
        dayCol.style.height = `${totalHeight}px`;

        // Grid lines
        for (const slot of slots) {
          const gridLine = document.createElement('div');
          gridLine.className = 'timetable__grid-line';
          if (slot % 60 === 0) gridLine.classList.add('timetable__grid-line--hour');
          const topPos = ((slot - minTime) / 30) * slotHeight;
          gridLine.style.top = `${topPos}px`;
          dayCol.appendChild(gridLine);
        }

        // Resolve overlaps and render class blocks
        const resolvedClasses = resolveOverlaps(day.classes);

        for (const cls of resolvedClasses) {
          const block = document.createElement('div');
          const isLab = cls.type.toLowerCase() === 'lab';
          block.className = `class-block ${isLab ? 'class-block--lab' : 'class-block--lecture'}`;

          // Position
          const topPx = ((cls.startMinutes - minTime) / 30) * slotHeight;
          const heightPx = ((cls.endMinutes - cls.startMinutes) / 30) * slotHeight;
          block.style.top = `${topPx}px`;
          block.style.height = `${Math.max(heightPx, 28)}px`; // min height for tiny classes

          // Color
          if (isLab) {
            block.style.background = colorWithAlpha(cls.color, 0.18);
            block.style.borderColor = cls.color;
          } else {
            block.style.background = colorWithAlpha(cls.color, 0.08);
            block.style.borderColor = cls.color;
          }

          // Overlap handling
          if (cls._overlapTotal > 1) {
            const colWidth = 100 / cls._overlapTotal;
            block.style.left = `${cls._overlapIndex * colWidth}%`;
            block.style.width = `calc(${colWidth}% - 4px)`;
            block.style.marginLeft = '2px';
          }

          // Content
          const code = document.createElement('div');
          code.className = 'class-block__code';
          code.textContent = cls.code;
          code.style.color = cls.color;
          block.appendChild(code);

          // Only show name if block is tall enough
          if (heightPx > 50) {
            const name = document.createElement('div');
            name.className = 'class-block__name';
            name.textContent = cls.name;
            block.appendChild(name);
          }

          if (heightPx > 70) {
            const time = document.createElement('div');
            time.className = 'class-block__time';
            time.textContent = `${cls.startTime} – ${cls.endTime}`;
            block.appendChild(time);
          }

          if (heightPx > 90) {
            const room = document.createElement('div');
            room.className = 'class-block__room';
            room.textContent = cls.room;
            block.appendChild(room);
          }

          // Type badge
          const badge = document.createElement('div');
          badge.className = 'class-block__type-badge';
          badge.textContent = isLab ? 'LAB' : 'LEC';
          badge.style.color = isLab ? '' : cls.color;
          if (isLab) {
            badge.style.background = cls.color;
            badge.style.color = '#0d0d0d';
          } else {
            badge.style.borderColor = cls.color;
          }
          block.appendChild(badge);

          // Tooltip / title
          block.title = `${cls.code} — ${cls.name}\n${cls.startTime} – ${cls.endTime}\n${cls.room} [${cls.type}]`;

          dayCol.appendChild(block);
        }

        daysContainer.appendChild(dayCol);
      }

      body.appendChild(daysContainer);
      timetableEl.appendChild(body);

      // Show timetable, hide empty state
      timetableEl.style.display = 'block';
      timetableEmpty.style.display = 'none';
    }

    /**
     * Clear the rendered timetable.
     */
    function clearTimetable() {
      timetableEl.innerHTML = '';
      timetableEl.style.display = 'none';
      timetableEmpty.style.display = 'flex';
    }

    return { renderTimetable, clearTimetable };
  })();


  /* ================================================================
     EXPORTER MODULE
     Handles PNG, PDF, HTML, and Print exports
     ================================================================ */
  const Exporter = (() => {

    /**
     * Export as PNG using html2canvas.
     */
    async function exportImage() {
      if (!state.hasSchedule) return;

      try {
        setStatus('GENERATING PNG...', 'warning');
        const canvas = await html2canvas(timetableEl, {
          backgroundColor: '#0d0d0d',
          scale: 2,
          useCORS: true,
          logging: false,
        });

        const link = document.createElement('a');
        link.download = 'schedule.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        setStatus('PNG EXPORTED SUCCESSFULLY', 'success');
      } catch (err) {
        console.error('Export PNG error:', err);
        setStatus('PNG EXPORT FAILED', 'error');
      }
    }

    /**
     * Export as PDF using html2canvas + jsPDF.
     */
    async function exportPDF() {
      if (!state.hasSchedule) return;

      try {
        setStatus('GENERATING PDF...', 'warning');
        const canvas = await html2canvas(timetableEl, {
          backgroundColor: '#0d0d0d',
          scale: 2,
          useCORS: true,
          logging: false,
        });

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: 'a4',
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const availWidth = pageWidth - margin * 2;
        const availHeight = pageHeight - margin * 2;

        const imgRatio = canvas.width / canvas.height;
        let imgW = availWidth;
        let imgH = imgW / imgRatio;

        if (imgH > availHeight) {
          imgH = availHeight;
          imgW = imgH * imgRatio;
        }

        const x = (pageWidth - imgW) / 2;
        const y = (pageHeight - imgH) / 2;

        pdf.addImage(imgData, 'PNG', x, y, imgW, imgH);
        pdf.save('schedule.pdf');
        setStatus('PDF EXPORTED SUCCESSFULLY', 'success');
      } catch (err) {
        console.error('Export PDF error:', err);
        setStatus('PDF EXPORT FAILED', 'error');
      }
    }

    /**
     * Export as self-contained HTML file.
     */
    function exportHTML() {
      if (!state.hasSchedule) return;

      try {
        setStatus('GENERATING HTML...', 'warning');

        // Gather all stylesheets content
        let styles = '';
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              styles += rule.cssText + '\n';
            }
          } catch (e) {
            // Cross-origin stylesheet, skip
          }
        }

        const timetableHTML = timetableEl.outerHTML;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Schedule — SCHEDGEN Export</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { background: #0d0d0d; color: #f0f0f0; margin: 0; padding: 24px; font-family: 'Space Grotesk', sans-serif; }
    ${styles}
    .timetable { display: block !important; }
  </style>
</head>
<body>
  <div style="max-width: 1200px; margin: 0 auto;">
    <h1 style="font-family: 'IBM Plex Mono', monospace; font-size: 1.25rem; letter-spacing: 0.15em; margin-bottom: 24px; color: #888;">SCHEDGEN EXPORT</h1>
    <div class="timetable-wrapper" style="border: 1px solid #2a2a2a; border-radius: 2px; overflow: auto; background: #0d0d0d;">
      ${timetableHTML}
    </div>
  </div>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html' });
        const link = document.createElement('a');
        link.download = 'schedule.html';
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
        setStatus('HTML EXPORTED SUCCESSFULLY', 'success');
      } catch (err) {
        console.error('Export HTML error:', err);
        setStatus('HTML EXPORT FAILED', 'error');
      }
    }

    /**
     * Print the schedule.
     */
    function printSchedule() {
      window.print();
    }

    return { exportImage, exportPDF, exportHTML, printSchedule };
  })();


  /* ================================================================
     UI CONTROLLER
     Binds events, manages state, updates interface
     ================================================================ */

  /**
   * Set status bar text and style.
   */
  function setStatus(text, type = '') {
    statusText.textContent = text;
    statusBar.className = 'status-bar';
    if (type) statusBar.classList.add(`status-bar--${type}`);
  }

  /**
   * Enable or disable export buttons.
   */
  function setExportButtons(enabled) {
    [btnExportPNG, btnExportPDF, btnExportHTML, btnPrint].forEach(btn => {
      btn.disabled = !enabled;
    });
  }

  /**
   * Save input to localStorage.
   */
  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, textarea.value);
    } catch (e) {
      // Storage might be full or unavailable
    }
  }

  /**
   * Load input from localStorage.
   */
  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        textarea.value = saved;
        state.rawInput = saved;
      }
    } catch (e) {
      // Storage unavailable
    }
  }

  /**
   * Handle GENERATE action.
   */
  function handleGenerate() {
    const raw = textarea.value.trim();
    if (!raw) {
      setStatus('NO INPUT — ENTER SCHEDULE DATA FIRST', 'error');
      return;
    }

    state.rawInput = raw;
    saveToStorage();

    // Parse
    const result = Parser.parseSchedule(raw);
    state.parsedData = result;

    const totalClasses = result.days.reduce((sum, d) => sum + d.classes.length, 0);
    const warnCount = result.warnings.length;

    if (totalClasses === 0) {
      setStatus(`NO CLASSES PARSED · ${warnCount} WARNING${warnCount !== 1 ? 'S' : ''} — CHECK INPUT FORMAT`, 'error');
      Renderer.clearTimetable();
      state.hasSchedule = false;
      setExportButtons(false);
      outputIndicator.textContent = '✕';
      outputIndicator.className = 'panel__indicator';
      return;
    }

    // Render
    Renderer.renderTimetable(result);
    state.hasSchedule = true;
    setExportButtons(true);

    // Status
    const statusMsg = `${totalClasses} CLASS${totalClasses !== 1 ? 'ES' : ''} PARSED · ${result.days.length} DAY${result.days.length !== 1 ? 'S' : ''} · ${warnCount} WARNING${warnCount !== 1 ? 'S' : ''}`;
    setStatus(statusMsg, warnCount > 0 ? 'warning' : 'success');

    // Log warnings to console
    if (warnCount > 0) {
      console.group('SCHEDGEN — Parse Warnings');
      result.warnings.forEach(w => console.warn(w));
      console.groupEnd();
    }

    // Update indicator
    outputIndicator.textContent = '●';
    outputIndicator.className = 'panel__indicator panel__indicator--active';
  }

  /**
   * Handle CLEAR action.
   */
  function handleClear() {
    textarea.value = '';
    state.rawInput = '';
    state.parsedData = null;
    state.hasSchedule = false;
    saveToStorage();
    Renderer.clearTimetable();
    setExportButtons(false);
    setStatus('CLEARED — READY FOR INPUT', '');
    outputIndicator.textContent = '○';
    outputIndicator.className = 'panel__indicator';
  }

  /**
   * Handle LOAD EXAMPLE action.
   */
  function handleLoadExample() {
    textarea.value = EXAMPLE_INPUT;
    state.rawInput = EXAMPLE_INPUT;
    saveToStorage();
    setStatus('EXAMPLE LOADED — PRESS GENERATE', '');
    inputIndicator.textContent = '●';
    inputIndicator.className = 'panel__indicator panel__indicator--active';
    setTimeout(() => {
      inputIndicator.textContent = '_';
      inputIndicator.className = 'panel__indicator';
    }, 1500);
  }


  /* ── EVENT BINDINGS ───────────────────────────────────────────── */
  function bindEvents() {
    // Buttons
    btnGenerate.addEventListener('click', handleGenerate);
    btnClear.addEventListener('click', handleClear);
    btnLoadExample.addEventListener('click', handleLoadExample);

    // Export buttons
    btnExportPNG.addEventListener('click', Exporter.exportImage);
    btnExportPDF.addEventListener('click', Exporter.exportPDF);
    btnExportHTML.addEventListener('click', Exporter.exportHTML);
    btnPrint.addEventListener('click', Exporter.printSchedule);

    // Textarea — save to storage on input
    textarea.addEventListener('input', () => {
      state.rawInput = textarea.value;
      saveToStorage();
    });

    // Keyboard shortcut: Ctrl+Enter to generate
    textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleGenerate();
      }
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Escape to clear
      if (e.key === 'Escape' && document.activeElement === textarea) {
        // Don't clear on escape — just blur
        textarea.blur();
      }
    });
  }


  /* ── INITIALIZATION ───────────────────────────────────────────── */
  function init() {
    loadFromStorage();
    bindEvents();
    setExportButtons(false);

    // If there's saved input, show a hint
    if (textarea.value.trim()) {
      setStatus('PREVIOUS INPUT RESTORED — PRESS GENERATE', '');
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
