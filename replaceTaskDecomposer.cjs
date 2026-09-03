const fs = require('fs');
let content = fs.readFileSync('src/components/TaskDecomposer.tsx', 'utf-8');

const headerReplace = `
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] font-bold tracking-widest text-[#424940] opacity-60 uppercase">All Steps</h2>
              <button 
                onClick={handleDecompose}
                disabled={decomposing}
                className="text-xs font-bold text-[#3A693A] flex items-center gap-1 hover:bg-[#EDF1E9] px-3 py-1.5 rounded-full transition-colors disabled:opacity-50"
              >
                {decomposing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Sparkles className="w-3 h-3" /> Regenerate</>}
              </button>
            </div>
            <div className="space-y-3">
`;

content = content.replace(/<section>\s*<h2 className="text-\[10px\] font-bold tracking-widest text-\[#424940\] opacity-60 uppercase mb-6">All Steps<\/h2>\s*<div className="space-y-3">/, headerReplace);

content = content.replace(/import \{ Play, Loader2, ListTree, ArrowLeft \} from 'lucide-react';/, "import { Play, Loader2, ListTree, ArrowLeft, Sparkles } from 'lucide-react';");

fs.writeFileSync('src/components/TaskDecomposer.tsx', content, 'utf-8');
