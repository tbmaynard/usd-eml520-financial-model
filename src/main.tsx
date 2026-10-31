import '@fontsource/sofia-sans/400.css';
import '@fontsource/sofia-sans/500.css';
import '@fontsource/sofia-sans/600.css';
import '@fontsource/sofia-sans/700.css';
import '@fontsource/sofia-sans-extra-condensed/600.css';
import '@fontsource/spectral/400.css';
import '@fontsource/spectral/400-italic.css';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { StoreProvider } from './state/store';
import { App } from './ui/App';
import { ExplainProvider } from './ui/components/explain';
import { theme } from './ui/theme';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <StoreProvider>
        <ExplainProvider>
          <App />
        </ExplainProvider>
      </StoreProvider>
    </ThemeProvider>
  </StrictMode>,
);
