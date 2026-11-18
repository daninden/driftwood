// Shared by the smoke scripts (0.38.0 "Only him"): the language model plays him in the game, so a smoke test answers the model's requests itself, in Playwright (never in the
// game), and plays him with hands of its own where it needs a scene.
//   aiRoute(page, { plan? }) -> Promise   every request to the model's address is answered here: the list of models (any key works) and a fixed plan for a plan request
//                                         (default: he sits for an hour, PLAN_WAIT); nothing leaves the machine
//   saveKey(page) -> Promise               a key is saved before the page loads (localStorage), so the start screen does not ask for one (SMOKE_KEY)
//   installHands(page) -> Promise          in the page: window.__driftwood.input becomes a test input object of the shape game/actor fills (walking keys, a target, the action
//                                         button, the arc's choice, Z, F; `sleepKey()` and `lightKey()` press Z and F once), and step() and draw() use it, so the test plays
//                                         him and the actor does not (the view's own input stays as window.__driftwood.camera)
export const SMOKE_KEY = 'smoke-test-key';
export const PLAN_WAIT = { say: 'I sit and watch the sea.', steps: [{ wait: 60 }], minutes: 60 };

export function aiRoute(page, { plan = PLAN_WAIT } = {}) {
  const asked = { models: 0, plans: 0 };
  page.__asked = asked;
  return page.route('https://generativelanguage.googleapis.com/**', route => {
    const url = route.request().url();
    if (/\/models$/.test(url)) { asked.models++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'models/gemini-3.5-flash-lite' }] }) }); }
    asked.plans++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(plan) } }] }) });
  });
}

export const saveKey = page => page.addInitScript(k => { try { localStorage.setItem('driftwood.ai.key', k); } catch (e) { /* no storage */ } }, SMOKE_KEY);

export const installHands = page => page.evaluate(() => {
  const d = window.__driftwood;
  if (d.camera) return;
  let pressed = null, press = null, choice = null, sleep = false, light = false, woke = false;
  const H = {
    up: false, down: false, left: false, right: false, run: false, stick: null, target: null, yaw: d.view.yaw, sit: false,
    takeAction: () => { const k = pressed; pressed = null; return k; }, takeChoice: () => { const k = choice; choice = null; return k; },
    takeSleep: () => { const k = sleep; sleep = false; return k; }, takeLight: () => { const k = light; light = false; return k; }, takeWake: () => { const k = woke; woke = false; return k; },
    pressing: () => !!press, cancelAction() { if (press) press.cancelled = true; pressed = null; }, clearTarget() { H.target = null; },
    actionStart(id) { if (!press) { press = { id, cancelled: false }; woke = true; } }, actionEnd(id) { if (press && press.id === id) { if (!press.cancelled) pressed = 'tap'; press = null; } },
    choose(i) { if (Number.isInteger(i) && i >= 0 && i < 3) choice = i; }, sleepKey() { sleep = true; woke = true; }, lightKey() { light = true; },
  };
  const step0 = d.step, draw0 = d.draw;
  d.camera = d.input; d.input = H;
  d.step = (s, u) => step0(s, u, H);
  d.draw = () => draw0(H);
});
