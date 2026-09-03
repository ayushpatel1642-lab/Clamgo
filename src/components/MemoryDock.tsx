import { toast } from 'sonner';
import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { Bookmark, Loader2, Plus, Trash2, Edit2 } from 'lucide-react';
import { apiFetch, safeJson } from '../lib/api';

export default function MemoryDock() {
  const { getToken } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const token = await getToken();
      const res = await apiFetch('/api/memory-dock', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await safeJson<any[]>(res, []);
        if (Array.isArray(data)) {
          setItems(data);
        }
      }
    } catch (e) {
      console.warn("Could not load memory dock items:", e);
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
      console.error(e); toast.error(e.message || "Something went wrong.");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = await getToken();
      // Optimistic update
      const previousItems = items;
      setItems(prev => prev.filter(item => item.id !== id));

      const res = await fetch(`/api/memory-dock/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setItems(previousItems);
        throw new Error(errData.error || "Failed to delete item");
      }
      toast.success("Item removed from Memory Dock");
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to delete item.");
    }
  };

  const handleEdit = (id: number, content: string) => {
    setEditingId(id);
    setEditContent(content);
  };
  
  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/memory-dock/${editingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: editContent })
      });
      if (res.ok) {
        const updated = await res.json();
        setItems(prev => prev.map(item => item.id === editingId ? updated : item));
        setEditingId(null);
      } else {
        toast.error("Failed to update item");
      }
    } catch (e: any) {
      toast.error(e.message || "Something went wrong.");
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
            <div key={item.id} className="bg-[#EDF1E9] p-5 rounded-2xl border border-[#DDE5D9] shadow-sm group transition-all duration-300">
              <p className="text-[#101F10] whitespace-pre-wrap font-medium">{item.content}</p>
              <div className="mt-4 flex justify-between items-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-[#3A693A] font-bold uppercase tracking-wider">{item.type}</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleEdit(item.id, item.content)}
                    className="text-[#424940] hover:text-[#3A693A] transition-colors p-1"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="text-[#424940] hover:text-red-500 transition-colors p-1"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingId && (
        <div className="fixed inset-0 z-50 bg-[#F4F5F2]/95 backdrop-blur-sm p-6 flex flex-col items-center justify-center">
          <div className="w-full max-w-lg bg-white p-8 rounded-[32px] border border-[#E0E3DB] shadow-lg flex flex-col gap-6">
             <h2 className="text-2xl font-bold text-[#191C19]">Edit Thought</h2>
             <textarea
               value={editContent}
               onChange={(e) => setEditContent(e.target.value)}
               className="w-full p-4 rounded-xl bg-[#FBFDF8] border border-[#E0E3DB] focus:border-[#3A693A] outline-none text-[#101F10] min-h-[100px]"
               autoFocus
               onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); } }}
             />
             <div className="flex gap-4 mt-2">
                <button onClick={() => setEditingId(null)} className="px-6 py-3 rounded-full font-bold text-[#424940] bg-[#F4F5F2] hover:bg-[#E0E3DB] transition-colors">
                  Cancel
                </button>
                <button onClick={handleSaveEdit} className="flex-1 bg-[#3A693A] text-white py-3 px-6 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-[#2A4C2A] transition-colors">
                  Save Changes
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
