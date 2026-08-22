import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthGuard } from './components/auth/AuthGuard';
import type { TabId } from './config/navigation';
import { AppLayout } from './layout/AppLayout';
import { AdminManageExercises } from './pages/AdminManageExercises';
import { AdminManagePrograms } from './pages/AdminManagePrograms';
import { AdminPage } from './pages/AdminPage';
import { CoachPage } from './pages/CoachPage';
import { ExerciseLibraryPage } from './pages/ExerciseLibraryPage';
import { ExerciseStudioPage } from './pages/ExerciseStudioPage';
import { FlowPage } from './pages/FlowPage';
import { LoginPage } from './pages/LoginPage';
import { OnboardingWizard } from './pages/OnboardingWizard';
import { ProfilePage } from './pages/ProfilePage';
import { StatisticsPage } from './pages/StatisticsPage';
import { StudioPage } from './pages/StudioPage';
import { WorkoutBuilderPage } from './pages/WorkoutBuilderPage';
import { WorkoutRunner } from './components/runner/WorkoutRunner';
import { api } from './api/client';

/** The authenticated app shell: tab navigation plus the three main screens. */
function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>('flow');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .getUserProfile()
      .then((profile) => {
        if (active) setIsAdmin(profile.isAdmin);
      })
      .catch(() => {
        // Non-critical — admin tab simply won't appear.
      });
    return () => {
      active = false;
    };
  }, []);

  // Redirect non-admins away from the admin tab if they somehow land on it.
  useEffect(() => {
    if (activeTab === 'admin' && !isAdmin) {
      setActiveTab('flow');
    }
  }, [activeTab, isAdmin]);

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab} isAdmin={isAdmin}>
      {activeTab === 'flow' && <FlowPage />}
      {activeTab === 'library' && <ExerciseLibraryPage />}
      {activeTab === 'coach' && <CoachPage />}
      {activeTab === 'stats' && <StatisticsPage />}
      {activeTab === 'profile' && <ProfilePage />}
      {activeTab === 'admin' && isAdmin && <AdminPage />}
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
        <Route path="/admin/exercises" element={<AdminManageExercises />} />
        <Route path="/admin/programs" element={<AdminManagePrograms />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
