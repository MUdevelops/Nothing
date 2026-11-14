import { useCallback, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Desktop } from '../components/desktop/Desktop';
import { Startup } from '../components/desktop/Startup';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { AppProvider } from './AppProvider';

export default function App() {
  const [booting, setBooting] = useState(true);
  const done = useCallback(() => setBooting(false), []);
  return (
    <ErrorBoundary>
      <AppProvider>
        <Desktop />
        <AnimatePresence>{booting && <Startup key="boot" onDone={done} />}</AnimatePresence>
      </AppProvider>
    </ErrorBoundary>
  );
}
