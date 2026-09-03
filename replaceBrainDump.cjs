const fs = require('fs');
let content = fs.readFileSync('src/components/BrainDump.tsx', 'utf-8');

// Adding localStorage recovery
const localStorageHook = `
  useEffect(() => {
    const saved = localStorage.getItem('clamgo_braindump_text');
    if (saved) setText(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('clamgo_braindump_text', text);
  }, [text]);
`;
content = content.replace(/const navigate = useNavigate\(\);\s*useEffect\(\(\) => \{/, `const navigate = useNavigate();\n${localStorageHook}\n  useEffect(() => {`);

// Auto-submit after stop
const toggleLogic = `
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      // Immediate submission
      if (text.trim().length > 5) {
         handleProcess();
      }
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };
`;
content = content.replace(/const toggleListening = \(\) => \{[\s\S]*?console\.error\(e\);\s*\}\s*\}\s*\};/m, toggleLogic);

// "Listening..." status in the UI
const uiLogic = `
          {recognitionRef.current && (
            <div className="absolute bottom-6 right-6 flex items-center gap-3">
              {isListening && <span className="text-[#3A693A] font-bold animate-pulse text-sm">Listening...</span>}
              <button
                onClick={toggleListening}
                className={\`p-4 rounded-full shadow-lg transition-all \${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-[#EDF1E9] text-[#3A693A] hover:bg-[#DDE5D9]'}\`}
              >
                {isListening ? <Square className="w-6 h-6 fill-current" /> : <Mic className="w-6 h-6" />}
              </button>
            </div>
          )}
`;
content = content.replace(/\{recognitionRef\.current && \([\s\S]*?<\/button>\s*\)\}/m, uiLogic);

// Clear localStorage after save
const confirmLogic = `
      if (res.ok) {
        localStorage.removeItem('clamgo_braindump_text');
        navigate('/');
      } else {
`;
content = content.replace(/if \(res\.ok\) \{\s*navigate\('\/'\);\s*\} else \{/m, confirmLogic);

fs.writeFileSync('src/components/BrainDump.tsx', content, 'utf-8');
