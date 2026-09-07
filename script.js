// ============================================================
// SCHEDGEN v2.1 — Main Script
// Modules:
//   Parser          — reads raw text, builds structured data
//   OverlapResolver — assigns sub-columns to overlapping classes
//   Renderer        — builds the timetable DOM
//   Exporter        — PNG / PDF / HTML / clipboard / print
//   UI wiring       — events, theme, storage, status
// ============================================================
(() => {
  'use strict';

  // localStorage keys. Do not change these. A change loses saved user data.
  const STORAGE_KEY   = 'schedgen_v2_input';
  const AUTOGEN_KEY   = 'schedgen_v2_autogen';
  const THEME_KEY     = 'schedgen_v2_theme';
  const VERSION       = 'v2.1';   // shown in header and export banner
  const DEFAULT_THEME = 'light';  // used when no saved preference exists

  const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  const DAY_ALIASES = {
    monday:'Monday', mon:'Monday', mo:'Monday',
    tuesday:'Tuesday', tue:'Tuesday', tu:'Tuesday',
    wednesday:'Wednesday', wed:'Wednesday', we:'Wednesday',
    thursday:'Thursday', thu:'Thursday', th:'Thursday',
    friday:'Friday', fri:'Friday', fr:'Friday',
    saturday:'Saturday', sat:'Saturday', sa:'Saturday',
    sunday:'Sunday', sun:'Sunday', su:'Sunday',
  };

  const DAY_SHORT = {
    Monday:'MON', Tuesday:'TUE', Wednesday:'WED',
    Thursday:'THU', Friday:'FRI', Saturday:'SAT', Sunday:'SUN',
  };

  // Eight accent colors, one per subject code (see hashCode below).
  // The same code always gets the same color.
  const SUBJECT_COLORS = [
    '#e8571a', // orange
    '#57b8ff', // sky blue
    '#b8ff57', // lime
    '#ff5797', // magenta
    '#ffd557', // amber
    '#57ffd5', // teal
    '#d557ff', // violet
    '#ff8c57', // coral
  ];

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

  // Central state object. All modules read and write it.
  const state = {
    rawInput:     '',      // current textarea content
    parsedData:   null,    // result of Parser.parseSchedule()
    hasSchedule:  false,   // true when a timetable is rendered
    autoGenerate: false,   // user auto-generate toggle preference
    autoGenTimer: null,    // debounce timer handle for auto-generate
    theme:        DEFAULT_THEME, // 'light' or 'dark'
  };

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  const DOM = {
    get textarea()        { return $('#scheduleInput'); },
    get btnGenerate()     { return $('#btnGenerate'); },
    get btnClear()        { return $('#btnClear'); },
    get btnClearStorage() { return $('#btnClearStorage'); },
    get btnLoadExample()  { return $('#btnLoadExample'); },
    get btnFormatHelp()   { return $('#btnFormatHelp'); },
    get statusText()      { return $('#statusText'); },
    get parseCount()      { return $('#parseCount'); },
    get timetable()       { return $('#timetable'); },
    get timetableEmpty()  { return $('#timetableEmpty'); },
    get timetableWrapper(){ return $('#timetableWrapper'); },
    get btnExportPNG()    { return $('#btnExportPNG'); },
    get btnExportPDF()    { return $('#btnExportPDF'); },
    get btnExportHTML()   { return $('#btnExportHTML'); },
    get btnExportCopy()   { return $('#btnExportCopy'); },
    get btnPrint()        { return $('#btnPrint'); },
    get chkAutoGen()      { return $('#chkAutoGen'); },
    get formatModal()     { return $('#formatModal'); },
    get modalClose()      { return $('#modalClose'); },
    get inputPanel()      { return $('#inputPanel'); },
    get toggleInputBtn()  { return $('#toggleInputBtn'); },
    get warningsBox()     { return $('#warningsBox'); },
    get warningsList()    { return $('#warningsList'); },
    get btnThemeToggle()  { return $('#btnThemeToggle'); },
  };

  // ---------------------------------------------------------------------------
  // Parser module
  // Reads plain text and builds a schedule object with days, classes,
  // times, rooms, and warnings.
  // ---------------------------------------------------------------------------
  const Parser = (() => {

    // Parse a single time string into minutes since midnight.
    function parseTimeSingle(str) {
      if (!str) return null;
      str = str.trim();

      const m12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (m12) {
        let h = parseInt(m12[1], 10);
        const min = parseInt(m12[2], 10);
        const p = m12[3].toUpperCase();
        if (h < 1 || h > 12 || min < 0 || min > 59) return null;
        if (p === 'AM' && h === 12) h = 0;
        if (p === 'PM' && h !== 12) h += 12;
        return h * 60 + min;
      }

      const m24 = str.match(/^(\d{1,2}):(\d{2})$/);
      if (m24) {
        const h = parseInt(m24[1], 10);
        const min = parseInt(m24[2], 10);
        if (h < 0 || h > 23 || min < 0 || min > 59) return null;
        return h * 60 + min;
      }

      const mBare = str.match(/^(\d{1,2})$/);
      if (mBare) {
        const h = parseInt(mBare[1], 10);
        if (h < 0 || h > 23) return null;
        return h * 60;
      }

      return null;
    }

    // Guess AM/PM when the input has none.
    // If end time is at or before start time, and start is before noon,
    // treat end as PM. Example: "8 - 5" becomes 8 AM to 5 PM.
    function guessAmPm(startMin, endMin, rawStart, rawEnd) {
      // Skip the guess when the input already has AM or PM.
      const hasAmPm = /AM|PM/i.test(rawStart) || /AM|PM/i.test(rawEnd);
      if (hasAmPm) return { startMin, endMin };

      const startH = Math.floor(startMin / 60);
      const endH   = Math.floor(endMin / 60);

      if (startH >= 1 && startH <= 12 && endH >= 1 && endH <= 12) {
        if (endH <= startH) {
          if (startH < 12) {
            return { startMin, endMin: endMin + 12 * 60 };
          }
        }
        return { startMin, endMin };
      }

      return { startMin, endMin };
    }

    function formatTime(minutes) {
      let h = Math.floor(minutes / 60) % 24;
      const m = minutes % 60;
      const period = h >= 12 ? 'PM' : 'AM';
      if (h === 0) h = 12;
      else if (h > 12) h -= 12;
      return `${h}:${String(m).padStart(2, '0')} ${period}`;
    }

    // djb2 hash. Turns a string into a stable unsigned 32-bit integer.
    // This picks the same color slot for the same subject code every time.
    function hashCode(str) {
      let h = 5381;
      for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h) ^ str.charCodeAt(i);
        h = h >>> 0; // force an unsigned 32-bit integer
      }
      return h;
    }

    // Picks one of the SUBJECT_COLORS for a subject code.
    function colorForCode(code) {
      return SUBJECT_COLORS[hashCode(code.toUpperCase()) % SUBJECT_COLORS.length];
    }

    function normalizeDay(line) {
      const key = line.trim().toLowerCase().replace(/[^a-z]/g, '');
      return DAY_ALIASES[key] || null;
    }

    // Locate a time range (e.g. "8:00 AM - 11:00 AM") anywhere in a line.
    // Returns start/end minutes plus the text before and after the range.
    function extractTimeRange(str) {
      // T matches one time token: digits, optional :mm, optional AM/PM
      const T = '(\\d{1,2}(?::\\d{2})?\\s*(?:AM|PM)?)';
      const SEP = '\\s*[-–—]\\s*';
      const pattern = new RegExp(T + SEP + T, 'i');

      const match = str.match(pattern);
      if (!match) return null;

      const rawStart = match[1].trim();
      const rawEnd   = match[2].trim();

      let startMin = parseTimeSingle(rawStart);
      let endMin   = parseTimeSingle(rawEnd);

      if (startMin === null || endMin === null) return null;

      const guessed = guessAmPm(startMin, endMin, rawStart, rawEnd);
      startMin = guessed.startMin;
      endMin   = guessed.endMin;

      if (endMin <= startMin) endMin += 1440;

      const matchIdx   = str.indexOf(match[0]);
      const beforeTime = str.substring(0, matchIdx);
      const afterTime  = str.substring(matchIdx + match[0].length);

      return { startMin, endMin, rawStart, rawEnd, beforeTime, afterTime };
    }

    // Parse a single class line into a structured class object.
    function parseClassLine(line) {
      let cleaned = line.replace(/^[\s•\-\*·▸►→]+/, '').trim();
      if (!cleaned) return null;

      let type = 'Lecture';
      const typeMatch = cleaned.match(/\[([^\]]+)\]\s*$/i);
      if (typeMatch) {
        const t = typeMatch[1].trim().toLowerCase();
        type = (t === 'lab' || t === 'laboratory') ? 'Lab' : 'Lecture';
        cleaned = cleaned.substring(0, typeMatch.index).trim();
      }

      let room = 'TBA';
      const roomMatch = cleaned.match(/\(([^)]+)\)\s*$/);
      if (roomMatch) {
        room = roomMatch[1].trim();
        cleaned = cleaned.substring(0, roomMatch.index).trim();
      }

      const timeData = extractTimeRange(cleaned);
      if (!timeData) return null;

      const { startMin, endMin, beforeTime, afterTime } = timeData;

      let leftPart = beforeTime.replace(/[:\-–—]\s*$/, '').trim();

      const codeMatch = leftPart.match(/^([A-Za-z][A-Za-z0-9\-_]*[0-9A-Za-z]|[A-Za-z][0-9A-Za-z\-_]*)/);
      let code = '';
      let name = '';

      if (codeMatch) {
        code = codeMatch[1].toUpperCase();
        name = leftPart.substring(codeMatch[0].length).trim();
        name = name.replace(/^[:\-–—\s]+/, '').trim();
      } else {
        name = leftPart;
        code = leftPart.split(/\s+/)[0].toUpperCase() || 'UNK';
      }

      if (!name && code) name = code;
      if (!code) return null;

      return {
        code,
        name,
        startTime:    formatTime(startMin),
        endTime:      formatTime(endMin),
        startMinutes: startMin,
        endMinutes:   endMin,
        room,
        type,
        color:        colorForCode(code),
      };
    }

    // Parse the entire schedule text into day groups and class entries.
    function parseSchedule(rawText) {
      const lines    = rawText.split('\n');
      const days     = [];
      const warnings = [];
      const lineAnnotations = {};
      let currentDay = null;
      let lineNum    = 0;

      for (const line of lines) {
        lineNum++;
        const trimmed = line.trim();
        if (!trimmed) continue;

        const dayName = normalizeDay(trimmed);
        if (dayName) {
          const existing = days.find(d => d.day === dayName);
          if (existing) {
            currentDay = existing;
          } else {
            currentDay = { day: dayName, classes: [] };
            days.push(currentDay);
          }
          continue;
        }

        if (!currentDay) {
          const msg = `Line ${lineNum}: No day header found above — skipped`;
          warnings.push(msg);
          lineAnnotations[lineNum - 1] = msg;
          continue;
        }

        const cls = parseClassLine(trimmed);
        if (cls) {
          currentDay.classes.push(cls);
        } else {
          if (trimmed.startsWith('//') || trimmed.startsWith('#')) continue;
          const msg = `Line ${lineNum}: Could not parse — "${trimmed.substring(0, 55)}${trimmed.length > 55 ? '…' : ''}"`;
          warnings.push(msg);
          lineAnnotations[lineNum - 1] = msg;
        }
      }

      // Remove empty day blocks and keep canonical weekday order.
      const filteredDays = days
        .filter(d => d.classes.length > 0)
        .sort((a, b) => DAY_NAMES.indexOf(a.day) - DAY_NAMES.indexOf(b.day));

      return { days: filteredDays, warnings, lineAnnotations };
    }

    return { parseSchedule, formatTime, parseTimeSingle, colorForCode };
  })();

  // ---------------------------------------------------------------------------
  // OverlapResolver module
  // Assigns each class to a sub-column when classes overlap in the same day.
  // ---------------------------------------------------------------------------
  const OverlapResolver = (() => {

    // Greedy column assignment. Sets _overlapCol (column index) and
    // _overlapTotal (columns needed for the day) on each class.
    // Classes that do not overlap share column 0.
    function resolve(classes) {
      if (!classes.length) return classes;

      // Sort by start time. For ties, put the longer class first.
      const sorted = [...classes].sort((a, b) => {
        if (a.startMinutes !== b.startMinutes)
          return a.startMinutes - b.startMinutes;
        return (b.endMinutes - b.startMinutes) - (a.endMinutes - a.startMinutes);
      });

      // active[col] holds the end time of the last class in that column.
      const active = [];

      for (const cls of sorted) {
        let placed = false;
        // Use the first column whose last class has already ended.
        for (let col = 0; col < active.length; col++) {
          if (active[col] <= cls.startMinutes) {
            cls._overlapCol = col;
            active[col] = cls.endMinutes;
            placed = true;
            break;
          }
        }
        // No open column. Add a new one.
        if (!placed) {
          cls._overlapCol = active.length;
          active.push(cls.endMinutes);
        }
      }

      // The Renderer needs the total column count to set each block's width.
      const totalCols = active.length;
      for (const cls of sorted) {
        cls._overlapTotal = totalCols;
      }

      return classes;
    }

    return { resolve };
  })();

  // ---------------------------------------------------------------------------
  // Renderer module
  // Builds the timetable DOM, grid lines, time labels, and class blocks.
  // ---------------------------------------------------------------------------
  const Renderer = (() => {

    const SLOT_H = 48;

    // Find the visible time window — rounded to the nearest 30-min slot,
    // with one 30-min buffer above and below the earliest/latest class.
    function getTimeRange(days) {
      let min = Infinity;
      let max = -Infinity;
      for (const day of days) {
        for (const cls of day.classes) {
          if (cls.startMinutes < min) min = cls.startMinutes;
          if (cls.endMinutes   > max) max = cls.endMinutes;
        }
      }
      min = Math.max(0,    Math.floor(min / 30) * 30 - 30);
      max = Math.min(1440, Math.ceil(max  / 30) * 30 + 30);
      return { minTime: min, maxTime: max };
    }

    function hexToRgba(hex, alpha) {
      const r = parseInt(hex.slice(1,3), 16);
      const g = parseInt(hex.slice(3,5), 16);
      const b = parseInt(hex.slice(5,7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }

    // Build the accessible tooltip text for each class block.
    function buildTooltip(cls) {
      return `${cls.code} — ${cls.name}\n${cls.startTime} – ${cls.endTime}\n${cls.room} · ${cls.type}`;
    }

    // Draw the "now" line inside today's column only.
    // If today is not on the grid, or the current time is off-grid, draw nothing.
    function updateCurrentTimeLine(minTime, maxTime, todayCol) {
      if (!todayCol) return;

      const now     = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      if (nowMins < minTime || nowMins > maxTime) return;

      const bar = document.createElement('div');
      bar.id        = 'currentTimeBar';
      bar.className = 'tt-now-line';
      bar.setAttribute('aria-hidden', 'true');
      bar.style.top = `${((nowMins - minTime) / 30) * SLOT_H}px`;
      todayCol.appendChild(bar);
    }

    // Render the timetable grid and all class blocks into the DOM.
    function renderTimetable(parsedData) {
      const { days } = parsedData;
      if (!days.length) return;

      const timetableEl = DOM.timetable;
      const { minTime, maxTime } = getTimeRange(days);
      const totalMinutes = maxTime - minTime;
      const totalSlots   = totalMinutes / 30;
      const totalHeight  = totalSlots * SLOT_H;

      const slots = [];
      for (let t = minTime; t <= maxTime; t += 30) slots.push(t);

      timetableEl.innerHTML = '';
      timetableEl.removeAttribute('style');

      const headerRow = document.createElement('div');
      headerRow.className = 'tt-header-row';
      headerRow.setAttribute('role', 'row');

      const corner = document.createElement('div');
      corner.className = 'tt-corner';
      corner.setAttribute('aria-hidden', 'true');
      corner.textContent = 'TIME';
      headerRow.appendChild(corner);

      for (const day of days) {
        const th = document.createElement('div');
        th.className = 'tt-day-header';
        th.setAttribute('role', 'columnheader');
        th.setAttribute('aria-label', day.day);

        const abbr = document.createElement('span');
        abbr.className = 'tt-day-header__abbr';
        abbr.textContent = DAY_SHORT[day.day] || day.day.slice(0,3).toUpperCase();

        const full = document.createElement('span');
        full.className = 'tt-day-header__full';
        full.textContent = day.day;

        th.appendChild(abbr);
        th.appendChild(full);
        headerRow.appendChild(th);
      }
      timetableEl.appendChild(headerRow);

      const body = document.createElement('div');
      body.className = 'tt-body';
      body.style.height = `${totalHeight}px`;

      const timeCol = document.createElement('div');
      timeCol.className = 'tt-time-col';
      timeCol.setAttribute('aria-hidden', 'true');

      for (const slot of slots) {
        const label = document.createElement('div');
        label.className = 'tt-time-label' + (slot % 60 === 0 ? ' tt-time-label--hour' : '');
        label.style.top = `${((slot - minTime) / 30) * SLOT_H}px`;
        if (slot % 60 === 0) {
          label.textContent = Parser.formatTime(slot);
        }
        timeCol.appendChild(label);
      }
      body.appendChild(timeCol);

      const daysContainer = document.createElement('div');
      daysContainer.className = 'tt-days-container';
      daysContainer.setAttribute('role', 'grid');

      const nowDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      let todayCol = null;

      for (let di = 0; di < days.length; di++) {
        const day    = days[di];
        const dayCol = document.createElement('div');
        dayCol.className = 'tt-day-col';
        dayCol.setAttribute('role', 'row');
        dayCol.dataset.day = day.day;
        if (day.day === nowDay) todayCol = dayCol;

        for (const slot of slots) {
          const gl = document.createElement('div');
          gl.className = 'tt-grid-line' + (slot % 60 === 0 ? ' tt-grid-line--hour' : '');
          gl.style.top = `${((slot - minTime) / 30) * SLOT_H}px`;
          gl.setAttribute('aria-hidden', 'true');
          dayCol.appendChild(gl);
        }

        const resolved = OverlapResolver.resolve(day.classes);

        for (const cls of resolved) {
          const isLab     = cls.type === 'Lab';
          const topPx     = ((cls.startMinutes - minTime) / 30) * SLOT_H;
          const heightPx  = Math.max(((cls.endMinutes - cls.startMinutes) / 30) * SLOT_H, 28);
          // Short blocks (<52px) hide the subject name and meta row to avoid clipping.
          // Tiny blocks (<36px) also hide the name — only the code badge remains visible.
          const isShort   = heightPx < 52;
          const isTiny    = heightPx < 36;

          const block = document.createElement('div');
          block.className  = [
            'class-block',
            isLab  ? 'class-block--lab' : 'class-block--lecture',
            cls._overlapTotal > 1 ? 'class-block--overlap' : '',
            isShort ? 'class-block--short' : '',
          ].filter(Boolean).join(' ');

          block.setAttribute('role', 'gridcell');
          block.setAttribute('tabindex', '0');
          block.setAttribute('aria-label', buildTooltip(cls));
          block.title = buildTooltip(cls);

          block.style.top    = `${topPx}px`;
          block.style.height = `${heightPx}px`;

          if (cls._overlapTotal > 1) {
            const pct   = 100 / cls._overlapTotal;
            const left  = cls._overlapCol * pct;
            block.style.left  = `calc(${left}% + 3px)`;
            block.style.width = `calc(${pct}% - 6px)`;
          } else {
            block.style.left  = '3px';
            block.style.right = '3px';
          }

          block.style.setProperty('--block-color', cls.color);
          if (isLab) {
            block.style.background   = hexToRgba(cls.color, 0.15);
            block.style.borderColor  = cls.color;
            block.style.borderLeftWidth = '3px';
          } else {
            block.style.background   = hexToRgba(cls.color, 0.07);
            block.style.borderColor  = hexToRgba(cls.color, 0.6);
            block.style.borderLeftWidth = '3px';
            block.style.borderLeftColor = cls.color;
          }

          const badge = document.createElement('span');
          badge.className   = 'class-block__badge';
          badge.textContent = isLab ? 'LAB' : 'LEC';
          if (isLab) {
            badge.style.background = cls.color;
            badge.style.color      = '#0a0a0a';
          } else {
            badge.style.color      = cls.color;
            badge.style.border     = `1px solid ${hexToRgba(cls.color, 0.7)}`;
          }
          block.appendChild(badge);

          const codeEl = document.createElement('div');
          codeEl.className   = 'class-block__code';
          codeEl.textContent = cls.code;
          codeEl.style.color = cls.color;
          block.appendChild(codeEl);

          if (!isTiny) {
            const nameEl = document.createElement('div');
            nameEl.className   = 'class-block__name';
            nameEl.textContent = cls.name;
            block.appendChild(nameEl);
          }

          if (!isShort) {
            const metaEl = document.createElement('div');
            metaEl.className   = 'class-block__meta';
            metaEl.textContent = `${cls.startTime}–${cls.endTime}`;
            block.appendChild(metaEl);

            if (heightPx >= 90) {
              const roomEl = document.createElement('div');
              roomEl.className   = 'class-block__room';
              roomEl.textContent = cls.room;
              block.appendChild(roomEl);
            }
          }

          block.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              alert(buildTooltip(cls));
            }
          });

          dayCol.appendChild(block);
        }

        daysContainer.appendChild(dayCol);
      }

      body.appendChild(daysContainer);
      timetableEl.appendChild(body);

      DOM.timetable.style.display     = 'block';
      DOM.timetableEmpty.style.display = 'none';

      updateCurrentTimeLine(minTime, maxTime, todayCol);
    }

    function clearTimetable() {
      DOM.timetable.innerHTML       = '';
      DOM.timetable.style.display   = 'none';
      DOM.timetableEmpty.style.display = 'flex';
    }

    return { renderTimetable, clearTimetable, getTimeRange };
  })();

  // ---------------------------------------------------------------------------
  // Exporter module
  // Handles PNG, PDF, HTML export and clipboard copy of the rendered timetable.
  // ---------------------------------------------------------------------------
  const Exporter = (() => {

    const HEADER_TEXT = `SCHEDGEN ${VERSION}  ·  VISUAL TIMETABLE EXPORT`;

    async function captureFullCanvas() {
      const wrapper = DOM.timetableWrapper;
      const el      = DOM.timetable;

      const origWrapOverflow = wrapper.style.overflow;
      const origElOverflow   = el.style.overflow;
      const origScrollTop    = wrapper.scrollTop;
      const origScrollLeft   = wrapper.scrollLeft;

      wrapper.style.overflow = 'visible';
      wrapper.scrollTop      = 0;
      wrapper.scrollLeft     = 0;
      el.style.overflow      = 'visible';

      await new Promise(r => setTimeout(r, 100));

      try {
          const fullW = el.scrollWidth;
        const fullH = el.scrollHeight;
        const themeDark = state.theme === 'dark';

        const canvas = await html2canvas(el, {
          backgroundColor: themeDark ? '#101010' : '#ffffff',
          scale:           2,
          useCORS:         true,
          allowTaint:      true,
          logging:         false,
          x:               0,
          y:               0,
          width:           fullW,
          height:          fullH,
          windowWidth:     document.documentElement.scrollWidth,
          windowHeight:    document.documentElement.scrollHeight,
        });
        return canvas;
      } finally {
        wrapper.style.overflow = origWrapOverflow;
        wrapper.scrollTop      = origScrollTop;
        wrapper.scrollLeft     = origScrollLeft;
        el.style.overflow      = origElOverflow;
      }
    }

    async function buildExportCanvas() {
      const timetableCanvas = await captureFullCanvas();

      const headerH    = 56;
      const totalW     = timetableCanvas.width;
      const totalH     = timetableCanvas.height + headerH;

      const out = document.createElement('canvas');
      out.width  = totalW;
      out.height = totalH;
      const ctx  = out.getContext('2d');
      const themeDark = state.theme === 'dark';

      ctx.fillStyle = themeDark ? '#101010' : '#f0f0f0';
      ctx.fillRect(0, 0, totalW, headerH);

      ctx.fillStyle    = themeDark ? '#f4f4f4' : '#191919';
      const titleText  = 'SCHEDGEN';
      ctx.font         = `bold 28px "IBM Plex Mono", monospace`;
      ctx.textBaseline = 'middle';
      ctx.fillText(titleText, 32, headerH / 2);
      // Measure the title now, before the font changes. A later measure
      // would use the wrong font and place the version text too close.
      const titleWidth = ctx.measureText(titleText).width;

      ctx.fillStyle = themeDark ? '#cccccc' : '#888888';
      ctx.font      = `16px "IBM Plex Mono", monospace`;
      ctx.fillText(VERSION, 32 + titleWidth + 10, headerH / 2);

      const dateStr = new Date().toLocaleDateString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      });
      ctx.fillStyle   = themeDark ? '#f4f4f4' : '#191919';
      ctx.font        = `${16}px "IBM Plex Mono", monospace`;
      ctx.textAlign   = 'right';
      ctx.fillText('Generated: ' + dateStr, totalW - 32, headerH / 2);

      // Match the divider color to the current theme.
      ctx.strokeStyle = themeDark ? '#3a3a3a' : '#d0d0d0';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(0, headerH);
      ctx.lineTo(totalW, headerH);
      ctx.stroke();

      ctx.drawImage(timetableCanvas, 0, headerH);

      return out;
    }

    async function exportPNG() {
      if (!state.hasSchedule) return;
      setStatus('GENERATING PNG…', 'warning');
      try {
        const canvas = await buildExportCanvas();
        const link   = document.createElement('a');
        link.download = `schedgen-${dateSlug()}.png`;
        link.href     = canvas.toDataURL('image/png');
        link.click();
        setStatus('PNG SAVED SUCCESSFULLY', 'success');
      } catch (err) {
        console.error('[SCHEDGEN] PNG export error:', err);
        setStatus('PNG EXPORT FAILED — CHECK CONSOLE', 'error');
      }
    }

    async function exportPDF() {
      if (!state.hasSchedule) return;
      setStatus('GENERATING PDF…', 'warning');
      try {
        const canvas   = await buildExportCanvas();
        const imgData  = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;

        const aspectRatio = canvas.width / canvas.height;
        const orientation = aspectRatio >= 1 ? 'landscape' : 'portrait';

        const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

        const pageW  = pdf.internal.pageSize.getWidth();
        const pageH  = pdf.internal.pageSize.getHeight();
        const margin = 8;
        const availW = pageW - margin * 2;
        const availH = pageH - margin * 2;

        let imgW = availW;
        let imgH = imgW / (canvas.width / canvas.height);
        if (imgH > availH) { imgH = availH; imgW = imgH * (canvas.width / canvas.height); }

        const x = (pageW - imgW) / 2;
        const y = (pageH - imgH) / 2;

        pdf.addImage(imgData, 'PNG', x, y, imgW, imgH);
        pdf.save(`schedgen-${dateSlug()}.pdf`);
        setStatus('PDF SAVED SUCCESSFULLY', 'success');
      } catch (err) {
        console.error('[SCHEDGEN] PDF export error:', err);
        setStatus('PDF EXPORT FAILED — CHECK CONSOLE', 'error');
      }
    }

    function exportHTML() {
      if (!state.hasSchedule) return;
      setStatus('GENERATING HTML…', 'warning');
      try {
        let cssText = '';
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              cssText += rule.cssText + '\n';
            }
          } catch (_) { /* cross-origin — skip */ }
        }

        const dateStr  = new Date().toLocaleString();
        const ttHTML   = DOM.timetable.outerHTML;
        const isDark   = state.theme === 'dark';
        const bodyBg   = isDark ? '#050505' : '#f4f3f1';
        const textCol  = isDark ? '#f4f4f4' : '#191919';
        const panelBg  = isDark ? '#101010' : '#ffffff';
        const borderCol = isDark ? '#2a2a2a' : '#d8d6d3';
        const captionCol = isDark ? '#c6c6c6' : '#5f5f5d';

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Schedule — SCHEDGEN Export</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-font-smoothing: antialiased; }
    body { background: ${bodyBg}; color: ${textCol}; font-family: 'Space Grotesk', sans-serif; padding: 32px 24px; }
    .export-shell { max-width: 1400px; margin: 0 auto; }
    .export-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid ${borderCol}; gap: 1rem; }
    .export-header__brand { display: flex; align-items: baseline; gap: 0.5rem; font-family: 'IBM Plex Mono', monospace; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.15em; color: ${textCol}; }
    .export-header__brand span { font-size: 0.8rem; color: ${captionCol}; letter-spacing: 0.1em; }
    .export-header__meta  { font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; color: ${captionCol}; letter-spacing: 0.08em; }
    .timetable-wrapper { border: 1px solid ${borderCol}; overflow: auto; background: ${panelBg}; border-radius: 2px; }
    #timetable { display: block !important; }
    ${cssText}
  </style>
</head>
<body data-theme="${isDark ? 'dark' : 'light'}">
  <div class="export-shell">
    <div class="export-header">
      <div class="export-header__brand">SCHEDGEN <span>${VERSION}</span></div>
      <div class="export-header__meta">Generated: ${dateStr}</div>
    </div>
    <div class="timetable-wrapper">
      ${ttHTML}
    </div>
  </div>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const link = document.createElement('a');
        link.download = `schedgen-${dateSlug()}.html`;
        link.href     = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
        setStatus('HTML SAVED SUCCESSFULLY', 'success');
      } catch (err) {
        console.error('[SCHEDGEN] HTML export error:', err);
        setStatus('HTML EXPORT FAILED — CHECK CONSOLE', 'error');
      }
    }

    async function copyToClipboard() {
      if (!state.hasSchedule) return;
      setStatus('COPYING TO CLIPBOARD…', 'warning');
      try {
        const canvas = await buildExportCanvas();
        canvas.toBlob(async (blob) => {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob }),
            ]);
            setStatus('IMAGE COPIED TO CLIPBOARD', 'success');
          } catch (e) {
            console.warn('[SCHEDGEN] Clipboard write failed, falling back to download:', e);
            const link = document.createElement('a');
            link.download = `schedgen-${dateSlug()}.png`;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
            setStatus('CLIPBOARD UNAVAILABLE — FILE DOWNLOADED INSTEAD', 'warning');
          }
        }, 'image/png');
      } catch (err) {
        console.error('[SCHEDGEN] Copy error:', err);
        setStatus('COPY FAILED — CHECK CONSOLE', 'error');
      }
    }

    function printSchedule() {
      window.print();
    }

    function dateSlug() {
      const d = new Date();
      return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    }

    return { exportPNG, exportPDF, exportHTML, copyToClipboard, printSchedule };
  })();

  // Update the status bar below the textarea.
  // type is 'success' | 'warning' | 'error' | '' (neutral).
  function setStatus(text, type) {
    const el = DOM.statusText;
    if (!el) return;
    el.textContent = text;
    el.className   = 'status-text' + (type ? ` status-text--${type}` : '');
  }

  // Enable or disable all five export buttons at once.
  // Buttons are disabled until a valid schedule has been rendered.
  function setExportEnabled(enabled) {
    [DOM.btnExportPNG, DOM.btnExportPDF, DOM.btnExportHTML, DOM.btnExportCopy, DOM.btnPrint]
      .forEach(btn => { if (btn) btn.disabled = !enabled; });
  }

  // Auto-save the textarea content so the user's schedule survives a page reload.
  function saveToStorage() {
    try { localStorage.setItem(STORAGE_KEY, DOM.textarea.value); } catch (_) {}
  }

  // Restore textarea content from localStorage on page load.
  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        DOM.textarea.value = saved;
        state.rawInput     = saved;
      }
    } catch (_) {}
  }

  // Remove the saved input only. This does not clear the current textarea.
  function clearStorage() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  function updateParseCount(total, warnings) {
    const el = DOM.parseCount;
    if (!el) return;
    if (total === 0) {
      el.textContent = '';
      el.className   = 'parse-count';
      return;
    }
    el.textContent = `${total} class${total !== 1 ? 'es' : ''} · ${warnings} warn`;
    el.className   = 'parse-count' + (warnings > 0 ? ' parse-count--warn' : ' parse-count--ok');
  }

  function showWarnings(warnings) {
    const box  = DOM.warningsBox;
    const list = DOM.warningsList;
    if (!box || !list) return;
    if (!warnings.length) {
      box.hidden = true;
      return;
    }
    list.innerHTML = '';
    warnings.forEach(w => {
      const li = document.createElement('li');
      li.textContent = w;
      list.appendChild(li);
    });
    box.hidden = false;
  }

  function liveParseWarnings() {
    const raw = DOM.textarea.value.trim();
    if (!raw) { showWarnings([]); return; }
    const result = Parser.parseSchedule(raw);
    showWarnings(result.warnings);
  }

  function handleGenerate() {
    const raw = DOM.textarea.value.trim();
    if (!raw) {
      setStatus('NO INPUT — ENTER SCHEDULE DATA', 'error');
      updateParseCount(0, 0);
      return;
    }

    state.rawInput = raw;
    saveToStorage();

    const result   = Parser.parseSchedule(raw);
    state.parsedData = result;

    const totalClasses = result.days.reduce((s, d) => s + d.classes.length, 0);
    const warnCount    = result.warnings.length;

    showWarnings(result.warnings);

    if (totalClasses === 0) {
      setStatus(`NO CLASSES FOUND · ${warnCount} WARNING${warnCount !== 1 ? 'S' : ''} — CHECK FORMAT`, 'error');
      updateParseCount(0, warnCount);
      Renderer.clearTimetable();
      state.hasSchedule = false;
      setExportEnabled(false);
      return;
    }

    Renderer.renderTimetable(result);
    state.hasSchedule = true;
    setExportEnabled(true);

    const msg = `${totalClasses} CLASS${totalClasses !== 1 ? 'ES' : ''} · ${result.days.length} DAY${result.days.length !== 1 ? 'S' : ''}${warnCount > 0 ? ` · ${warnCount} WARNING${warnCount !== 1 ? 'S' : ''}` : ''}`;
    setStatus(msg, warnCount > 0 ? 'warning' : 'success');
    updateParseCount(totalClasses, warnCount);

    if (warnCount > 0) {
      console.group('[SCHEDGEN] Parse Warnings');
      result.warnings.forEach(w => console.warn(w));
      console.groupEnd();
    }
  }

  function handleClear() {
    DOM.textarea.value = '';
    state.rawInput     = '';
    state.parsedData   = null;
    state.hasSchedule  = false;
    saveToStorage();
    Renderer.clearTimetable();
    setExportEnabled(false);
    setStatus('CLEARED — READY FOR INPUT', '');
    updateParseCount(0, 0);
    showWarnings([]);
  }

  function handleClearStorage() {
    clearStorage();
    setStatus('LOCAL STORAGE CLEARED', '');
  }

  function handleLoadExample() {
    DOM.textarea.value = EXAMPLE_INPUT;
    state.rawInput     = EXAMPLE_INPUT;
    saveToStorage();
    showWarnings([]);
    handleGenerate();
  }

  // Debounce: re-generate 500 ms after the user stops typing.
  // The timer is cancelled and restarted on every keystroke.
  function scheduleAutoGenerate() {
    if (!state.autoGenerate) return;
    clearTimeout(state.autoGenTimer);
    state.autoGenTimer = setTimeout(handleGenerate, 500);
  }

  function saveTheme(theme) {
    try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
  }

  function applyTheme(theme) {
    // Set data-theme on <body>. CSS variables switch automatically.
    document.body.setAttribute('data-theme', theme);

    // The label shows the mode a click switches to, not the current mode.
    if (DOM.btnThemeToggle) {
      const nextTheme = theme === 'dark' ? 'light' : 'dark';
      DOM.btnThemeToggle.textContent = nextTheme.toUpperCase();
      DOM.btnThemeToggle.setAttribute('aria-label',
        `Current theme: ${theme}. Click to switch to ${nextTheme}.`);
    }

    state.theme = theme;

    // Redraw the timetable. Class-block colors are set inline in JS,
    // so they need a fresh render to match the new theme.
    if (state.hasSchedule && state.parsedData) {
      Renderer.renderTimetable(state.parsedData);
    }
  }

  function loadTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return saved === 'dark' ? 'dark' : DEFAULT_THEME;
    } catch (_) {
      return DEFAULT_THEME;
    }
  }

  // Open the Format Guide modal and move focus inside for keyboard users.
  function openFormatModal() {
    const modal = DOM.formatModal;
    if (!modal) return;
    modal.removeAttribute('hidden');
    modal.setAttribute('aria-hidden', 'false');
    DOM.modalClose && DOM.modalClose.focus(); // trap focus in modal
  }

  // Close the Format Guide modal and return focus to the trigger button.
  function closeFormatModal() {
    const modal = DOM.formatModal;
    if (!modal) return;
    modal.setAttribute('hidden', '');
    modal.setAttribute('aria-hidden', 'true');
    DOM.btnFormatHelp && DOM.btnFormatHelp.focus(); // restore focus
  }

  // Show/hide the input panel on mobile (≤1079px) via a CSS height transition.
  function toggleInputPanel() {
    const panel = DOM.inputPanel;
    const btn   = DOM.toggleInputBtn;
    if (!panel) return;
    const collapsed = panel.classList.toggle('input-panel--collapsed');
    if (btn) {
      btn.setAttribute('aria-expanded', String(!collapsed));
      btn.textContent = collapsed ? '▼ SHOW INPUT' : '▲ HIDE INPUT';
    }
  }

  // Attach all event listeners. init() calls this once.
  function bindEvents() {
    DOM.btnGenerate   && DOM.btnGenerate.addEventListener('click', handleGenerate);
    DOM.btnClear      && DOM.btnClear.addEventListener('click', handleClear);
    DOM.btnClearStorage && DOM.btnClearStorage.addEventListener('click', handleClearStorage);
    DOM.btnLoadExample && DOM.btnLoadExample.addEventListener('click', handleLoadExample);
    DOM.btnFormatHelp && DOM.btnFormatHelp.addEventListener('click', openFormatModal);
    DOM.modalClose    && DOM.modalClose.addEventListener('click', closeFormatModal);
    DOM.toggleInputBtn && DOM.toggleInputBtn.addEventListener('click', toggleInputPanel);

    DOM.btnExportPNG  && DOM.btnExportPNG.addEventListener('click', Exporter.exportPNG);
    DOM.btnExportPDF  && DOM.btnExportPDF.addEventListener('click', Exporter.exportPDF);
    DOM.btnExportHTML && DOM.btnExportHTML.addEventListener('click', Exporter.exportHTML);
    DOM.btnExportCopy && DOM.btnExportCopy.addEventListener('click', Exporter.copyToClipboard);
    DOM.btnPrint      && DOM.btnPrint.addEventListener('click', Exporter.printSchedule);
    DOM.btnThemeToggle && DOM.btnThemeToggle.addEventListener('click', () => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      saveTheme(nextTheme);
    });

    DOM.chkAutoGen && DOM.chkAutoGen.addEventListener('change', (e) => {
      state.autoGenerate = e.target.checked;
      try { localStorage.setItem(AUTOGEN_KEY, state.autoGenerate ? '1' : '0'); } catch (_) {}
    });

    const ta = DOM.textarea;
    if (ta) {
      ta.addEventListener('input', () => {
        state.rawInput = ta.value;
        saveToStorage();
        liveParseWarnings();
        scheduleAutoGenerate();
      });

      ta.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          handleGenerate();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = DOM.formatModal;
        if (modal && !modal.hasAttribute('hidden')) {
          e.preventDefault();
          closeFormatModal();
        }
      }
    });

    DOM.formatModal && DOM.formatModal.addEventListener('click', (e) => {
      if (e.target === DOM.formatModal) closeFormatModal();
    });
  }

  // Entry point. Runs once, when the DOM is ready.
  // Restores saved state, binds events, and applies the saved theme.
  function init() {
    loadFromStorage();
    bindEvents();
    setExportEnabled(false);

    try {
      const saved = localStorage.getItem(AUTOGEN_KEY);
      if (saved === '1') {
        state.autoGenerate = true;
        if (DOM.chkAutoGen) DOM.chkAutoGen.checked = true;
      }
    } catch (_) {}

    const theme = loadTheme();
    applyTheme(theme);

    if (DOM.textarea && DOM.textarea.value.trim()) {
      setStatus('INPUT RESTORED — PRESS GENERATE OR CTRL+ENTER', '');
    } else {
      setStatus('READY — ENTER SCHEDULE DATA OR LOAD EXAMPLE', '');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();