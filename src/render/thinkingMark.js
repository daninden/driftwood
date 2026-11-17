/**
 * render/thinkingMark — the quiet "thinking…" line of full AI play (0.37.1 "Half hour"): shown at the top of the screen while the game is paused because there is no plan yet.
 *
 * thinkingText(on, status) -> { text, retry } | null   pure: what the line says (null: nothing shown). status: ai/planner `status()`.
 *   thinking or idle: "thinking…"; retrying: "thinking… (trying again in N s)"; failed: "He cannot think: <the error>" with a "try again" button.
 * createThinkingMark(el, { retry }) -> { update(on, status) }   touches the DOM only when the text changes; the button calls `retry`.
 *
 * Depends on: nothing (the DOM element is handed in)
 */
export function thinkingText(on, status) {
  if (!on) return null;
  const s = status || {};
  if (s.state === 'failed') return { text: `He cannot think: ${s.error || 'the AI does not answer'}.`, retry: true };
  if (s.state === 'retrying') return { text: `thinking… (trying again in ${s.retryIn} s)`, retry: false };
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
