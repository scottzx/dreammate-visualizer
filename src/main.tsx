import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './view/App';
const ModelGallery = lazy(() => import('./view/ModelGallery'));
const gallery = new URLSearchParams(window.location.search).get('view') === 'models';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Suspense fallback={<div style={{ padding: 24 }}>正在加载三维视图…</div>}>{gallery ? <ModelGallery /> : <App />}</Suspense></React.StrictMode>);
