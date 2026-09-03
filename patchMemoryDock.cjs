const fs = require('fs');
let code = fs.readFileSync('src/components/MemoryDock.tsx', 'utf8');

if (!code.includes('Edit2')) {
    code = code.replace("import { Bookmark, Loader2, Plus, Trash2, Undo2 } from 'lucide-react';", 
    "import { Bookmark, Loader2, Plus, Trash2, Undo2, Edit2 } from 'lucide-react';");
}

if (!code.includes('editingId')) {
    code = code.replace("const [newItem, setNewItem] = useState('');", 
    `const [newItem, setNewItem] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');`);
}

if (!code.includes('handleSaveEdit')) {
    code = code.replace("const handleUndo = (id: number) => {", 
    `const handleEdit = (id: number, content: string) => {
    setEditingId(id);
    setEditContent(content);
  };
  
  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    try {
      const token = await getToken();
      const res = await fetch(\`/api/memory-dock/\${editingId}\`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
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

  const handleUndo = (id: number) => {`);
}

if (!code.includes('value={editContent}')) {
    code = code.replace(/<div className="mt-4 flex justify-between items-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">[\s\S]*?<\/div>/m, 
    `<div className="mt-4 flex justify-between items-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <span className="text-xs text-[#3A693A] font-bold uppercase tracking-wider">{item.type}</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEdit(item.id, item.content)}
                      className="text-[#424940] hover:text-[#3A693A] transition-colors p-1"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="text-[#424940] hover:text-[#3A693A] transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>`);
}

if (!code.includes('editingId && (')) {
    code = code.replace("{/* Undo Toasts */}", 
    `{editingId && (
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

      {/* Undo Toasts */}`);
}

fs.writeFileSync('src/components/MemoryDock.tsx', code);
