/**
 * ai/config — the constants of the optional language-model chooser (0.36 "Mind"). Developer settings: the address and the model are fixed here, only the player's own key is entered (in the AI panel, render/aiPanel).
 *
 * AI_URL          the chat endpoint (OpenAI-compatible, Google AI Studio)
 * AI_MODELS_URL   the list of models the key can use (for the panel's "list models" button)
 * AI_MODELS       the models in order of preference (two free Gemini models, then Gemma 4; ai/client folds the system message into the first user message for 'gemma-' ids); a request goes to the first whose budget allows and that is not paused
 * AI_BUDGET      the budget PER MODEL { perMin, perDay }, a little under Google's free-tier limits as AI Studio shows them (0.36.4: gemini-3.5-flash-lite and gemini-3.1-flash-lite 14 a minute and 480 a day, gemma-4-31b-it 28 a minute and 14,000 a day; gemini-2.5-flash-lite was dropped: its free tier is only 20 requests a day). The day is the Pacific-time day, as Google counts it. Gemma also has 16K input tokens a minute: a plan request is about 3K tokens and requests are at least AI_REPLAN_GAP apart, so the request count is the limit that matters (no token counting)
 * AI_BUDGET_DEFAULT   the budget of a model that is not in AI_BUDGET (tests, a changed list)
 * AI_TIMEOUT      ms before a request is given up
 * AI_WAIT         real seconds Dave stands still at a goal or pastime decision (0.36.3), waiting for the answer (then the rules decide); 0.36.4 "Hindsight": 10 s (was 3), AI_TIMEOUT 12 s (was 4)
 * AI_MODES, AI_MODE_DEFAULT   the three leashes (0.36.3 "Plans"): 'strict' (every override), 'loose' (the default: only the brink of collapse and forced emergencies), 'free' (none)
 * AI_PLAN_MIN, AI_PLAN_MAX   the length of a plan asked for (a longer one is cut, a shorter one used as it is)
 * AI_AWAKE_MARGIN   how far before AWAKE_MAX (days) the loose leash overrules for tiredness
 * AI_REPLAN_GAP   real seconds between two requests (a new plan is not asked again sooner: a step that is not possible is then skipped, any other reason waits, the rules decide meanwhile)
 * NOTES_MAX, NOTE_LEN, JOURNAL_LEN, JOURNAL_DAYS, JOURNAL_MAX   (0.36.7 "Memory") his own notes (at most 20 lines of 80 characters), the sunset journal line (140 characters), how many days of the journal go into a plan request (3), and the most lines kept
 * AI_LOG_MAX      decisions kept in the panel's log (memory only)
 * KEY_NAME, ON_NAME, MODE_NAME, COUNT_NAME   the localStorage names: the key (only here, never in the save), whether the AI is on, the leash (0.36.3), the day's counter (COUNT_NAME + '.' + model, one per model)
 *
 * Depends on: nothing
 */
export const AI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
export const AI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/models';
export const AI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemma-4-31b-it'];
export const AI_BUDGET = {
  'gemini-3.5-flash-lite': { perMin: 14, perDay: 480 },   // Google's free tier: 15 a minute, 500 a day
  'gemini-3.1-flash-lite': { perMin: 14, perDay: 480 },   // the same
  'gemma-4-31b-it': { perMin: 28, perDay: 14000 },   // Google: 30 a minute, 14,400 a day (and 16K input tokens a minute: a plan request is about 3K and requests are at least AI_REPLAN_GAP apart, so the request count is the limit that matters)
};
export const AI_BUDGET_DEFAULT = { perMin: 12, perDay: 900 };   // a model not listed in AI_BUDGET
export const AI_TIMEOUT = 12000;   // 0.36.1: just over AI_WAIT, so a request he no longer waits for frees the client before the next decision (0.36.4: 12 s with AI_WAIT 10)
export const AI_WAIT = 10;
export const AI_LOG_MAX = 100;
export const AI_MODES = ['strict', 'loose', 'free'];
export const AI_MODE_DEFAULT = 'loose';
export const AI_PLAN_MIN = 3;
export const AI_PLAN_MAX = 8;
export const AI_REPLAN_GAP = 20;
export const AI_AWAKE_MARGIN = 0.25;   // the loose leash steps in when he has been awake this much (days) less than AWAKE_MAX: 6 hours before he falls asleep where he stands (measured: 0.1 was too late, he still collapsed twice in six days under a plan that never sleeps)
export const NOTES_MAX = 20;   // 0.36.7 "Memory": his own notes: at most this many lines of at most NOTE_LEN characters, written only by the model
export const NOTE_LEN = 80;
export const JOURNAL_LEN = 140;   // the sunset journal line: at most this many characters
export const JOURNAL_DAYS = 3;   // only the last days of the journal go into a plan request (all are kept)
export const JOURNAL_MAX = 3650;   // lines kept in all (a safety bound; ten years of days)
export const MODE_NAME = 'driftwood.ai.mode';
export const KEY_NAME = 'driftwood.ai.key';
export const ON_NAME = 'driftwood.ai.on';
export const COUNT_NAME = 'driftwood.ai.count';
