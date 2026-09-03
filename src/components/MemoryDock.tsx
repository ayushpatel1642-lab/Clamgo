import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { Bookmark, Loader2, Plus, Trash2, Undo2 } from 'lucide-react';

export default function MemoryDock() {
  const { getToken } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState('');
  
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [undoTimers, setUndoTimers] = useState<Record<number, NodeJS.Timeout>>({});

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const token = await getToken();
      const res = await fetch('/api/memory-dock', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (e) {
      console.error(e); alert(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    
    try {
      const token = await getToken();
      const res = await fetch('/api/memory-dock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: newItem })
      });
      if (res.ok) {
        const added = await res.json();
        setItems([added, ...items]);
        setNewItem('');
      }
    } catch (e) {
      console.error(e); alert(e.message || "Something went wrong.");
    }
  };

  const handleDelete = (id: number) => {
    setDeletedIds(prev => [...prev, id]);
    
    const timer = setTimeout(async () => {
      try {
        const token = await getToken();
        await fetch(`/api/memory-dock/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setItems(prev => prev.filter(item => item.id !== id));
        setDeletedIds(prev => prev.filter(x => x !== id));
      } catch (e) {
        console.error(e); alert(e.message || "Something went wrong.");
      }
    }, 5000);
    
    setUndoTimers(prev => ({ ...prev, [id]: timer }));
  };

  const handleUndo = (id: number) => {
    if (undoTimers[id]) {
      clearTimeout(undoTimers[id]);
      const newTimers = { ...undoTimers };
      delete newTimers[id];
      setUndoTimers(newTimers);
    }
    setDeletedIds(prev => prev.filter(x => x !== id));
  };

  return (
    <div className="p-6 md:p-12 max-w-2xl mx-auto w-full">
      <header className="mb-10 pt-4">
        <h1 className="text-3xl font-bold text-[#191C19] mb-2">Memory Dock (Later)</h1>
        <p className="text-[#424940] text-lg">Park unrelated thoughts here so you don't lose focus on the active task.</p>
      </header>

      <form onSubmit={handleAdd} className="mb-8 relative">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Quick thought to remember..."
          className="w-full bg-[#FBFDF8] p-4 pl-6 pr-14 rounded-2xl border border-[#E0E3DB] shadow-sm focus:border-[#3A693A] focus:ring focus:ring-[#DDE5D9] transition-all outline-none text-[#101F10]"
        />
        <button 
          type="submit"
          disabled={!newItem.trim()}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-[#EDF1E9] text-[#3A693A] rounded-xl hover:bg-[#DDE5D9] disabled:opacity-50 transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-[#E0E3DB]" /></div>
      ) : items.length === 0 ? (
        <div className="text-center p-12 bg-[#F4F5F2] rounded-[32px] border border-dashed border-[#E0E3DB]">
          <Bookmark className="w-8 h-8 text-[#A3C9A3] mx-auto mb-4" />
          <p className="text-[#424940]">Your memory dock is empty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map(item => {
            const isDeleting = deletedIds.includes(item.id);
            return (
              <div key={item.id} className={`bg-[#EDF1E9] p-5 rounded-2xl border border-[#DDE5D9] shadow-sm group transition-all duration-300 ${isDeleting ? 'opacity-50 scale-95 pointer-events-none' : ''}`}>
                <p className="text-[#101F10] whitespace-pre-wrap font-medium">{item.content}</p>
                <div className="mt-4 flex justify-between items-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <span className="text-xs text-[#3A693A] font-bold uppercase tracking-wider">{item.type}</span>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="text-[#424940] hover:text-[#3A693A] transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Undo Toasts */}
      <div className="fixed bottom-24 md:bottom-12 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50">
        {deletedIds.map(id => (
          <div key={id} className="bg-[#191C19] text-white px-4 py-3 rounded-full shadow-xl flex items-center gap-4 text-sm font-bold animate-in fade-in slide-in-from-bottom-5">
            <span>Item deleted</span>
            <button 
              onClick={() => handleUndo(id)}
              className="text-[#A3C9A3] hover:text-white flex items-center gap-1 transition-colors"
            >
              <Undo2 className="w-4 h-4" /> Undo
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
