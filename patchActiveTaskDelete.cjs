const fs = require('fs');
let code = fs.readFileSync('src/components/HomeDashboard.tsx', 'utf8');

const target = `              <button 
                onClick={() => handleEditClick(activeTask.id, activeTask.title)}
                className="flex items-center justify-center gap-2 bg-white border border-[#E0E3DB] text-[#424940] px-8 py-4 rounded-2xl font-bold hover:bg-[#F4F5F2] transition-colors"
              >
                <Edit2 className="w-5 h-5" />
                Edit
              </button>`;

const replacement = `              <button 
                onClick={() => handleEditClick(activeTask.id, activeTask.title)}
                className="flex items-center justify-center gap-2 bg-white border border-[#E0E3DB] text-[#424940] px-8 py-4 rounded-2xl font-bold hover:bg-[#F4F5F2] transition-colors"
              >
                <Edit2 className="w-5 h-5" />
                Edit
              </button>
              <button 
                onClick={() => handleDelete(activeTask.id)}
                className="flex items-center justify-center gap-2 bg-white border border-[#E0E3DB] text-[#424940] px-4 py-4 rounded-2xl font-bold hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                title="Delete Task"
              >
                <Trash2 className="w-5 h-5" />
              </button>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/HomeDashboard.tsx', code);
