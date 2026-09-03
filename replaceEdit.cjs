const fs = require('fs');
let content = fs.readFileSync('src/components/HomeDashboard.tsx', 'utf-8');

// Replace state
content = content.replace(
  /const \[activeTask, setActiveTask\] = useState<Task \| null>\(null\);/,
  "const [activeTask, setActiveTask] = useState<Task | null>(null);\n  const [editingTask, setEditingTask] = useState<{id: number, title: string} | null>(null);\n  const [editTitle, setEditTitle] = useState('');"
);

// Replace handleEdit logic
const newHandleEdit = `  const handleEditClick = (taskId: number, currentTitle: string) => {
    setEditingTask({ id: taskId, title: currentTitle });
    setEditTitle(currentTitle);
  };

  const handleSaveEdit = async () => {
    if (!editingTask || !editTitle.trim()) return;
    try {
      const token = await getToken();
      const res = await fetch(\`/api/tasks/\${editingTask.id}\`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
        },
        body: JSON.stringify({ title: editTitle.trim() })
      });
      if (!res.ok) throw new Error("Failed to edit task");
      setEditingTask(null);
      fetchTasks();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Something went wrong.");
    }
  };`;

content = content.replace(
  /const handleEdit = async \(taskId: number, currentTitle: string\) => \{[\s\S]*?toast\.error\(e\.message \|\| "Something went wrong\."\);\n    \}\n  \};/,
  newHandleEdit
);

// Replace handleEdit calls
content = content.replace(/handleEdit\(/g, "handleEditClick(");

// Add modal UI at the end
const modalUI = `
      {editingTask && (
        <div className="fixed inset-0 z-50 bg-[#F4F5F2]/95 backdrop-blur-sm p-6 flex flex-col items-center justify-center">
          <div className="w-full max-w-lg bg-white p-8 rounded-[32px] border border-[#E0E3DB] shadow-lg flex flex-col gap-6">
             <h2 className="text-2xl font-bold text-[#191C19]">Edit Task</h2>
             <input 
               type="text"
               value={editTitle}
               onChange={(e) => setEditTitle(e.target.value)}
               className="w-full p-4 rounded-xl bg-[#FBFDF8] border border-[#E0E3DB] focus:border-[#3A693A] outline-none text-[#101F10]"
               autoFocus
               onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); }}
             />
             <div className="flex gap-4 mt-2">
                <button onClick={() => setEditingTask(null)} className="px-6 py-3 rounded-full font-bold text-[#424940] bg-[#F4F5F2] hover:bg-[#E0E3DB] transition-colors">
                  Cancel
                </button>
                <button onClick={handleSaveEdit} className="flex-1 bg-[#3A693A] text-white py-3 px-6 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-[#2A4C2A] transition-colors">
                  Save Changes
                </button>
             </div>
          </div>
        </div>
      )}
`;

content = content.replace(/<\/div>\n  \);\n\}\n/, modalUI + "    </div>\n  );\n}\n");

fs.writeFileSync('src/components/HomeDashboard.tsx', content, 'utf-8');
