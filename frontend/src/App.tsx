import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthGuard } from './components/auth/AuthGuard';
import type { TabId } from './config/navigation';
import { AppLayout } from './layout/AppLayout';
import { CoachPage } from './pages/CoachPage';
import { ExerciseLibraryPage } from './pages/ExerciseLibraryPage';
import { ExerciseStudioPage } from './pages/ExerciseStudioPage';
import { FlowPage } from './pages/FlowPage';
import { LoginPage } from './pages/LoginPage';
import { OnboardingWizard } from './pages/OnboardingWizard';
import { ProfilePage } from './pages/ProfilePage';
import { StudioPage } from './pages/StudioPage';
import { WorkoutBuilderPage } from './pages/WorkoutBuilderPage';
import { WorkoutRunner } from './components/runner/WorkoutRunner';

/** The authenticated app shell: tab navigation plus the three main screens. */
function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>('flow');

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'flow' && <FlowPage />}
      {activeTab === 'library' && <ExerciseLibraryPage />}
      {activeTab === 'coach' && <CoachPage />}
      {activeTab === 'profile' && <ProfilePage />}
    </AppLayout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AuthGuard />}>
        <Route path="/" element={<AppShell />} />
        <Route path="/onboarding" element={<OnboardingWizard />} />
        <Route path="/builder" element={<WorkoutBuilderPage />} />
        <Route path="/builder/:routine_id" element={<WorkoutBuilderPage />} />
        <Route path="/workout" element={<WorkoutRunner />} />
        <Route path="/studio/:boost_id" element={<StudioPage />} />
        <Route path="/exercise/:exercise_id" element={<ExerciseStudioPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
