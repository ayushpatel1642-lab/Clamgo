const fs = require('fs');
let content = fs.readFileSync('src/components/HomeDashboard.tsx', 'utf-8');

// Update Task interface
content = content.replace(/interface Task \{[\s\S]*?\}/, `interface Task {
  id: number;
  title: string;
  status: string;
  estimatedDuration: number;
  createdAt: string;
}`);

// Add recovery state
const recoveryState = `
  const [tasks, setTasks] = useState<Task[]>([]);
  const [somedayTasks, setSomedayTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  
  // Recovery State
  const [missedTasks, setMissedTasks] = useState<Task[]>([]);
`;
content = content.replace(/const \[tasks, setTasks\][\s\S]*?const \[activeTask, setActiveTask\] = useState<Task \| null>\(null\);/, recoveryState);

// Update fetchTasks logic
const fetchTasksLogic = `
        const data = await res.json();
        const pending = data.filter((t: Task) => t.status === 'pending' || t.status === 'in_progress');
        const postponed = data.filter((t: Task) => t.status === 'postponed');
        
        // Find missed tasks (created before today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const missed = pending.filter(t => new Date(t.createdAt).getTime() < today.getTime());
        const current = pending.filter(t => new Date(t.createdAt).getTime() >= today.getTime());
        
        if (missed.length > 0) {
           setMissedTasks(missed);
        }
        
        setTasks(current);
        setSomedayTasks(postponed);
        
        if (current.length > 0) {
          setActiveTask(current[0]);
        } else if (missed.length > 0) {
          setActiveTask(missed[0]);
        } else {
          setActiveTask(null);
        }
`;
content = content.replace(/const data = await res\.json\(\);[\s\S]*?setActiveTask\(null\);\n        \}/, fetchTasksLogic);

// Add action handlers for recovery
const recoveryHandlers = `
  const handleRecoverTask = async (task: Task, action: 'today' | 'postpone' | 'delete') => {
    try {
      const token = await getToken();
      if (action === 'delete') {
        await fetch(\`/api/tasks/\${task.id}\`, { method: 'DELETE', headers: { 'Authorization': \`Bearer \${token}\` } });
      } else {
        const newStatus = action === 'postpone' ? 'postponed' : 'pending';
        // If moving to today, we just update createdAt to now so it's not missed anymore
        const body = action === 'today' ? { status: newStatus, createdAt: new Date().toISOString() } : { status: newStatus };
        await fetch(\`/api/tasks/\${task.id}\`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
          body: JSON.stringify(body)
        });
      }
      toast.success(\`Task moved to \${action}\`);
      fetchTasks();
    } catch (e) {
      toast.error("Failed to update task");
    }
  };
`;
content = content.replace(/const handleDeleteTask = async/, `${recoveryHandlers}\n  const handleDeleteTask = async`);

// Add recovery UI
const recoveryUI = `
      {missedTasks.length > 0 && (
        <div className="bg-[#FBFDF8] border border-[#E0E3DB] p-6 rounded-[32px] mb-8 shadow-sm">
           <h2 className="text-xl font-bold text-[#191C19] mb-2 flex items-center gap-2">
             <BotMessageSquare className="w-5 h-5 text-[#3A693A]" /> 
             You didn't get to these yesterday.
           </h2>
           <p className="text-[#424940] mb-4">What should we do with them?</p>
           
           <div className="space-y-4">
             {missedTasks.map(t => (
               <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white border border-[#E0E3DB] rounded-2xl shadow-sm hover:border-[#3A693A] transition-colors">
                  <span className="font-bold text-[#101F10]">{t.title}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleRecoverTask(t, 'today')} className="px-4 py-2 bg-[#EDF1E9] text-[#3A693A] font-bold rounded-full hover:bg-[#DDE5D9] transition-colors whitespace-nowrap">
                      Move to Today
                    </button>
                    <button onClick={() => handleRecoverTask(t, 'postpone')} className="px-4 py-2 bg-white border border-[#E0E3DB] text-[#424940] font-bold rounded-full hover:bg-[#F4F5F2] transition-colors whitespace-nowrap">
                      Someday
                    </button>
                  </div>
               </div>
             ))}
           </div>
        </div>
      )}

      {tasks.length > 0 && activeTask && !missedTasks.includes(activeTask) && (
`;
content = content.replace(/\{tasks\.length > 0 && activeTask && \(/, recoveryUI);

fs.writeFileSync('src/components/HomeDashboard.tsx', content, 'utf-8');
