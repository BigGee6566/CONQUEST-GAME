// Vercel serverless entry point. Vercel invokes the exported Express app per request;
// the ensureDb middleware opens (or reuses) the cached MongoDB connection.
import { app } from '../src/app.js';

export default app;
