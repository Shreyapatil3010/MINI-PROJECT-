import React, { useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import './i18n';
import LaunchScreen from './components/LaunchScreen';
import reportWebVitals from './reportWebVitals';

const Root: React.FC = () => {
  const [launched, setLaunched] = useState(false);
  const handleComplete = useCallback(() => setLaunched(true), []);

  return (
    <>
      {!launched && <LaunchScreen onComplete={handleComplete} duration={3200} />}
      <div
        style={{
          opacity: launched ? 1 : 0,
          transition: "opacity 1s ease 0.1s",
          visibility: launched ? "visible" : "hidden",
        }}
      >
        <App />
      </div>
    </>
  );
};

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

reportWebVitals();
