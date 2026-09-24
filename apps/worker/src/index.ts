import { renderWithBrowserRun } from './browser';
import type { Env } from './handler';
import { createHandler } from './handler';

const handle = createHandler(renderWithBrowserRun);

export default {
  fetch: (request, env) => handle(request, env),
} satisfies ExportedHandler<Env>;
