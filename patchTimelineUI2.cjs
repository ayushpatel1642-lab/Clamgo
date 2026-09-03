const fs = require('fs');
let code = fs.readFileSync('src/components/VisualTimeline.tsx', 'utf8');

code = code.replace(
  "interface ScheduleItem {\\n  type: 'task' | 'break';\\n  taskId?: number;\\n  title?: string;\\n  duration: number;\\n}",
  "interface ScheduleItem {\\n  type: 'task' | 'break' | 'step';\\n  taskId?: number;\\n  stepId?: number;\\n  title?: string;\\n  duration: number;\\n}"
);

const searchStr = "const task = tasks.find(t => t.id === item.taskId);\\n              if (!task) return null;\\n              \\n              // Add 5 mins conceptual padding to currentTime after tasks\\n              currentTime = addMinutes(currentTime, 5);\\n              \\n              return (";

const replacementStr = "const task = tasks.find(t => t.id === item.taskId);\\n              if (!task) return null;\\n              \\n              // Add 5 mins conceptual padding to currentTime after tasks\\n              currentTime = addMinutes(currentTime, 5);\\n              \\n              const isStep = item.type === 'step';\\n              const displayTitle = isStep ? `${task.title} - ${item.title}` : task.title;\\n              \\n              return (";

code = code.replace(searchStr, replacementStr);

const searchStr2 = "<h3 className=\"font-bold text-[#101F10] pr-4\">{task.title}</h3>";
const replacementStr2 = "<h3 className=\"font-bold text-[#101F10] pr-4\">{displayTitle}</h3>";

code = code.replace(searchStr2, replacementStr2);

fs.writeFileSync('src/components/VisualTimeline.tsx', code);
