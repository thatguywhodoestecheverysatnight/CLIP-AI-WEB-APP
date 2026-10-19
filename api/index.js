// Vercel serverless entry. vercel.json rewrites /api/* here with ?__path=*.
import handler from '../server/router.js';

export const config = { maxDuration: 15 };
export default handler;
