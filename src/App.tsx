import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomeDashboard from './components/HomeDashboard';
import BrainDump from './components/BrainDump';
import TaskDecomposer from './components/TaskDecomposer';
import FocusMode from './components/FocusMode';
import ImStuck from './components/ImStuck';
import VisualTimeline from './components/VisualTimeline';
import MemoryDock from './components/MemoryDock';
import AICoach from './components/AICoach';
import Insights from './components/Insights';
import CompletedTasks from './components/CompletedTasks';
import AuthProvider from './components/AuthProvider';
import Layout from './components/Layout';
import ReminderService from './components/ReminderService';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ReminderService />
        <Layout>
          <Routes>
            <Route path="/" element={<HomeDashboard />} />
            <Route path="/brain-dump" element={<BrainDump />} />
            <Route path="/task-decomposer/:taskId" element={<TaskDecomposer />} />
            <Route path="/focus-mode/:taskId?" element={<FocusMode />} />
            <Route path="/stuck/:taskId?" element={<ImStuck />} />
            <Route path="/timeline" element={<VisualTimeline />} />
            <Route path="/memory-dock" element={<MemoryDock />} />
            <Route path="/coach" element={<AICoach />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/completed" element={<CompletedTasks />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  );
}
