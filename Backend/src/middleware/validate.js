// Validates and coerces request parts with Zod schemas; the parsed values land on req.validated.
// A failure throws the ZodError, which errorHandler turns into a 400 with per-field messages.
export function validate(schemas) {
  return (req, _res, next) => {
    req.validated = {};
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const parsed = schemas[part].safeParse(req[part] ?? {});
      if (!parsed.success) throw parsed.error;
      req.validated[part] = parsed.data;
    }
    next();
  };
}
