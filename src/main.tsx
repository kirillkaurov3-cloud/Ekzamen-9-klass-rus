import React from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter} from 'react-router-dom';
import App from './app/App';
import {useKeyboardInset} from './ui/useKeyboardInset';

function Root() {
 useKeyboardInset();
 return <HashRouter><App/></HashRouter>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><Root/></React.StrictMode>);
