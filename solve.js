// Fast drop-in for csv-reader 1.0.0: identical answers, less CPU.
// Written from the prose specification (DESIGN.md) only.
//
// Strategy: one left-to-right pass. Per record, first look ahead to the
// next LF: when the record holds no quote and no stray CR, it is a plain
// line and each field costs a single indexOf(',') plus one slice. Records
// with quotes or stray CRs take the general path, where every field is
// found with indexOf scans and sliced whole -- never char by char -- and
// the next CR is tracked once per record so fields without one cost only
// two indexOf calls. Results are built straight into the answer arrays.

export function run(input) {
  const text = input.text;
  const header = input.header;
  const n = text.length;
  let i = 0;
  if (n > 0 && text.charCodeAt(0) === 0xfeff) i = 1;
  let line = 1;
  let rec = 0;
  let width = -1;
  let columns = null;
  const rows = [];
  const errors = [];
  const rowOf = (r) => (header ? (r === 0 ? null : r - 1) : r);

  function emit(fields, startLine) {
    if (rec === 0) {
      width = fields.length;
      if (header) columns = fields;
      else rows.push(fields);
    } else if (fields.length < width) {
      errors.push({ code: 'short_row', line: startLine, row: rowOf(rec), fields: fields.length });
      while (fields.length < width) fields.push('');
      rows.push(fields);
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: startLine, row: rowOf(rec), extra: fields.slice(width) });
      fields.length = width;
      rows.push(fields);
    } else {
      rows.push(fields);
    }
    rec++;
  }

  while (i < n) {
    const startLine = line;
    const recStart = i;
    const ch0 = text.charCodeAt(i);
    if (ch0 === 10) { i++; line++; continue; } // empty line: no record
    if (ch0 === 13 && text.charCodeAt(i + 1) === 10) { i += 2; line++; continue; }

    // Look ahead to the next LF: the record ends there unless a quote opens
    // a field that spans lines.
    const nl = text.indexOf('\n', i);
    const segEnd = nl === -1 ? n : nl;
    const q = text.indexOf('"', i);
    const hasQuote = q !== -1 && q < segEnd;
    const cr = text.indexOf('\r', i);
    // A CR just before the LF is the CRLF terminator, not a stray CR.
    const hasStrayCR = cr !== -1 && cr < segEnd && !(nl !== -1 && cr === nl - 1);

    if (!hasQuote && !hasStrayCR) {
      // Plain record: fields separated by commas, no quotes, no stray CR.
      // The record's content ends before the CR of a CRLF terminator.
      const contentEnd = nl !== -1 && nl > i && text.charCodeAt(nl - 1) === 13 ? nl - 1 : segEnd;
      const fields = [];
      let f = i;
      for (;;) {
        const c = text.indexOf(',', f);
        if (c === -1 || c >= contentEnd) { fields.push(text.slice(f, contentEnd)); break; }
        fields.push(text.slice(f, c));
        f = c + 1;
      }
      if (nl === -1) i = n;
      else { i = nl + 1; line++; }
      emit(fields, startLine);
      continue;
    }

    // General record: quotes and/or stray CRs present.
    const fields = [];
    let nextCR = cr; // next CR at or after the record start (cr < segEnd here
    // only when it is a stray CR or inside a quoted span; kept fresh below)
    let done = false;
    while (!done) {
      if (nextCR !== -1 && nextCR < i) nextCR = text.indexOf('\r', i);
      let v;
      let end; // 0 = EOF, 1 = comma, 2 = end of line
      let ni;
      let nline;
      if (i < n && text.charCodeAt(i) === 34) {
        // Quoted field: scan for the closing quote ("" is one quote).
        let j = i + 1;
        let closing = -1;
        let escaped = false;
        for (;;) {
          const k = text.indexOf('"', j);
          if (k === -1) break;
          if (k + 1 < n && text.charCodeAt(k + 1) === 34) { escaped = true; j = k + 2; continue; }
          closing = k;
          break;
        }
        if (closing === -1) {
          // Unterminated quote: the quote is literal, the rest is re-read
          // as an unquoted field.
          errors.push({ code: 'unterminated_quote', line: startLine, row: rowOf(rec) });
          // fall through to the unquoted parse below
        } else {
          const span = text.slice(i + 1, closing);
          const hasNL = span.indexOf('\n') !== -1;
          const hasCR = span.indexOf('\r') !== -1;
          let curLine = line;
          if (!escaped && !hasNL && !hasCR) {
            v = span;
          } else if (!hasNL && !hasCR) {
            v = span.replace(/""/g, '"');
          } else {
            let breaks = 0;
            for (let s = 0; s < span.length; s++) {
              const ch = span.charCodeAt(s);
              if (ch === 10) breaks++;
              else if (ch === 13 && span.charCodeAt(s + 1) !== 10) breaks++;
            }
            curLine = line + breaks;
            v = span.replace(/\r\n?/g, '\n');
            if (escaped) v = v.replace(/""/g, '"');
          }
          // Junk after the closing quote, up to the next comma or line break.
          // Usually there is none: the next character is the delimiter itself.
          const aj = closing + 1;
          if (aj >= n) {
            end = 0; ni = n; nline = curLine;
          } else {
            const ac = text.charCodeAt(aj);
            if (ac === 44) { end = 1; ni = aj + 1; nline = curLine; }
            else if (ac === 10) { end = 2; ni = aj + 1; nline = curLine + 1; }
            else if (ac === 13 && text.charCodeAt(aj + 1) === 10) { end = 2; ni = aj + 2; nline = curLine + 1; }
            else {
              if (nextCR !== -1 && nextCR < aj) nextCR = text.indexOf('\r', aj);
              let p = aj;
              let segStart = p;
              let parts = null;
              let junkEnd = n;
              for (;;) {
                const c = text.indexOf(',', p);
                const lf = text.indexOf('\n', p);
                let m = n;
                let kind = 0;
                if (c !== -1 && c < m) { m = c; kind = 1; }
                if (lf !== -1 && lf < m) { m = lf; kind = 2; }
                if (nextCR !== -1 && nextCR < m) {
                  if (text.charCodeAt(nextCR + 1) === 10) {
                    junkEnd = nextCR; end = 2; ni = nextCR + 2; nline = curLine + 1;
                    nextCR = text.indexOf('\r', ni);
                    break;
                  }
                  errors.push({ code: 'stray_cr', line: startLine, row: rowOf(rec) });
                  if (parts === null) parts = [text.slice(segStart, nextCR)];
                  else parts.push(text.slice(segStart, nextCR));
                  segStart = nextCR + 1;
                  p = nextCR + 1;
                  nextCR = text.indexOf('\r', p);
                  continue;
                }
                if (kind === 0) { junkEnd = n; end = 0; ni = n; nline = curLine; }
                else if (kind === 1) { junkEnd = m; end = 1; ni = m + 1; nline = curLine; }
                else { junkEnd = m; end = 2; ni = m + 1; nline = curLine + 1; }
                break;
              }
              if (junkEnd > aj) {
                v += parts ? parts.join('') + text.slice(segStart, junkEnd) : text.slice(aj, junkEnd);
                errors.push({ code: 'quote_junk', line: startLine, row: rowOf(rec) });
              }
            }
          }
          fields.push(v);
          i = ni;
          line = nline;
          if (end === 1) continue;
          done = true;
          continue;
        }
      }
      // Unquoted field (also the re-read after an unterminated quote).
      {
        let p = i;
        let segStart = p;
        let parts = null;
        for (;;) {
          const c = text.indexOf(',', p);
          const lf = text.indexOf('\n', p);
          let m = n;
          let kind = 0;
          if (c !== -1 && c < m) { m = c; kind = 1; }
          if (lf !== -1 && lf < m) { m = lf; kind = 2; }
          if (nextCR !== -1 && nextCR < m) {
            if (text.charCodeAt(nextCR + 1) === 10) {
              const tail = text.slice(segStart, nextCR);
              v = parts ? parts.join('') + tail : tail;
              end = 2; ni = nextCR + 2; nline = line + 1;
              nextCR = text.indexOf('\r', ni);
              break;
            }
            errors.push({ code: 'stray_cr', line: startLine, row: rowOf(rec) });
            if (parts === null) parts = [text.slice(segStart, nextCR)];
            else parts.push(text.slice(segStart, nextCR));
            segStart = nextCR + 1;
            p = nextCR + 1;
            nextCR = text.indexOf('\r', p);
            continue;
          }
          if (kind === 0) {
            const tail = text.slice(segStart, n);
            v = parts ? parts.join('') + tail : tail;
            end = 0; ni = n; nline = line;
          } else if (kind === 1) {
            const tail = text.slice(segStart, m);
            v = parts ? parts.join('') + tail : tail;
            end = 1; ni = m + 1; nline = line;
          } else {
            const tail = text.slice(segStart, m);
            v = parts ? parts.join('') + tail : tail;
            end = 2; ni = m + 1; nline = line + 1;
          }
          break;
        }
      }
      fields.push(v);
      i = ni;
      line = nline;
      if (end === 1) continue;
      done = true;
    }
    // A record made only of dropped CRs is no record.
    if (fields.length === 1 && fields[0] === '') {
      let onlyCR = i > recStart;
      for (let s = recStart; s < i; s++) {
        if (text.charCodeAt(s) !== 13) { onlyCR = false; break; }
      }
      if (onlyCR) continue;
    }
    emit(fields, startLine);
  }
  return { columns, rows, errors };
}
