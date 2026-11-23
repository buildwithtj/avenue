// Prints the seed set as JSON for seed.browser.js: `node schema/seed.print.mjs`.
import { buildSeed } from './seed.data.mjs';
console.log(JSON.stringify(buildSeed()));
