import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { Bookmark, Loader2, Plus, Trash2 } from 'lucide-react';

export default function MemoryDock() {
  const { getToken } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState('');

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
      console.error(e);
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
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = await getToken();
      const res = await fetch(`/api/memory-dock/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setItems(items.filter(item => item.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
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
          {items.map(item => (
            <div key={item.id} className="bg-[#EDF1E9] p-5 rounded-2xl border border-[#DDE5D9] shadow-sm group">
              <p className="text-[#101F10] whitespace-pre-wrap font-medium">{item.content}</p>
              <div className="mt-4 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-[#3A693A] font-bold uppercase tracking-wider">{item.type}</span>
                <button 
                  onClick={() => handleDelete(item.id)}
                  className="text-[#424940] hover:text-[#3A693A] transition-colors p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
