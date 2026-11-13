/**
 * ai/config — the constants of the optional language-model chooser (0.36 "Mind"). Developer settings: the address and the model are fixed here, only the player's own key is entered (in the AI panel, render/aiPanel).
 *
 * AI_URL          the chat endpoint (OpenAI-compatible, Google AI Studio)
 * AI_MODELS_URL   the list of models the key can use (for the panel's "list models" button)
 * AI_MODELS       the models in order of preference (free Gemini models); a request goes to the first whose budget allows and that is not paused
 * AI_PER_MIN, AI_PER_DAY   the budget, PER MODEL: requests a minute and a day (the user gave 1000 a day for gemini-2.5-flash-lite on their key; the other two are assumed the same; kept below it). The day is the Pacific-time day, as Google counts it
 * AI_TIMEOUT      ms before a request is given up
 * AI_WAIT         real seconds Dave stands still at a goal or pastime decision (0.36.3), waiting for the answer (then the rules decide)
 * AI_MODES, AI_MODE_DEFAULT   the three leashes (0.36.3 "Plans"): 'strict' (every override), 'loose' (the default: only the brink of collapse and forced emergencies), 'free' (none)
 * AI_PLAN_MIN, AI_PLAN_MAX   the length of a plan asked for (a longer one is cut, a shorter one used as it is)
 * AI_AWAKE_MARGIN   how far before AWAKE_MAX (days) the loose leash overrules for tiredness
 * AI_REPLAN_GAP   real seconds between two requests (a new plan is not asked again sooner: a step that is not possible is then skipped, any other reason waits, the rules decide meanwhile)
 * AI_LOG_MAX      decisions kept in the panel's log (memory only)
 * KEY_NAME, ON_NAME, MODE_NAME, COUNT_NAME   the localStorage names: the key (only here, never in the save), whether the AI is on, the leash (0.36.3), the day's counter (COUNT_NAME + '.' + model, one per model)
 *
 * Depends on: nothing
 */
export const AI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
export const AI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/models';
export const AI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'];
export const AI_PER_MIN = 12;
export const AI_PER_DAY = 900;
export const AI_TIMEOUT = 4000;   // 0.36.1: just over AI_WAIT, so a request he no longer waits for frees the client before the next decision
export const AI_WAIT = 3;
export const AI_LOG_MAX = 100;
export const AI_MODES = ['strict', 'loose', 'free'];
export const AI_MODE_DEFAULT = 'loose';
export const AI_PLAN_MIN = 3;
export const AI_PLAN_MAX = 8;
export const AI_REPLAN_GAP = 20;
export const AI_AWAKE_MARGIN = 0.25;   // the loose leash steps in when he has been awake this much (days) less than AWAKE_MAX: 6 hours before he falls asleep where he stands (measured: 0.1 was too late, he still collapsed twice in six days under a plan that never sleeps)
export const MODE_NAME = 'driftwood.ai.mode';
export const KEY_NAME = 'driftwood.ai.key';
export const ON_NAME = 'driftwood.ai.on';
export const COUNT_NAME = 'driftwood.ai.count';
