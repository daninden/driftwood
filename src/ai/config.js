/**
 * ai/config — the constants of the language model that plays Dave (0.36 "Mind"; since 0.38.0 "Only him" the only way to play). Developer settings: the address and the models
 * are fixed here, only the player's own key is entered (on the start screen, render/startScreen, or in the AI panel, render/aiPanel).
 *
 * AI_URL          the chat endpoint (OpenAI-compatible, Google AI Studio)
 * AI_MODELS_URL   the list of models the key can use (the start screen checks a key with it; the panel's "list models" button)
 * AI_MODELS       the models in order of preference (two free Gemini models, 3.1 first since 0.43.2 for its speed, then Gemma 4; ai/client folds the system message into the first user message for 'gemma-' ids); a request goes to the first whose budget allows and that is not paused
 * AI_BUDGET       the budget PER MODEL { perMin, perDay }, a little under Google's free-tier limits as AI Studio shows them (0.36.4: gemini-3.5-flash-lite and gemini-3.1-flash-lite 14 a minute and 480 a day, gemma-4-31b-it 28 a minute and 14,000 a day). The day is the Pacific-time day, as Google counts it
 * AI_BUDGET_DEFAULT   the budget of a model that is not in AI_BUDGET (tests, a changed list)
 * AI_TIMEOUT      ms before a request is given up
 * AI_LOG_MAX      requests kept in the panel's log (memory only)
 * LESSONS_MAX (10), LESSON_LEN (140)   (0.37.4 "Lessons") his lessons: at most 10 kept, the model may merge or drop them when the list is full
 * RECENT_SHOWN    (0.37.10) the records of what he did lately in a plan request (12)
 * NOTES_MAX, NOTE_LEN   (0.36.7 "Memory") his own notes: at most 20 lines of 80 characters
 * SAID_LEN        (0.36.9 "Voice") the longest thought the request asks for, 140 characters (the same as render/voice SAID_MAX)
 * KEY_NAME, COUNT_NAME   the localStorage names: the key (only here, never in the save) and the day's counter (COUNT_NAME + '.' + model, one per model)
 *
 * Depends on: nothing
 */
export const AI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
export const AI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/models';
export const AI_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemma-4-31b-it'];   // 0.43.2 (the user, 2026-11-20): 3.1 first: it answered in 1 to 4 s where 3.5 took 7 to 11
export const AI_BUDGET = {
  'gemini-3.5-flash-lite': { perMin: 14, perDay: 480 },   // Google's free tier: 15 a minute, 500 a day
  'gemini-3.1-flash-lite': { perMin: 14, perDay: 480 },   // the same
  'gemma-4-31b-it': { perMin: 28, perDay: 14000 },   // Google: 30 a minute, 14,400 a day (and 16K input tokens a minute: a plan request is about 4K and requests come a few seconds apart at most, so the request count is the limit that matters)
};
export const AI_BUDGET_DEFAULT = { perMin: 12, perDay: 900 };   // a model not listed in AI_BUDGET
export const AI_TIMEOUT = 12000;
export const AI_LOG_MAX = 100;
export const RECENT_SHOWN = 12;   // 0.37.10 "Body": the last records of game/actor `recent` a plan request shows (ai/planner; the rules say the number)
export const NOTES_MAX = 20;   // 0.36.7 "Memory": his own notes: at most this many lines of at most NOTE_LEN characters, written only by the model
export const NOTE_LEN = 80;
export const SAID_LEN = 140;   // 0.36.9 "Voice": the longest thought shown above Dave (render/voice SAID_MAX is the same number)
export const LESSONS_MAX = 10;   // 0.37.4 "Lessons": the lessons of the days (one asked at sunset): at most this many kept, each at most LESSON_LEN characters
export const LESSON_LEN = 140;
export const KEY_NAME = 'driftwood.ai.key';
export const COUNT_NAME = 'driftwood.ai.count';
