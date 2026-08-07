/**
 * PostCSS — added 2026-08-07 with the Play CDN → build-time Tailwind port.
 * Vite picks this up automatically for any CSS it processes, which is how
 * styles/tailwind.css gets compiled into dist/assets/*.css.
 *
 * NOTE: public/index.css is NOT processed here. Vite copies public/ verbatim,
 * and that file is deliberately served as a plain <link> from index.html (it
 * holds the :root/.dark CSS-var declarations and the focus ring, and
 * scripts/brandConsistencyCheck.mjs asserts it lives under public/).
 */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
