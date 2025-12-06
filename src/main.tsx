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

createRoot(document.getElementById("root")!).render(<App />);
