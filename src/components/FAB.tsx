import React, { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

export const FAB = ({ type, onClick }: { type: 'expense' | 'income', onClick: () => void }) => {
  const [pos, setPos] = useState({ x: 20, y: 80 });

  return (
    <button
      className={`fixed z-[500] p-4 rounded-full shadow-2xl transition-all ${
        type === 'expense' ? 'bg-red-500' : 'bg-emerald-500'
      } text-white`}
      style={{ bottom: `${pos.y}px`, right: `${pos.x}px` }}
      onTouchMove={(e) => {
        const touch = e.touches[0];
        setPos({ x: window.innerWidth - touch.clientX - 25, y: window.innerHeight - touch.clientY - 25 });
      }}
      onClick={onClick}
    >
      {type === 'expense' ? <ArrowDown size={28} /> : <ArrowUp size={28} />}
    </button>
  );
};
