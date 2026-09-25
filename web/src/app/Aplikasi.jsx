import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import Rute from './Rute.jsx';
import { useAuth } from '@/features/auth/auth.store';

const klienKueri = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export default function Aplikasi() {
  const periksaSesi = useAuth((s) => s.periksaSesi);

  useEffect(() => {
    periksaSesi();
  }, [periksaSesi]);

  return (
    <QueryClientProvider client={klienKueri}>
      <BrowserRouter>
        <Rute />
      </BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '0.875rem',
            border: '2px solid #e8e8e7',
            color: '#3d1f12',
            fontSize: '0.875rem',
            fontWeight: 500,
            maxWidth: '90vw',
          },
          success: { iconTheme: { primary: '#537236', secondary: '#fff' } },
          error: { iconTheme: { primary: '#e43222', secondary: '#fff' }, duration: 5000 },
        }}
      />
    </QueryClientProvider>
  );
}
