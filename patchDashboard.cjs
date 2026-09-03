const fs = require('fs');
let code = fs.readFileSync('src/components/HomeDashboard.tsx', 'utf8');

// Imports
if (!code.includes('CalendarDays')) {
    code = code.replace("import { Play, Sparkles, Plus, Trash2, Clock, CheckCircle, BrainCircuit, ListTodo, BotMessageSquare, GripVertical, Edit2 } from 'lucide-react';", 
    "import { Play, Sparkles, Plus, Trash2, Clock, CheckCircle, BrainCircuit, ListTodo, BotMessageSquare, GripVertical, Edit2, CalendarDays } from 'lucide-react';");
}

// State
if (!code.includes('isPlanning')) {
    code = code.replace('const [contextMenu, setContextMenu] = useState<{ x: number, y: number, task: any, type: string } | null>(null);',
    `const [contextMenu, setContextMenu] = useState<{ x: number, y: number, task: any, type: string } | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [dayPlan, setDayPlan] = useState<any>(null);`);
}

// Function
if (!code.includes('handlePlanDay')) {
    code = code.replace('const fetchTasks = async () => {',
    `const handlePlanDay = async () => {
    setIsPlanning(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/ai/plan-day', {
        method: 'POST',
        headers: { 'Authorization': \`Bearer \${token}\` }
      });
      if (res.ok) {
        const data = await res.json();
        setDayPlan(data);
      } else {
        toast.error("Failed to plan day");
      }
    } catch (e: any) {
      toast.error(e.message || "Something went wrong.");
    } finally {
      setIsPlanning(false);
    }
  };

  const fetchTasks = async () => {`);
}

// UI
if (!code.includes('Auto Plan My Day')) {
    code = code.replace('</header>',
    `  <div className="mt-4">
          <button 
            onClick={handlePlanDay} 
            disabled={isPlanning}
            className="flex items-center gap-2 bg-[#EDF1E9] text-[#3A693A] px-4 py-2 rounded-full font-bold hover:bg-[#DDE5D9] transition-colors disabled:opacity-50"
          >
            <CalendarDays className="w-4 h-4" />
            {isPlanning ? 'Planning...' : 'Auto Plan My Day'}
          </button>
        </div>
      </header>`);
}

// Modal
if (!code.includes('dayPlan &&')) {
    code = code.replace('{editingTask && (',
    `{dayPlan && (
        <div className="fixed inset-0 z-50 bg-[#F4F5F2]/95 backdrop-blur-sm p-6 flex flex-col items-center justify-center overflow-y-auto">
          <div className="w-full max-w-2xl bg-white p-8 rounded-[32px] border border-[#E0E3DB] shadow-lg flex flex-col gap-6 my-auto">
             <h2 className="text-2xl font-bold text-[#191C19]">Your Day Plan</h2>
             {dayPlan.greeting && <p className="text-[#3A693A] font-medium">{dayPlan.greeting}</p>}
             
             {dayPlan.suggestedTasks && dayPlan.suggestedTasks.length > 0 && (
               <div>
                 <h3 className="text-lg font-bold text-[#424940] mb-3 border-b border-[#E0E3DB] pb-2">Suggested Tasks</h3>
                 <ul className="space-y-3">
                   {dayPlan.suggestedTasks.map((t: any, i: number) => {
                     const taskObj = tasks.find(x => x.id === t.taskId);
                     return (
                       <li key={i} className="bg-[#FBFDF8] p-4 rounded-xl border border-[#E0E3DB]">
                         <p className="font-bold text-[#101F10]">{taskObj ? taskObj.title : \`Task ID: \${t.taskId}\`}</p>
                         <p className="text-sm text-[#424940] mt-1">{t.reason}</p>
                       </li>
                     );
                   })}
                 </ul>
               </div>
             )}

             {dayPlan.newHabits && dayPlan.newHabits.length > 0 && (
               <div>
                 <h3 className="text-lg font-bold text-[#424940] mb-3 border-b border-[#E0E3DB] pb-2">Habits & Automation</h3>
                 <ul className="list-disc pl-5 space-y-2">
                   {dayPlan.newHabits.map((h: string, i: number) => (
                     <li key={i} className="text-[#424940]">{h}</li>
                   ))}
                 </ul>
               </div>
             )}
             
             <div className="mt-4 flex justify-end">
                <button onClick={() => setDayPlan(null)} className="px-6 py-3 rounded-full font-bold text-white bg-[#3A693A] hover:bg-[#2A4C2A] transition-colors">
                  Got it!
                </button>
             </div>
          </div>
        </div>
      )}
      
      {editingTask && (`);
}

fs.writeFileSync('src/components/HomeDashboard.tsx', code);
