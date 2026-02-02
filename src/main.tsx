import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress React DevTools installation message in console
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  const suppressDevToolsMessage = (method: keyof Console) => {
    const original = console[method] as (...args: any[]) => void;
    (console[method] as any) = (...args: any[]) => {
      const message = args.join(' ');
      if (message.includes('Download the React DevTools') || 
          message.includes('reactjs.org/link/react-devtools') ||
          message.includes('react-devtools')) {
        return; // Suppress this specific message
      }
      original.apply(console, args);
    };
  };
  
  // Suppress from all console methods
  suppressDevToolsMessage('log');
  suppressDevToolsMessage('info');
  suppressDevToolsMessage('warn');
}

// Reduce console surface in production to discourage basic tampering
if (typeof window !== 'undefined' && import.meta.env.PROD) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.error = noop;

  // Block common shortcuts that open devtools; not foolproof but deters casual use
  window.addEventListener('keydown', (e) => {
    if (
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j')) ||
      e.key === 'F12'
    ) {
      e.preventDefault();
    }
  });

  // Prevent context menu to make copy/inspect harder
  window.addEventListener('contextmenu', (e) => e.preventDefault());
}

createRoot(document.getElementById("root")!).render(<App />);
