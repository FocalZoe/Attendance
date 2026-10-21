import * as React from 'react';
import { createRoot } from 'react-dom/client';
import './globals.css';
import App from './App';

const container = document.getElementById('root');

if (!container) {
  throw new Error('未在 HTML 中找到 #root 節點');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
