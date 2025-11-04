import React from 'react';
import { useSocketStore } from '@store/socket';
import { Spinner } from './Spinner'; // Assuming Spinner component exists

export default function ConnectionStatusBanner() {
  const { isConnected } = useSocketStore();

  if (isConnected) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 w-full bg-yellow-500 text-white text-center p-2 text-sm z-50 flex items-center justify-center gap-2">
      <Spinner size="sm" />
      <span>Koneksi terputus. Mencoba menyambung kembali...</span>
    </div>
  );
}