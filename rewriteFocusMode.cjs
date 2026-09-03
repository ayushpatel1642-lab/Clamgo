const fs = require('fs');
let content = fs.readFileSync('src/components/FocusMode.tsx', 'utf-8');

// Adding "Park this thought" to FocusMode.
const parkThoughtImports = `import { Play, Pause, Square, ArrowLeft, CheckCircle2, Loader2, MessageCircleQuestion, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';`;
content = content.replace(/import { Play.* } from 'lucide-react';/, parkThoughtImports);

const parkThoughtState = `
  const [showParkModal, setShowParkModal] = useState(false);
  const [parkInput, setParkInput] = useState('');
  const [parkLoading, setParkLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [workedMinutes, setWorkedMinutes] = useState(0);
`;
content = content.replace(/const \[stuckIntervention, setStuckIntervention\] = useState\(''\);/, `const [stuckIntervention, setStuckIntervention] = useState('');\n${parkThoughtState}`);

const parkThoughtHandler = `
  const handleParkThought = async () => {
    if (!parkInput.trim()) return;
    setParkLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/memory-dock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
        body: JSON.stringify({ content: parkInput })
      });
      if (res.ok) {
        toast.success("Thought parked in Memory Dock");
        setShowParkModal(false);
        setParkInput('');
        if (showParkModal) setIsPaused(false);
      } else {
        toast.error("Failed to park thought");
      }
    } catch(e) {
      toast.error("Network error");
    } finally {
      setParkLoading(false);
    }
  };
`;
content = content.replace(/const handleStuck = async/, `${parkThoughtHandler}\n  const handleStuck = async`);

const parkThoughtButton = `
            <button
              onClick={() => {
                setShowParkModal(true);
                setIsPaused(true);
              }}
              className="mt-8 flex items-center gap-2 text-xs text-[#424940] hover:text-[#101F10] font-bold px-4 py-2 bg-white/50 rounded-full transition-colors"
            >
              <Lightbulb className="w-4 h-4" />
              Park a thought
            </button>
            <button
              onClick={() => {
                setShowStuckModal(true);
                setIsPaused(true);
              }}
              className="mt-4 flex items-center gap-2 text-xs text-[#424940] hover:text-[#101F10] font-bold px-4 py-2 bg-white/50 rounded-full transition-colors"
            >
              <MessageCircleQuestion className="w-4 h-4" />
              I'm stuck
            </button>
`;
content = content.replace(/<button\s+onClick=\{\(\) => \{\s+setShowStuckModal\(true\);\s+setIsPaused\(true\);\s+\}\}\s+className="mt-8 flex items-center gap-2 text-xs text-\[#424940\] hover:text-\[#101F10\] font-bold px-4 py-2 bg-white\/50 rounded-full transition-colors"\s*>\s*<MessageCircleQuestion className="w-4 h-4" \/>\s*I'm stuck\s*<\/button>/g, parkThoughtButton);

// Success modal logic
const successLogic = `
  const handleComplete = async (markDone: boolean = false) => {
    setIsActive(false);
    setIsPaused(false);
    setSaving(true);
    
    try {
      const token = await getToken();
      const actualDuration = Math.ceil((duration * 60 - timeLeft) / 60);
      setWorkedMinutes(actualDuration);
      
      const promises: Promise<any>[] = [
        fetch('/api/focus-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
          body: JSON.stringify({ taskId: taskId ? parseInt(taskId) : null, duration, actualDuration, completed: timeLeft === 0 || markDone })
        })
      ];
      const shouldMarkComplete = markDone || timeLeft === 0;
      if (shouldMarkComplete) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#3A693A', '#84A98C', '#A3C9A3'] });
      }
      if (shouldMarkComplete && taskId) {
        if (stepId) {
          promises.push(
            fetch(\`/api/tasks/\${taskId}/steps/\${stepId}\`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
              body: JSON.stringify({ isCompleted: true })
            })
          );
        } else {
          promises.push(
            fetch(\`/api/tasks/\${taskId}\`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${token}\` },
              body: JSON.stringify({ status: 'completed' })
            })
          );
        }
      }
      
      await Promise.all(promises);
      setShowSuccessModal(true);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save session");
    } finally {
      setSaving(false);
    }
  };
`;
// Replace handleComplete
content = content.replace(/const handleComplete = async \(.*?\) => \{[\s\S]*?finally \{\s*setSaving\(false\);\s*\}\s*\};/m, successLogic);


const successModalUI = `
      {showParkModal && (
        <div className="absolute inset-0 z-50 bg-[#F4F5F2]/95 backdrop-blur-sm p-6 flex flex-col md:p-12 items-center justify-center">
          <div className="w-full max-w-xl bg-white p-8 rounded-[32px] border border-[#E0E3DB] shadow-lg flex flex-col gap-6">
             <h2 className="text-2xl font-bold text-[#191C19]">Park a thought</h2>
             <textarea 
               value={parkInput}
               onChange={(e) => setParkInput(e.target.value)}
               placeholder="What's on your mind? We'll save it to the Memory Dock for later."
               className="w-full p-4 rounded-xl bg-[#FBFDF8] border border-[#E0E3DB] focus:border-[#3A693A] resize-none h-32 outline-none text-[#101F10]"
             />
             <div className="flex gap-4 mt-2">
                <button onClick={() => { setShowParkModal(false); setIsPaused(false); }} className="px-6 py-3 rounded-full font-bold text-[#424940] bg-[#F4F5F2] hover:bg-[#E0E3DB] transition-colors">
                  Cancel
                </button>
                <button disabled={parkLoading} onClick={handleParkThought} className="flex-1 bg-[#3A693A] text-white py-3 px-6 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-[#2A4C2A] transition-colors disabled:opacity-50">
                  {parkLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save to Dock"}
                </button>
             </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="absolute inset-0 z-50 bg-[#F4F5F2]/95 backdrop-blur-sm p-6 flex flex-col md:p-12 items-center justify-center">
          <div className="w-full max-w-xl bg-white p-12 rounded-[32px] border border-[#E0E3DB] shadow-lg flex flex-col items-center gap-6 text-center">
             <div className="w-20 h-20 bg-[#EDF1E9] text-[#3A693A] rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10" />
             </div>
             <h2 className="text-3xl font-bold text-[#191C19]">Great session!</h2>
             <p className="text-[#424940] text-xl">You worked for <span className="font-bold text-[#3A693A]">{workedMinutes}</span> minutes.</p>
             
             <div className="flex gap-4 mt-8 w-full">
                <button 
                  onClick={() => {
                    if (taskId && stepId) {
                      navigate(\`/task-decomposer/\${taskId}\`);
                    } else {
                      navigate('/');
                    }
                  }}
                  className="flex-1 bg-[#3A693A] text-white py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-transform"
                >
                  {taskId && stepId ? "Next tiny step" : "Back to tasks"} <ArrowLeft className="w-5 h-5 fill-current rotate-180" />
                </button>
             </div>
          </div>
        </div>
      )}
`;
// Insert before final closing div
content = content.replace(/<\/div>\s*<\/div>\s*<\/div>\s*\)\;\s*\}/, `</div></div>${successModalUI}</div>);}`);

fs.writeFileSync('src/components/FocusMode.tsx', content, 'utf-8');
