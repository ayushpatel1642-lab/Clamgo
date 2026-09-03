const fs = require('fs');
let code = fs.readFileSync('src/components/HomeDashboard.tsx', 'utf8');

// add useRef
code = code.replace("import React, { useEffect, useState } from 'react';", "import React, { useEffect, useState, useRef } from 'react';");

// add context menu state inside component
const stateRegex = /(const \[isAdding, setIsAdding\] = useState\(false\);)/;
const contextMenuState = `
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: Task; type: 'today' | 'someday' } | null>(null);
  const touchTimer = useRef<any>(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleTouchStart = (e: React.TouchEvent, task: Task, type: 'today' | 'someday') => {
    const touch = e.touches[0];
    touchTimer.current = setTimeout(() => {
      setContextMenu({ x: touch.pageX, y: touch.pageY, task, type });
    }, 500);
  };

  const handleTouchEnd = () => {
    if (touchTimer.current) clearTimeout(touchTimer.current);
  };

  const handleContextMenu = (e: React.MouseEvent, task: Task, type: 'today' | 'someday') => {
    e.preventDefault();
    setContextMenu({ x: e.pageX, y: e.pageY, task, type });
  };
`;

code = code.replace(stateRegex, `$1\n${contextMenuState}`);

// Find today's tasks rendering and add handlers
code = code.replace(
  '<div key={task.id} className="bg-white p-4 rounded-2xl border border-[#E0E3DB] shadow-sm flex items-center justify-between group">',
  '<div key={task.id} className="bg-white p-4 rounded-2xl border border-[#E0E3DB] shadow-sm flex items-center justify-between group cursor-context-menu" onContextMenu={(e) => handleContextMenu(e, task, \'today\')} onTouchStart={(e) => handleTouchStart(e, task, \'today\')} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchEnd}>'
);

// Find someday tasks rendering and add handlers
code = code.replace(
  '<div key={task.id} className="bg-white/50 p-4 rounded-2xl border border-dashed border-[#E0E3DB] flex items-center justify-between group">',
  '<div key={task.id} className="bg-white/50 p-4 rounded-2xl border border-dashed border-[#E0E3DB] flex items-center justify-between group cursor-context-menu" onContextMenu={(e) => handleContextMenu(e, task, \'someday\')} onTouchStart={(e) => handleTouchStart(e, task, \'someday\')} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchEnd}>'
);

// Add the context menu render at the end of the return statement before the closing div
const contextMenuRender = `
      {contextMenu && (
        <div 
          className="fixed z-[100] bg-white border border-[#E0E3DB] shadow-xl rounded-xl py-2 min-w-[160px] text-sm text-[#101F10]"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 200), left: Math.min(contextMenu.x, window.innerWidth - 200) }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-2 border-b border-[#E0E3DB] mb-1">
            <span className="font-bold block truncate max-w-[200px]">{contextMenu.task.title}</span>
          </div>
          
          <button 
            className="w-full text-left px-4 py-2 hover:bg-[#F4F5F2] flex items-center gap-2 transition-colors"
            onClick={() => {
              setContextMenu(null);
              handleEditClick(contextMenu.task.id, contextMenu.task.title);
            }}
          >
            <Edit2 className="w-4 h-4" /> Edit
          </button>
          
          {contextMenu.type === 'today' ? (
            <button 
              className="w-full text-left px-4 py-2 hover:bg-[#F4F5F2] flex items-center gap-2 transition-colors"
              onClick={() => {
                setContextMenu(null);
                handlePostpone(contextMenu.task.id);
              }}
            >
              <ListTodo className="w-4 h-4" /> Defer to later
            </button>
          ) : (
            <button 
              className="w-full text-left px-4 py-2 hover:bg-[#F4F5F2] flex items-center gap-2 transition-colors"
              onClick={() => {
                setContextMenu(null);
                handleActivate(contextMenu.task.id);
              }}
            >
              <Play className="w-4 h-4" /> Move to today
            </button>
          )}

          <button 
            className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 transition-colors mt-1 border-t border-[#E0E3DB] pt-2"
            onClick={() => {
              setContextMenu(null);
              handleDelete(contextMenu.task.id);
            }}
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}
`;

code = code.replace(/    <\/div>\s*\)\;\s*\}\s*$/, `${contextMenuRender}\n    </div>\n  );\n}`);

fs.writeFileSync('src/components/HomeDashboard.tsx', code);
console.log("Updated HomeDashboard");
