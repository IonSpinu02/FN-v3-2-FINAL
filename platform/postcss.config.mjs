/** Tailwind v4 via PostCSS — richiesto da `next build --webpack` (prod).
 *  In dev Turbopack usa `@tailwindcss/turbopack`; senza questo file il CSS
 *  di produzione resta quasi vuoto e la UI collassa. */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
