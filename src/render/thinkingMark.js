/**
 * render/thinkingMark — the quiet "thinking…" line of full AI play (0.37.1 "Half hour"): shown at the top of the screen while the game is paused because there is no plan yet.
 *
 * thinkingText(on, status) -> { text, retry } | null   pure: what the line says (null: nothing shown). status: ai/planner `status()`.
 *   thinking or idle: "thinking…"; blocked (0.38.3): a model paused ("thinking… (a model is paused, trying again in N s)"), every model spent for today ("He cannot think: ... (it resets at HH:MM)"),
 *   or none found; retrying: "thinking… (trying again in N s)"; failed: "He cannot think: <the error>" with a "try again" button.
 * createThinkingMark(el, { retry }) -> { update(on, status) }   touches the DOM only when the text changes; the button calls `retry`.
 *
 * Depends on: nothing (the DOM element is handed in)
 */
export function thinkingText(on, status) {
  if (!on) return null;
  const s = status || {};
  if (s.state === 'failed') return { text: `He cannot think: ${s.error || 'the AI does not answer'}.`, retry: true };
  if (s.state === 'retrying') return { text: `thinking… (trying again in ${s.retryIn} s)`, retry: false };
  if (s.state === 'blocked' && s.wait) {   // 0.38.3 "Steady": why no model can be asked
    const w = s.wait;
    if (w.kind === 'paused') return { text: `thinking… (a model is paused, trying again in ${w.secs} s)`, retry: false };
    if (w.kind === 'spent') return { text: `He cannot think: every model is spent for today (it resets at ${w.at}).`, retry: false };
    if (w.kind === 'dead') return { text: 'He cannot think: no model answers (reload the page to try them again).', retry: false };
  }
  return { text: 'thinking…', retry: false };
}

export function createThinkingMark(el, { retry } = {}) {
  if (!el) return { update() {} };
  const line = document.createElement('span'), btn = document.createElement('button');
  btn.type = 'button'; btn.textContent = 'try again'; btn.hidden = true;
  btn.addEventListener('click', () => { if (retry) retry(); });
  el.append(line, btn);
  let shown = '';
  return {
    update(on, status) {
      const t = thinkingText(on, status), key = t ? t.text + (t.retry ? '+' : '') : '';
      if (key === shown) return;
      shown = key;
      el.hidden = !t;
      line.textContent = t ? t.text : '';
      btn.hidden = !(t && t.retry);
    },
  };
}
