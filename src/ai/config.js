/**
 * ai/config — the constants of the optional language-model chooser (0.36 "Mind"). Developer settings: the address and the model are fixed here, only the player's own key is entered (in the AI panel, render/aiPanel).
 *
 * AI_URL          the chat endpoint (OpenAI-compatible, Google AI Studio)
 * AI_MODELS_URL   the list of models the key can use (for the panel's "list models" button)
 * AI_MODELS       the models in order of preference (free Gemini models); a request goes to the first whose budget allows and that is not paused
 * AI_PER_MIN, AI_PER_DAY   the budget, PER MODEL: requests a minute and a day (the user gave 1000 a day for gemini-2.5-flash-lite on their key; the other two are assumed the same; kept below it). The day is the Pacific-time day, as Google counts it
 * AI_TIMEOUT      ms before a request is given up
 * AI_FRESH        real seconds an answer may be old when it is used
 * AI_ASK_EVERY    real seconds between two requests while a goal runs (the ask-ahead pace)
 * AI_LOG_MAX      decisions kept in the panel's log (memory only)
 * KEY_NAME, ON_NAME, COUNT_NAME   the localStorage names: the key (only here, never in the save), whether the AI is on, the day's counter (COUNT_NAME + '.' + model, one per model)
 *
 * Depends on: nothing
 */
export const AI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
export const AI_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/models';
export const AI_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'];
export const AI_PER_MIN = 12;
export const AI_PER_DAY = 900;
export const AI_TIMEOUT = 15000;
export const AI_FRESH = 90;
export const AI_ASK_EVERY = 20;
export const AI_LOG_MAX = 100;
export const KEY_NAME = 'driftwood.ai.key';
export const ON_NAME = 'driftwood.ai.on';
export const COUNT_NAME = 'driftwood.ai.count';
