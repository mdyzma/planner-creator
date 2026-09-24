import { z } from 'zod';

// Zod compiles fast validators with `new Function` when it can. The hosted site's Content
// Security Policy and Cloudflare Workers both forbid that, so validate without it everywhere
// for the same behaviour in the browser, the Worker and tests.
z.config({ jitless: true });
