import { BrowserRouter } from 'react-router-dom';
import { AdventureProvider } from './context/AdventureProvider';
import { AudioProvider } from './context/AudioProvider';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <AdventureProvider>
        <AudioProvider>
          <AppRoutes />
        </AudioProvider>
      </AdventureProvider>
    </BrowserRouter>
  );
}
