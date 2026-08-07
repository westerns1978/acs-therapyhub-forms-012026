/**
 * Tailwind config — moved out of index.html 2026-08-07.
 *
 * Until this file existed, the app loaded `https://cdn.tailwindcss.com` (the Play
 * CDN RUNTIME COMPILER) and declared this whole object inline in a <script> tag.
 * That meant the entire design system was compiled in the browser on every page
 * load, behind a render-blocking request to a third party — if the CDN was
 * unreachable the app rendered as unstyled HTML, not a degraded version of
 * itself. Tailwind's own docs say the Play CDN is not for production.
 *
 * The object below is a VERBATIM port. Same darkMode, same theme.extend, same
 * ramps, same keyframes/animation/backdropBlur/boxShadow. The only additions are
 * `content` (which the CDN never needed, because it generated from the live DOM)
 * and this comment. Nothing was re-toned.
 *
 * WHAT DELIBERATELY STAYED IN index.html:
 *   · the runtime `--brand` / `--brand-focus` / `--brand-dark` setProperty calls
 *     (public/index.css reads those vars; they are CSS custom properties, not
 *     Tailwind config)
 *   · the <style> block declaring --th-slate-400/500 and --th-on-surface*, which
 *     the color slots below reference by var()
 *   · the BRAND-STATIC-COPY inventory comment
 */

// BRAND-STATIC-COPY: the brand hex now has a second home. index.html still owns
// the runtime CSS vars; this file owns the Tailwind color scale. Both are asserted
// by scripts/brandConsistencyCheck.mjs — a change here that is not mirrored there
// fails check:brand. Keep in lock-step with the BRAND object in index.html.
const BRAND = {
  DEFAULT: '#C62828',   // the ACS mark red — matches acs-logomark.svg + stlacs.com
  focus:   '#B71C1C',   // pressed / hover-darken
  content: '#FFFFFF',   // text on brand (5.6:1 on DEFAULT — AA)
  dark:    '#E57373',   // legible on the warm-charcoal dark surfaces (4.7:1 on raised #2C2B29)
  darkFocus: '#EF5350',
};

// LAYER 2 — STATUS. Warm, desaturated, deliberately BRAND-INDEPENDENT. Full
// rationale and the measured contrast ratios live in index.html's comment block;
// the values here are the port of that same ladder.
const BRICK = { 50:'#FBF3F0', 100:'#F6E3DD', 200:'#ECC7BC', 300:'#DDA28F', 400:'#D08163', 500:'#B95A3D', 600:'#A63A22', 700:'#8B2F1B', 800:'#712818', 900:'#5A2215', 950:'#31110A' };
const OCHRE = { 50:'#FCF8EE', 100:'#F7EED4', 200:'#EEDCA8', 300:'#E0C173', 400:'#CDA345', 500:'#B4841F', 600:'#955B06', 700:'#7A4A08', 800:'#6B410B', 900:'#56350C', 950:'#2F1C05' };
const SAGE  = { 50:'#F3F6F3', 100:'#E3EBE4', 200:'#C7D8CA', 300:'#A3BCA8', 400:'#7A9A81', 500:'#5F7F66', 600:'#4D6A52', 700:'#405845', 800:'#354739', 900:'#2C3A2F', 950:'#171F19' };
const STONE = { 50:'#FAFAF9', 100:'#F5F5F4', 200:'#E7E5E4', 300:'#D6D3D1', 400:'#A8A29E', 500:'#635C57', 600:'#57534E', 700:'#44403C', 800:'#292524', 900:'#1C1917', 950:'#0C0A09' };
const TERRA = { 50:'#FCF6F1', 100:'#F7E9DC', 200:'#EDD2B9', 300:'#DFB28C', 400:'#CB8D5D', 500:'#B36F3C', 600:'#955528', 700:'#7D4522', 800:'#683A20', 900:'#54301C', 950:'#2E180D' };

const STATUS_RAMPS = {
  red:     BRICK,
  rose:    BRICK,   // error cards used rose; same ink as danger, on purpose
  amber:   OCHRE,
  emerald: SAGE,
  green:   SAGE,    // both greens were in use; they must not diverge
  orange:  TERRA,
};

/** @type {import('tailwindcss').Config} */
export default {
  /* The Play CDN generated utilities on demand from the live DOM and never
     purged, so it needed no content list. A build-time scan does. These globs
     must cover every file a class name can appear in — a miss is silent (the
     class simply stops existing). Verified before the port: ZERO partial utility
     tokens built by interpolation (`bg-${…}`) and ZERO dynamically constructed
     classNames across the app, so every utility appears as a complete literal
     token in one of these files. */
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './{components,pages,layouts,contexts,hooks,config,data,services,compliance,src}/**/*.{ts,tsx,js,jsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontSize: {
        'h1': ['2.25rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
      },
      colors: {
        /* K1 SPLIT RAMP: the one slate key carries TWO ramps — SURFACE slots
           (600–950, literal hex, heavy opacity-modifier users so they must stay
           parseable) and TEXT slots (400/500, mode-flipping rgb vars declared in
           index.html's <style> block). <alpha-value> keeps ring-slate-500/20
           style modifiers working. */
        slate: {
          50: '#FAFAF9',
          100: '#F5F5F4',
          200: '#E7E5E4',
          300: '#D3D0CD',
          400: 'rgb(var(--th-slate-400) / <alpha-value>)',
          500: 'rgb(var(--th-slate-500) / <alpha-value>)',
          600: '#474441',
          700: '#383633',
          800: '#2C2B29',
          900: '#232221',
          950: '#141312',
        },
        hairline: {
          DEFAULT: '#E7E3DC',
        },
        /* K5 GRID LINES — a data grid needs more structure than a card edge, so
           it does not share a token with border/hairline. grid-line-strong meets
           the 3:1 non-text floor; grid-line is deliberately below it. */
        'grid-line': {
          DEFAULT: '#C6BCAD',
          strong:  '#9A938A',
        },
        // BRAND (layer 1) — sourced from the BRAND object above so the Attesta
        // fork changes ONE literal, not scattered hexes.
        primary: {
          DEFAULT: BRAND.DEFAULT,
          focus: BRAND.focus,
          content: BRAND.content
        },
        /* J4c — STRAYS RETIRED. `secondary` (indigo) and `accent` (cyan) were
           leftover-template hues against an institutional maroon. Both route to
           BRAND so any un-migrated call site renders on-brand. Deprecated. */
        secondary: {
          DEFAULT: BRAND.DEFAULT,
          focus: BRAND.focus,
          content: BRAND.content
        },
        accent: {
          DEFAULT: BRAND.DEFAULT,
          content: BRAND.content
        },
        background: {
          DEFAULT: '#F5F3EF',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          raised: '#FFFFFF',         // surface-2 differs by shadow, not hue
          content: '#292524',        // warm near-black
          secondary: '#475569'
        },
        /* DEFERRED #24: these four names were referenced 122x across 31 files but
           never defined — the classes compiled to NOTHING. Defined as CSS vars
           (declared in index.html's <style> block) so the ~71 call sites without
           an explicit dark: sibling still flip correctly. */
        'on-surface': {
          DEFAULT: 'var(--th-on-surface)',
          secondary: 'var(--th-on-surface-secondary)',
        },
        'surface-secondary-content': 'var(--th-on-surface-secondary)',
        'dark-surface-secondary-content': '#A8A4A0',
        // ── Semantic status tokens ───────────────────────────────────────
        //   success → sage · warning → ochre · danger → brick · neutral → stone
        // There is deliberately NO info/blue tier.
        success: SAGE,
        warning: OCHRE,
        danger:  BRICK,
        neutral: STONE,
        // DEPRECATED alias — `info` used to mean blue; resolves to neutral now.
        info:    STONE,
        // Raw families pinned to the same ramps (the slate-override move).
        red:     STATUS_RAMPS.red,
        rose:    STATUS_RAMPS.rose,
        amber:   STATUS_RAMPS.amber,
        emerald: STATUS_RAMPS.emerald,
        green:   STATUS_RAMPS.green,
        orange:  STATUS_RAMPS.orange,
        /* `blue` carries NO status meaning — it is the utility lane for
           telehealth/Zoom cues, the calendar "today" highlight, AI-provenance
           panels and file-type chips. Re-toned to institutional steel blue. Full
           scale spelled out because extend replaces a color family wholesale. */
        blue: {
          50:  '#F0F5F9',
          100: '#DEE9F2',
          200: '#C2D7E7',
          300: '#9DBCD8',
          400: '#7FA2C0',   // dark ink slot — 5.3:1 on raised #2C2B29
          500: '#47719A',   // light text slot — 5.1:1 on card
          600: '#3D6485',
          700: '#35566F',
          800: '#2C475C',
          900: '#24394A',
          950: '#1A2833',
        },
        border: {
          DEFAULT: '#DFD9D1',
        },
        /* K1 ELEVATION (dark): page #191817 / card #232221 / raised #2C2B29 /
           border #383633. Text is DECOUPLED from surface warmth. */
        dark: {
          primary: {
            DEFAULT: BRAND.dark,
            focus: BRAND.darkFocus,
          },
          // DEPRECATED — indigo secondary retired (J4c); routes to brand.
          secondary: {
            DEFAULT: BRAND.dark,
          },
          background: {
            DEFAULT: '#191817',
          },
          surface: {
            DEFAULT: '#232221',
            raised: '#2C2B29',
            content: '#EDEBE8',
            secondary: '#A8A4A0'
          },
          border: {
            DEFAULT: '#383633',
          },
          // K5 — dark grid lines, pinned to the same RATIOS as the light pair.
          'grid-line': {
            DEFAULT: '#514C45',
            strong:  '#767065',
          }
        }
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(15px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        aurora: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        }
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'aurora': 'aurora 30s ease infinite',
      },
      backdropBlur: {
        'xl': '24px',
      },
      boxShadow: {
        // K1: whisper shadow for FLAT surface-1 tiles — recovers the page-to-card
        // separation the chroma cut spent, without re-saturating the page.
        'whisper': '0 1px 2px rgba(0, 0, 0, 0.04)',
        'card': '0 1px 2px rgba(0, 0, 0, 0.06), 0 6px 16px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 1px 3px rgba(0, 0, 0, 0.08), 0 10px 24px rgba(0, 0, 0, 0.12)',
        'card-dark': '0 1px 2px rgba(0, 0, 0, 0.40), 0 6px 16px rgba(0, 0, 0, 0.50)',
        'card-hover-dark': '0 1px 3px rgba(0, 0, 0, 0.45), 0 12px 30px rgba(0, 0, 0, 0.60)',
      }
    },
  },
  plugins: [],
};
