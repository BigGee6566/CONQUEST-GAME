// Verifies that GROQ_API_KEY works by making one real chat completion.
//   npm run check:groq
import { probeGroq } from '../src/services/groq.client.js';

const result = await probeGroq();

if (result.ok) {
  console.log(`Groq OK: ${result.model} answered in ${result.latencyMs} ms`);
  console.log(`  "${result.sample}"`);
} else {
  console.error(`Groq check FAILED: ${result.error}`);
  console.error(JSON.stringify(result.status, null, 2));
  process.exitCode = 1;
}
