// Import FIRST in check scripts: ES imports run in order, so this empties the log tokens before src/config/env.ts runs
// dotenv (which never overrides a variable already set) and before the logger reads them. Checks never reach Axiom.
process.env.AXIOM_TOKEN = '';
process.env.LOGTAIL_SOURCE_TOKEN = '';
