import { createTheme } from '@mui/material/styles';

// University of San Diego palette (brand guide, visual identity). Accent colors
// use the guide's "on dark background" values. The guide reserves accents for
// charts, legends and small focal points, which is how they are used here.
export const USD = {
  foundersBlue: '#003b70',
  immaculataBlue: '#0074c8',
  toreroBlue: '#75bee9',
  white: '#ffffff',
  terraza: '#bab9ad',
  plaza: '#909092',
  agave: '#00bdcd',
  sagebrush: '#7bb45b',
  poppy: '#f58238',
  yarrow: '#ffd54c',
};

// Dark surfaces derived from Founders Blue.
export const SURFACE = {
  bg: '#0a1522',
  panel: '#0f1e30',
  raised: '#152840',
  line: '#22384f',
  lineSoft: '#1a2e44',
  text: '#e9eef4',
  textMuted: '#9fb1c4',
  textFaint: '#6f849a',
};

// Chart colors are USD hues stepped into the dark-mode lightness band
// (OKLCH L 0.48 to 0.67) and checked with the dataviz palette validator
// against the panel surface #0f1e30: lightness, chroma, colorblind
// separation, normal-vision separation and contrast all pass.
// Series order is fixed: Immaculata, Yarrow, Agave, Poppy.
const C_BLUE = '#1a86d6';
const C_YARROW = '#ad8a1a';
const C_AGAVE = '#0a9ba0';
const C_POPPY = '#e8681a';
const C_SAGE = '#6aa14a';
export const CHART = {
  revenue: C_BLUE,
  costs: C_YARROW,
  gross: C_AGAVE,
  cash: C_BLUE,
  negative: USD.poppy,
  series: [C_BLUE, C_YARROW, C_AGAVE, C_POPPY],
  // Validated in this order (downside, base, upside) so orange and green are never adjacent.
  scenario: { downside: C_POPPY, base: C_BLUE, upside: C_SAGE } as const,
  grid: '#1e3349',
  axis: '#8397ab',
};

export const FONT_UI = '"Sofia Sans", "Segoe UI", system-ui, sans-serif';
export const FONT_STAT = '"Sofia Sans Extra Condensed", "Sofia Sans", system-ui, sans-serif';
export const FONT_PROSE = '"Spectral", Georgia, serif';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: USD.toreroBlue, contrastText: '#06233f' },
    secondary: { main: USD.immaculataBlue },
    success: { main: USD.sagebrush },
    warning: { main: USD.yarrow },
    error: { main: USD.poppy },
    info: { main: USD.agave },
    background: { default: SURFACE.bg, paper: SURFACE.panel },
    divider: SURFACE.line,
    text: { primary: SURFACE.text, secondary: SURFACE.textMuted, disabled: SURFACE.textFaint },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: FONT_UI,
    fontSize: 14,
    h1: { fontSize: '1.9rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h2: { fontSize: '1.45rem', fontWeight: 600 },
    h3: { fontSize: '1.15rem', fontWeight: 600 },
    h4: { fontSize: '1rem', fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    overline: { letterSpacing: '0.12em', fontWeight: 600, fontSize: '0.7rem' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: SURFACE.bg, fontVariantNumeric: 'tabular-nums' },
        '.prose': { fontFamily: FONT_PROSE, fontSize: '0.98rem', lineHeight: 1.6, color: SURFACE.textMuted },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundColor: SURFACE.panel, border: `1px solid ${SURFACE.lineSoft}` } },
    },
    MuiTextField: { defaultProps: { size: 'small', variant: 'outlined' } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { backgroundColor: SURFACE.bg },
      },
    },
    MuiTooltip: {
      defaultProps: { arrow: true, enterDelay: 250 },
      styleOverrides: { tooltip: { fontSize: '0.82rem', lineHeight: 1.45, maxWidth: 340, backgroundColor: SURFACE.raised, border: `1px solid ${SURFACE.line}` }, arrow: { color: SURFACE.raised } },
    },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, minHeight: 44 } } },
    MuiTabs: { styleOverrides: { root: { minHeight: 44 } } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiTableCell: { styleOverrides: { root: { borderColor: SURFACE.lineSoft } } },
  },
});
