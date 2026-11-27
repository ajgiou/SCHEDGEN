// ============================================================
// SCHEDGEN v3.1 — Metro Monochrome
// Parser · OverlapResolver · Fitter · Renderer · Exporter · UI
// ============================================================
(() => {
  'use strict';

  // ---------- constants ----------

  const STORAGE_KEY   = 'schedgen_v2_input';
  const AUTOGEN_KEY   = 'schedgen_v2_autogen';
  const THEME_KEY     = 'schedgen_v2_theme';
  const DEFAULT_THEME = 'light';
  const VERSION       = 'v3.1';

  const SLOT_H = 44;          // px per 30 min

  // one hue, 8 shades. light theme: dark→mid. dark theme: mid→light.
  const SHADES = {
    light: ['#14273e', '#1c3854', '#24496b', '#2c5a82', '#346b99', '#3c7cb0', '#448ec7', '#4c9fde'],
    dark:  ['#4f80b8', '#5f90c6', '#6fa0d3', '#7fb0e0', '#8fc0ec', '#9fd0f5', '#afe0fd', '#bfeaff'],
  };

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

  // canvas header strip colors — keep in sync with style.css tokens
  const EXPORT_COLORS = {
    light: { bg: '#ffffff', strip: '#e7edf5', text: '#152430', sub: '#5c6f85', line: '#c5cedb' },
    dark:  { bg: '#141a20', strip: '#1a222b', text: '#e6edf5', sub: '#9fb0c2', line: '#2a3541' },
  };

  const EXAMPLE_INPUT = `Monday
• CC-102 Computer Programming 1: 8:00 AM - 11:00 AM (COM LAB 1) [Lab]
• MATH-101 College Algebra: 1:00 PM - 3:00 PM (RM 204)
• PE-101 Physical Education: 5:00 PM - 6:30 PM (GYM)
• FIL-101 Pagbasa at Pagsusuri ng Ibat Ibang Teksto Tungo sa Pananaliksik: 6:45 PM - 8:15 PM (RM 305)

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
• PE-101 Physical Education: 1:00 PM - 2:30 PM (GYM)
• SCI-101 Earth Science: 3:00 PM - 3:45 PM (RM 202) [Lecture]`;

  // ---------- state ----------

  const state = {
    parsedData: null,
    hasSchedule: false,
    autoGenerate: false,
    autoGenTimer: null,
    theme: DEFAULT_THEME,
    modalTrigger: null,
    renderToken: 0,
    lastStatus: { text: 'READY — ENTER SCHEDULE DATA', type: '' },
  };

  const DOM = {}; // element cache, filled once in cacheDom()

  function cacheDom() {
    for (const id of [
      'scheduleInput', 'btnGenerate', 'btnClear', 'btnClearStorage', 'btnLoadExample',
      'btnFormatHelp', 'statusText', 'parseCount', 'timetable', 'timetableEmpty',
      'timetableWrapper', 'btnExportPNG', 'btnExportPDF', 'btnExportHTML', 'btnExportCopy',
      'btnPrint', 'chkAutoGen', 'formatModal', 'modalClose', 'inputPanel',
      'toggleInputBtn', 'warningsBox', 'warningsList', 'btnThemeToggle',
    ]) DOM[id] = document.getElementById(id);
  }

  // ---------- util ----------

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // djb2 → stable shade index per subject code
  function shadeIndex(code) {
    let h = 5381;
    for (let i = 0; i < code.length; i++) {
      h = ((h << 5) + h) ^ code.charCodeAt(i);
      h = h >>> 0;
    }
    return h % SHADES.light.length;
  }

  function shadeFor(code) {
    return SHADES[state.theme][shadeIndex(code.toUpperCase())];
  }

  // ---------- TextFit: canvas-based text metrics ----------

  const TextFit = (() => {
    let ctx = null;

    function measure(text, font) {
      if (!ctx) ctx = document.createElement('canvas').getContext('2d');
      ctx.font = font;
      return ctx.measureText(text).width;
    }

    // greedy word wrap → line count. overlong word breaks by char.
    function wrapLines(text, maxW, font) {
      const words = String(text).split(/\s+/).filter(Boolean);
      if (!words.length) return 0;
      let lines = 0;
      let cur = 0;
      for (const w of words) {
        const wW = measure(w, font);
        if (wW > maxW) {
          if (cur > 0) { lines++; cur = 0; }
          const perLine = Math.max(1, Math.floor((w.length * maxW) / wW));
          const k = Math.ceil(w.length / perLine);
          lines += k;
          const rem = w.length - (k - 1) * perLine;
          cur = (rem / perLine) * maxW;
          continue;
        }
        if (cur === 0) { cur = wW; continue; }
        const next = cur + measure(' ', font) + wW;
        if (next <= maxW) cur = next;
        else { lines++; cur = wW; }
      }
      if (cur > 0) lines++;
      return Math.max(1, lines);
    }

    return { measure, wrapLines };
  })();

  // ---------- Parser ----------

  const Parser = (() => {
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
        if (h > 23 || min < 0 || min > 59) return null;
        return h * 60 + min;
      }

      const mBare = str.match(/^(\d{1,2})$/);
      if (mBare) {
        const h = parseInt(mBare[1], 10);
        if (h > 23) return null;
        return h * 60;
      }

      return null;
    }

    // bare hours, no AM/PM: "8 - 5" → 8AM-5PM, "12 - 3" → 12PM-3PM
    function guessAmPm(startMin, endMin, rawStart, rawEnd) {
      if (/AM|PM/i.test(rawStart) || /AM|PM/i.test(rawEnd)) {
        return { startMin, endMin };
      }
      const startH = Math.floor(startMin / 60);
      const endH   = Math.floor(endMin / 60);
      if (startH >= 1 && startH <= 12 && endH >= 1 && endH <= 12 && endH <= startH) {
        return { startMin, endMin: endMin + 720 };
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

    function normalizeDay(line) {
      const key = line.trim().toLowerCase().replace(/[^a-z]/g, '');
      return DAY_ALIASES[key] || null;
    }

    function extractTimeRange(str) {
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

      const { startMin, endMin, beforeTime } = timeData;

      const leftPart = beforeTime.replace(/[:\-–—]\s*$/, '').trim();

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
      };
    }

    function parseSchedule(rawText) {
      const lines    = rawText.split('\n');
      const days     = [];
      const warnings = [];
      let currentDay = null;
      let lineNum    = 0;

      for (const line of lines) {
        lineNum++;
        const trimmed = line.trim();
        if (!trimmed) continue;

        // comments first — never parsed as content
        if (trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

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
          warnings.push(`Line ${lineNum}: no day header — skipped`);
          continue;
        }

        const cls = parseClassLine(trimmed);
        if (cls) {
          currentDay.classes.push(cls);
        } else {
          warnings.push(`Line ${lineNum}: could not parse — "${trimmed.substring(0, 55)}${trimmed.length > 55 ? '…' : ''}"`);
        }
      }

      const filteredDays = days
        .filter(d => d.classes.length > 0)
        .sort((a, b) => DAY_NAMES.indexOf(a.day) - DAY_NAMES.indexOf(b.day));

      return { days: filteredDays, warnings };
    }

    return { parseSchedule, formatTime };
  })();

  // ---------- OverlapResolver ----------
  // side-by-side columns, fewest columns possible. dashed border marks overlap.

  const OverlapResolver = (() => {
    function resolve(classes) {
      if (!classes.length) return classes;

      const sorted = [...classes].sort((a, b) => {
        if (a.startMinutes !== b.startMinutes)
          return a.startMinutes - b.startMinutes;
        return (b.endMinutes - b.startMinutes) - (a.endMinutes - a.startMinutes);
      });

      const active = [];

      for (const cls of sorted) {
        let placed = false;
        for (let col = 0; col < active.length; col++) {
          if (active[col] <= cls.startMinutes) {
            cls._overlapCol = col;
            active[col] = cls.endMinutes;
            placed = true;
            break;
          }
        }
        if (!placed) {
          cls._overlapCol = active.length;
          active.push(cls.endMinutes);
        }
      }

      // column count is only final after every class is placed
      for (const cls of sorted) {
        cls._overlapTotal = active.length;
      }

      return classes;
    }

    return { resolve };
  })();

  // ---------- Fitter ----------
  // no truncation: pick font size + column width so every detail fits its block.
  // two layout modes so short classes keep all fields instead of hiding them:
  //   full    — code / name / time / room on separate lines
  //   compact — code / name / "time · room" on one line, tighter padding
  // blocks shorter than one slot grow to one slot, never past the next class.

  const Fitter = (() => {
    // font ladder, largest first — bigger font wins if width stays sane
    const LADDER      = [12, 11.5, 11, 10.5, 10, 9.5, 9, 8.5, 8, 7.5, 7];
    const PASS1_MAX_W = 340;   // prefer sizes fitting this width
    const PASS2_MAX_W = 560;   // fallback cap; verify pass can widen further
    const MIN_W       = 64;
    const STEP        = 8;
    const MIN_H       = 44;    // minimum block height = one slot
    const GAP         = 3;

    // metrics must match style.css .class-block / .class-block--compact
    const MODES = {
      full:    { PAD_X: 24, PAD_Y: 16 },  // padding 10+10 + borders 1+3 / 7+7 + borders 1+1
      compact: { PAD_X: 20, PAD_Y: 10 },  // padding 8+8 + borders 1+3 / 4+4 + borders 1+1
    };
    const BADGE_W = 34; // code padding-right reserve

    const mono = (px, wt) => `${wt} ${px}px "IBM Plex Mono", monospace`;
    const sans = (px) => `400 ${px}px "Open Sans", sans-serif`;

    // height needed at font f, width W
    function neededHeight(cls, f, W, mode) {
      const m      = MODES[mode];
      const innerW = W - m.PAD_X;
      const metaF  = f * 0.78;
      const rows   = [f * 1.2]; // code line (must fit one line)

      if (cls.name) {
        rows.push(TextFit.wrapLines(cls.name, innerW, sans(f * 0.92)) * f * 0.92 * 1.3);
      }
      if (mode === 'full') {
        rows.push(TextFit.wrapLines(`${cls.startTime}–${cls.endTime}`, innerW, mono(metaF, 400)) * metaF * 1.25);
        rows.push(TextFit.wrapLines(cls.room, innerW, mono(metaF, 400)) * metaF * 1.25);
      } else {
        rows.push(TextFit.wrapLines(`${cls.startTime}–${cls.endTime} · ${cls.room}`, innerW, mono(metaF, 400)) * metaF * 1.25);
      }

      return rows.reduce((a, b) => a + b, 0) + (rows.length - 1) * GAP;
    }

    // smallest width where block fits at font f; null if none ≤ maxW
    function solveWidth(cls, f, H, mode, maxW) {
      const m     = MODES[mode];
      const codeW = TextFit.measure(cls.code, mono(f, 700));
      const start = Math.max(MIN_W, codeW + m.PAD_X + BADGE_W + 2);
      for (let W = start; W <= maxW; W += STEP) {
        if (neededHeight(cls, f, W, mode) <= H - m.PAD_Y + 0.5) return W;
      }
      return null;
    }

    // per block: {f, w, mode}. prefer full layout + large font at sane width,
    // then compact, then wider columns, else smallest font (overflow → tooltip).
    function fitBlock(cls, H) {
      for (const maxW of [PASS1_MAX_W, PASS2_MAX_W]) {
        for (const mode of ['full', 'compact']) {
          for (const f of LADDER) {
            const w = solveWidth(cls, f, H, mode, maxW);
            if (w !== null) return { f, w, mode };
          }
        }
      }
      return { f: LADDER[LADDER.length - 1], w: PASS2_MAX_W, mode: 'compact' };
    }

    // height a block may occupy before covering the next class in its column
    function availableHeight(cls, classes, dayEnd) {
      let next = dayEnd - cls.startMinutes;
      for (const other of classes) {
        if (other !== cls && other._overlapCol === cls._overlapCol &&
            other.startMinutes > cls.startMinutes) {
          next = Math.min(next, other.startMinutes - cls.startMinutes);
        }
      }
      return (next / 30) * SLOT_H;
    }

    // day width = widest block × its overlap column count
    function fitDay(classes, dayEnd) {
      let dayW = 0;
      for (const cls of classes) {
        const durH = ((cls.endMinutes - cls.startMinutes) / 30) * SLOT_H;
        const H    = Math.max(durH, Math.min(MIN_H, availableHeight(cls, classes, dayEnd)));
        cls._H   = H;
        cls._fit = fitBlock(cls, H);
        dayW = Math.max(dayW, (cls._fit.w + 8) * Math.max(cls._overlapTotal, 1));
      }
      return Math.max(dayW, 132);
    }

    return { fitDay };
  })();

  // ---------- NowLine ----------
  // labeled current-time marker on today's column; refreshes itself so it
  // never goes stale or looks like a stray line.

  const NowLine = (() => {
    let line  = null;
    let label = null;
    let range = null; // { minTime, maxTime }

    function mount(dayCol, minTime, maxTime) {
      line = document.createElement('div');
      line.className = 'tt-now-line';
      line.setAttribute('aria-hidden', 'true');
      label = document.createElement('span');
      label.className = 'tt-now-line__label';
      line.appendChild(label);
      dayCol.appendChild(line);
      range = { minTime, maxTime };
      refresh();
    }

    function refresh() {
      if (!line || !range) return;
      const now  = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      const { minTime, maxTime } = range;
      const visible = mins >= minTime && mins <= maxTime;
      line.style.display = visible ? '' : 'none';
      if (visible) {
        line.style.top = `${((mins - minTime) / 30) * SLOT_H}px`;
        label.textContent = `NOW ${Parser.formatTime(mins)}`;
      }
    }

    function clear() {
      line = null;
      label = null;
      range = null;
    }

    return { mount, refresh, clear };
  })();

  // ---------- Renderer ----------

  const Renderer = (() => {

    function getTimeRange(days) {
      let min = Infinity;
      let max = -Infinity;
      for (const day of days) {
        for (const cls of day.classes) {
          if (cls.startMinutes < min) min = cls.startMinutes;
          if (cls.endMinutes   > max) max = cls.endMinutes;
        }
      }
      min = Math.max(0, Math.floor(min / 30) * 30 - 30);
      max = Math.ceil(max / 30) * 30 + 30; // no 24h clamp — overnight classes render past midnight
      return { minTime: min, maxTime: max };
    }

    function buildTooltip(cls) {
      return `${cls.code} — ${cls.name} · ${cls.startTime}–${cls.endTime} · ${cls.room} · ${cls.type}`;
    }

    // real-layout check: shrink font on vertical overflow, widen day col on horizontal
    function verifyFit(timetableEl) {
      for (let pass = 0; pass < 3; pass++) {
        let dirty = false;
        timetableEl.querySelectorAll('.class-block').forEach((b) => {
          const overH = b.scrollHeight - b.clientHeight;
          const overW = b.scrollWidth - b.clientWidth;
          if (overH > 1) {
            const cur = parseFloat(getComputedStyle(b).fontSize);
            b.style.fontSize = `${Math.max(7, cur - 1)}px`;
            dirty = true;
          }
          if (overW > 1) {
            const col = b.parentElement;
            const cur = parseFloat(col.style.minWidth) || 140;
            col.style.minWidth = `${cur + overW + 6}px`;
            dirty = true;
          }
        });
        if (!dirty) break;
      }
    }

    function renderTimetable(parsedData) {
      const { days } = parsedData;
      if (!days.length) return;

      const timetableEl = DOM.timetable;
      const { minTime, maxTime } = getTimeRange(days);
      const totalMinutes = maxTime - minTime;
      const totalHeight  = (totalMinutes / 30) * SLOT_H;

      const slots = [];
      for (let t = minTime; t <= maxTime; t += 30) slots.push(t);

      // overlaps first — fitter needs column counts; day._width from fitter
      days.forEach(day => OverlapResolver.resolve(day.classes));
      days.forEach(day => { day._width = Fitter.fitDay(day.classes, maxTime); });

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

      const nowDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });

      for (const day of days) {
        const th = document.createElement('div');
        th.className = 'tt-day-header' + (day.day === nowDay ? ' tt-day-header--today' : '');
        th.style.minWidth = `${day._width}px`; // align header with body columns
        th.setAttribute('role', 'columnheader');
        th.setAttribute('aria-label', day.day + (day.day === nowDay ? ' (today)' : ''));

        const abbr = document.createElement('span');
        abbr.className = 'tt-day-header__abbr';
        abbr.textContent = DAY_SHORT[day.day] || day.day.slice(0, 3).toUpperCase();

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
        if (slot % 60 !== 0) continue; // hour labels only
        const label = document.createElement('div');
        label.className = 'tt-time-label';
        label.style.top = `${((slot - minTime) / 30) * SLOT_H}px`;
        label.textContent = Parser.formatTime(slot);
        timeCol.appendChild(label);
      }
      body.appendChild(timeCol);

      const daysContainer = document.createElement('div');
      daysContainer.className = 'tt-days-container';
      daysContainer.setAttribute('role', 'rowgroup');

      let todayCol = null;

      for (const day of days) {
        const dayCol = document.createElement('div');
        dayCol.className = 'tt-day-col';
        dayCol.setAttribute('role', 'row');
        dayCol.dataset.day = day.day;
        if (day.day === nowDay) {
          todayCol = dayCol;
          dayCol.setAttribute('aria-current', 'day');
        }

        for (const slot of slots) {
          const gl = document.createElement('div');
          gl.className = 'tt-grid-line' + (slot % 60 === 0 ? ' tt-grid-line--hour' : '');
          gl.style.top = `${((slot - minTime) / 30) * SLOT_H}px`;
          gl.setAttribute('aria-hidden', 'true');
          dayCol.appendChild(gl);
        }

        for (const cls of day.classes) {
          const isLab   = cls.type === 'Lab';
          const { f, w } = cls._fit;
          const compact = cls._fit.mode === 'compact';
          const H       = cls._H;
          const topPx   = ((cls.startMinutes - minTime) / 30) * SLOT_H;

          const block = document.createElement('div');
          block.className = [
            'class-block',
            compact ? 'class-block--compact' : '',
            cls._overlapTotal > 1 ? 'class-block--overlap' : '',
          ].filter(Boolean).join(' ');

          block.setAttribute('role', 'gridcell');
          block.setAttribute('tabindex', '0');
          const details = buildTooltip(cls);
          block.setAttribute('aria-label', details);
          block.title = details;

          block.style.top    = `${topPx}px`;
          block.style.height = `${H}px`;
          block.style.fontSize = `${f}px`;

          if (cls._overlapTotal > 1) {
            const pct = 100 / cls._overlapTotal;
            block.style.left  = `calc(${cls._overlapCol * pct}% + 3px)`;
            block.style.width = `calc(${pct}% - 6px)`;
          } else {
            block.style.left  = '3px';
            block.style.right = '3px';
          }

          const color = shadeFor(cls.code);
          block.style.setProperty('--block-color', color);
          block.style.background = hexToRgba(color, isLab ? 0.14 : 0.06);
          block.style.borderColor = isLab ? color : hexToRgba(color, 0.55);
          block.style.borderLeftColor = color;

          const badge = document.createElement('span');
          badge.className = 'class-block__badge';
          badge.textContent = isLab ? 'LAB' : 'LEC';
          badge.setAttribute('aria-hidden', 'true');
          if (isLab) {
            badge.style.background = color;
            badge.style.color = state.theme === 'dark' ? '#0d1117' : '#ffffff';
          } else {
            badge.style.color = color;
            badge.style.border = `1px solid ${hexToRgba(color, 0.7)}`;
          }
          block.appendChild(badge);

          const codeEl = document.createElement('div');
          codeEl.className = 'class-block__code';
          codeEl.textContent = cls.code;
          block.appendChild(codeEl);

          if (cls.name) {
            const nameEl = document.createElement('div');
            nameEl.className = 'class-block__name';
            nameEl.textContent = cls.name;
            block.appendChild(nameEl);
          }

          const metaEl = document.createElement('div');
          metaEl.className = 'class-block__meta';
          metaEl.textContent = compact
            ? `${cls.startTime}–${cls.endTime} · ${cls.room}`
            : `${cls.startTime}–${cls.endTime}`;
          block.appendChild(metaEl);

          if (!compact) {
            const roomEl = document.createElement('div');
            roomEl.className = 'class-block__room';
            roomEl.textContent = cls.room;
            block.appendChild(roomEl);
          }

          dayCol.appendChild(block);
        }

        // day width from fitter — flex grows beyond it when space allows
        dayCol.style.minWidth = `${day._width}px`;

        daysContainer.appendChild(dayCol);
      }

      body.appendChild(daysContainer);
      timetableEl.appendChild(body);

      DOM.timetable.style.display = 'block';
      DOM.timetableEmpty.style.display = 'none';

      verifyFit(timetableEl);

      if (todayCol) NowLine.mount(todayCol, minTime, maxTime);
      else NowLine.clear();
    }

    function clearTimetable() {
      DOM.timetable.innerHTML = '';
      DOM.timetable.style.display = 'none';
      DOM.timetableEmpty.style.display = 'flex';
      NowLine.clear();
    }

    return { renderTimetable, clearTimetable };
  })();

  // ---------- Exporter ----------

  const Exporter = (() => {

    function triggerDownload(href, filename) {
      const link = document.createElement('a');
      link.href = href;
      link.download = filename;
      link.rel = 'noopener';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (href.startsWith('blob:')) {
        setTimeout(() => URL.revokeObjectURL(href), 1000);
      }
    }

    function dateSlug() {
      const d = new Date();
      return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    }

    async function captureFullCanvas() {
      const wrapper = DOM.timetableWrapper;
      const el = DOM.timetable;

      const origWrapOverflow = wrapper.style.overflow;
      const origScrollTop    = wrapper.scrollTop;
      const origScrollLeft   = wrapper.scrollLeft;

      wrapper.style.overflow = 'visible';
      wrapper.scrollTop = 0;
      wrapper.scrollLeft = 0;

      await new Promise(r => setTimeout(r, 100));

      try {
        return await html2canvas(el, {
          backgroundColor: EXPORT_COLORS[state.theme].bg,
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          x: 0,
          y: 0,
          width: el.scrollWidth,
          height: el.scrollHeight,
          windowWidth: document.documentElement.scrollWidth,
          windowHeight: document.documentElement.scrollHeight,
        });
      } finally {
        wrapper.style.overflow = origWrapOverflow;
        wrapper.scrollTop = origScrollTop;
        wrapper.scrollLeft = origScrollLeft;
      }
    }

    async function buildExportCanvas() {
      const tt = await captureFullCanvas();
      const c = EXPORT_COLORS[state.theme];

      const headerH = 56;
      const totalW = tt.width;
      const totalH = tt.height + headerH;

      const out = document.createElement('canvas');
      out.width = totalW;
      out.height = totalH;
      const ctx = out.getContext('2d');

      ctx.fillStyle = c.strip;
      ctx.fillRect(0, 0, totalW, headerH);

      ctx.fillStyle = c.text;
      ctx.font = `700 28px "IBM Plex Mono", monospace`;
      ctx.textBaseline = 'middle';
      ctx.fillText('SCHEDGEN', 32, headerH / 2);
      const titleWidth = ctx.measureText('SCHEDGEN').width;

      ctx.fillStyle = c.sub;
      ctx.font = `400 16px "IBM Plex Mono", monospace`;
      ctx.fillText(VERSION, 32 + titleWidth + 10, headerH / 2);

      const dateStr = new Date().toLocaleDateString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      });
      ctx.fillStyle = c.text;
      ctx.font = `400 16px "IBM Plex Mono", monospace`;
      ctx.textAlign = 'right';
      ctx.fillText('Generated: ' + dateStr, totalW - 32, headerH / 2);

      ctx.strokeStyle = c.line;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, headerH);
      ctx.lineTo(totalW, headerH);
      ctx.stroke();

      ctx.drawImage(tt, 0, headerH);
      return out;
    }

    async function exportPNG() {
      if (!state.hasSchedule) return;
      setStatus('GENERATING PNG…', 'warn');
      try {
        const canvas = await buildExportCanvas();
        triggerDownload(canvas.toDataURL('image/png'), `schedgen-${dateSlug()}.png`);
        setStatus('PNG SAVED', 'ok');
      } catch (err) {
        console.error('[SCHEDGEN] PNG export error:', err);
        setStatus('PNG EXPORT FAILED — CHECK CONSOLE', 'err');
      }
    }

    async function exportPDF() {
      if (!state.hasSchedule) return;
      setStatus('GENERATING PDF…', 'warn');
      try {
        const canvas = await buildExportCanvas();
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;

        const orientation = canvas.width / canvas.height >= 1 ? 'landscape' : 'portrait';
        const pdf = new jsPDF({ orientation, unit: 'mm', format: 'A4' });

        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 8;
        const availW = pageW - margin * 2;
        const availH = pageH - margin * 2;

        let imgW = availW;
        let imgH = imgW * (canvas.height / canvas.width);
        if (imgH > availH) {
          imgH = availH;
          imgW = imgH * (canvas.width / canvas.height);
        }

        pdf.addImage(imgData, 'PNG', (pageW - imgW) / 2, (pageH - imgH) / 2, imgW, imgH);
        pdf.save(`schedgen-${dateSlug()}.pdf`);
        setStatus('PDF SAVED', 'ok');
      } catch (err) {
        console.error('[SCHEDGEN] PDF export error:', err);
        setStatus('PDF EXPORT FAILED — CHECK CONSOLE', 'err');
      }
    }

    function exportHTML() {
      if (!state.hasSchedule) return;
      setStatus('GENERATING HTML…', 'warn');
      try {
        let cssText = '';
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) cssText += rule.cssText + '\n';
          } catch (_) { /* cross-origin — skip */ }
        }

        const c = EXPORT_COLORS[state.theme];
        const dateStr = new Date().toLocaleString();
        const ttHTML = DOM.timetable.outerHTML;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Schedule — SCHEDGEN Export</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { -webkit-font-smoothing: antialiased; }
    body { background: ${c.bg}; color: ${c.text}; font-family: 'Open Sans', sans-serif; padding: 32px 24px; }
    .export-shell { max-width: 1400px; margin: 0 auto; }
    .export-header { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid ${c.line}; }
    .export-header__brand { font-family: 'IBM Plex Mono', monospace; font-size: 1.25rem; font-weight: 700; letter-spacing: 0.2em; }
    .export-header__brand span { font-size: 0.8rem; color: ${c.sub}; letter-spacing: 0.1em; margin-left: 8px; }
    .export-header__meta { font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; color: ${c.sub}; letter-spacing: 0.08em; }
    #timetable { display: block !important; }
    ${cssText}
  </style>
</head>
<body data-theme="${state.theme}">
  <div class="export-shell">
    <div class="export-header">
      <div class="export-header__brand">SCHEDGEN<span>${VERSION}</span></div>
      <div class="export-header__meta">Generated: ${dateStr}</div>
    </div>
    <div class="timetable-wrapper">
      ${ttHTML}
    </div>
  </div>
</body>
</html>`;

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        triggerDownload(URL.createObjectURL(blob), `schedgen-${dateSlug()}.html`);
        setStatus('HTML SAVED', 'ok');
      } catch (err) {
        console.error('[SCHEDGEN] HTML export error:', err);
        setStatus('HTML EXPORT FAILED — CHECK CONSOLE', 'err');
      }
    }

    async function copyToClipboard() {
      if (!state.hasSchedule) return;
      setStatus('COPYING…', 'warn');
      try {
        const canvas = await buildExportCanvas();
        canvas.toBlob(async (blob) => {
          try {
            if (!blob) throw new Error('canvas.toBlob returned null');
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob }),
            ]);
            setStatus('IMAGE COPIED', 'ok');
          } catch (e) {
            console.warn('[SCHEDGEN] Clipboard write failed, downloading instead:', e);
            if (blob) triggerDownload(URL.createObjectURL(blob), `schedgen-${dateSlug()}.png`);
            setStatus('CLIPBOARD UNAVAILABLE — FILE SAVED INSTEAD', 'warn');
          }
        }, 'image/png');
      } catch (err) {
        console.error('[SCHEDGEN] Copy error:', err);
        setStatus('COPY FAILED — CHECK CONSOLE', 'err');
      }
    }

    function printSchedule() {
      window.print();
    }

    return { exportPNG, exportPDF, exportHTML, copyToClipboard, printSchedule };
  })();

  // ---------- UI ----------

  function setStatus(text, type) {
    const el = DOM.statusText;
    if (!el) return;
    el.textContent = text;
    el.className = 'status-text' + (type ? ` status-text--${type}` : '');
    state.lastStatus = { text, type };
  }

  function setExportEnabled(enabled) {
    [DOM.btnExportPNG, DOM.btnExportPDF, DOM.btnExportHTML, DOM.btnExportCopy, DOM.btnPrint]
      .forEach(btn => { if (btn) btn.disabled = !enabled; });
  }

  function saveToStorage() {
    try { localStorage.setItem(STORAGE_KEY, DOM.scheduleInput.value); } catch (_) {}
  }

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) DOM.scheduleInput.value = saved;
    } catch (_) {}
  }

  function updateParseCount(total, warnings) {
    const el = DOM.parseCount;
    if (!el) return;
    if (total === 0 && warnings === 0) {
      el.textContent = '';
      el.className = 'parse-count';
      return;
    }
    el.textContent = `${total} CLASS${total !== 1 ? 'ES' : ''} · ${warnings} WARN`;
    el.className = 'parse-count' + (warnings > 0 ? ' parse-count--warn' : ' parse-count--ok');
  }

  function showWarnings(warnings) {
    const box = DOM.warningsBox;
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
    const raw = DOM.scheduleInput.value.trim();
    if (!raw) { showWarnings([]); return; }
    showWarnings(Parser.parseSchedule(raw).warnings);
  }

  function scrollToTimetableOnMobile() {
    if (!window.matchMedia('(max-width: 1079px)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    DOM.timetableWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // opts.scroll = false for background renders (auto-generate) — never scrolls
  // the page while the user is typing.
  async function handleGenerate(opts = {}) {
    const raw = DOM.scheduleInput.value.trim();
    if (!raw) {
      setStatus('NO INPUT — ENTER SCHEDULE DATA', 'err');
      updateParseCount(0, 0);
      showWarnings([]);
      return;
    }

    saveToStorage();

    const result = Parser.parseSchedule(raw);
    state.parsedData = result;

    const totalClasses = result.days.reduce((s, d) => s + d.classes.length, 0);
    const warnCount = result.warnings.length;

    showWarnings(result.warnings);
    updateParseCount(totalClasses, warnCount);

    if (totalClasses === 0) {
      setStatus(`NO CLASSES FOUND · ${warnCount} WARN${warnCount !== 1 ? 'S' : ''} — CHECK FORMAT`, 'err');
      Renderer.clearTimetable();
      state.hasSchedule = false;
      setExportEnabled(false);
      return;
    }

    // fonts must be loaded before canvas text measurement
    const token = ++state.renderToken;
    await document.fonts.ready;
    if (token !== state.renderToken) return; // stale render — skip

    Renderer.renderTimetable(result);
    state.hasSchedule = true;
    setExportEnabled(true);

    setStatus(
      `${totalClasses} CLASS${totalClasses !== 1 ? 'ES' : ''} · ${result.days.length} DAY${result.days.length !== 1 ? 'S' : ''}${warnCount > 0 ? ` · ${warnCount} WARN${warnCount !== 1 ? 'S' : ''}` : ''}`,
      warnCount > 0 ? 'warn' : 'ok'
    );

    if (warnCount > 0) {
      console.group('[SCHEDGEN] Parse Warnings');
      result.warnings.forEach(w => console.warn(w));
      console.groupEnd();
    }

    if (opts.scroll !== false) scrollToTimetableOnMobile();
  }

  function handleClear() {
    DOM.scheduleInput.value = '';
    state.parsedData = null;
    state.hasSchedule = false;
    saveToStorage();
    Renderer.clearTimetable();
    setExportEnabled(false);
    setStatus('CLEARED', '');
    updateParseCount(0, 0);
    showWarnings([]);
  }

  function handleClearStorage() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    setStatus('STORAGE CLEARED', '');
  }

  function handleLoadExample() {
    DOM.scheduleInput.value = EXAMPLE_INPUT;
    showWarnings([]);
    handleGenerate();
  }

  function scheduleAutoGenerate() {
    if (!state.autoGenerate) return;
    clearTimeout(state.autoGenTimer);
    state.autoGenTimer = setTimeout(() => handleGenerate({ scroll: false }), 500);
  }

  function saveTheme(theme) {
    try { localStorage.setItem(THEME_KEY, theme); } catch (_) {}
  }

  // re-render the already-parsed schedule — a theme switch must not re-parse
  // the textarea (that would silently generate text the user never confirmed)
  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    state.theme = theme;

    if (DOM.btnThemeToggle) {
      const next = theme === 'dark' ? 'light' : 'dark';
      DOM.btnThemeToggle.textContent = next.toUpperCase();
      DOM.btnThemeToggle.setAttribute('aria-label',
        `Current theme: ${theme}. Click to switch to ${next}.`);
    }

    if (state.hasSchedule && state.parsedData) Renderer.renderTimetable(state.parsedData);
  }

  function loadTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return saved === 'dark' ? 'dark' : DEFAULT_THEME;
    } catch (_) {
      return DEFAULT_THEME;
    }
  }

  function openFormatModal() {
    const modal = DOM.formatModal;
    if (!modal) return;
    state.modalTrigger = document.activeElement;
    modal.removeAttribute('hidden');
    modal.setAttribute('aria-hidden', 'false');
    if (DOM.modalClose) DOM.modalClose.focus();
  }

  function closeFormatModal() {
    const modal = DOM.formatModal;
    if (!modal) return;
    modal.setAttribute('hidden', '');
    modal.setAttribute('aria-hidden', 'true');
    const trigger = state.modalTrigger || DOM.btnFormatHelp;
    if (trigger && typeof trigger.focus === 'function') trigger.focus();
    state.modalTrigger = null;
  }

  function trapModalFocus(e) {
    const modal = DOM.formatModal;
    if (!modal || modal.hasAttribute('hidden') || e.key !== 'Tab') return;

    const focusable = [...modal.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )];
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function toggleInputPanel() {
    const panel = DOM.inputPanel;
    const btn = DOM.toggleInputBtn;
    if (!panel) return;
    const collapsed = panel.classList.toggle('input-panel--collapsed');
    if (btn) {
      btn.setAttribute('aria-expanded', String(!collapsed));
      btn.textContent = collapsed ? '▼ SHOW INPUT' : '▲ HIDE INPUT';
    }
  }

  // focused block → full details in status line
  function showBlockDetails(block) {
    const el = DOM.statusText;
    if (!el || !block) return;
    el.textContent = block.getAttribute('aria-label') || '';
  }

  function restoreStatus() {
    setStatus(state.lastStatus.text, state.lastStatus.type);
  }

  function bindEvents() {
    DOM.btnGenerate.addEventListener('click', () => handleGenerate());
    DOM.btnClear.addEventListener('click', handleClear);
    DOM.btnClearStorage.addEventListener('click', handleClearStorage);
    DOM.btnLoadExample.addEventListener('click', handleLoadExample);
    DOM.btnFormatHelp.addEventListener('click', openFormatModal);
    DOM.modalClose.addEventListener('click', closeFormatModal);
    DOM.toggleInputBtn.addEventListener('click', toggleInputPanel);

    DOM.btnExportPNG.addEventListener('click', Exporter.exportPNG);
    DOM.btnExportPDF.addEventListener('click', Exporter.exportPDF);
    DOM.btnExportHTML.addEventListener('click', Exporter.exportHTML);
    DOM.btnExportCopy.addEventListener('click', Exporter.copyToClipboard);
    DOM.btnPrint.addEventListener('click', Exporter.printSchedule);

    DOM.btnThemeToggle.addEventListener('click', () => {
      const next = state.theme === 'dark' ? 'light' : 'dark';
      saveTheme(next);
      applyTheme(next);
    });

    DOM.chkAutoGen.addEventListener('change', (e) => {
      state.autoGenerate = e.target.checked;
      try { localStorage.setItem(AUTOGEN_KEY, state.autoGenerate ? '1' : '0'); } catch (_) {}
    });

    const tt = DOM.timetable;
    tt.addEventListener('focusin', (e) => {
      const block = e.target.closest('.class-block');
      if (block) showBlockDetails(block);
    });
    tt.addEventListener('focusout', () => restoreStatus());
    tt.addEventListener('keydown', (e) => {
      const block = e.target.closest('.class-block');
      if (block && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        showBlockDetails(block);
      }
    });

    const ta = DOM.scheduleInput;
    ta.addEventListener('input', () => {
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

    document.addEventListener('keydown', (e) => {
      trapModalFocus(e);
      if (e.key === 'Escape') {
        const modal = DOM.formatModal;
        if (modal && !modal.hasAttribute('hidden')) {
          e.preventDefault();
          closeFormatModal();
        }
      }
    });

    DOM.formatModal.addEventListener('click', (e) => {
      if (e.target === DOM.formatModal) closeFormatModal();
    });
  }

  function init() {
    cacheDom();
    loadFromStorage();
    bindEvents();
    setExportEnabled(false);

    try {
      if (localStorage.getItem(AUTOGEN_KEY) === '1') {
        state.autoGenerate = true;
        if (DOM.chkAutoGen) DOM.chkAutoGen.checked = true;
      }
    } catch (_) {}

    applyTheme(loadTheme());

    // keep the NOW marker accurate while the page stays open
    setInterval(NowLine.refresh, 30000);

    if (DOM.scheduleInput && DOM.scheduleInput.value.trim()) {
      setStatus('INPUT RESTORED — PRESS GENERATE', '');
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
