// Prints the seed set as JSON for seed.browser.js: `node schema/seed.print.mjs`. Includes the real support topics (upserted by Title, never cleaned up).
import { buildSeed, buildSupportTopics } from './seed.data.mjs';
console.log(JSON.stringify([...buildSeed(), ...buildSupportTopics()]));
