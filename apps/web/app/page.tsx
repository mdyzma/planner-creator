import { ProjectDashboard } from '@/components/ProjectDashboard';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Planner Designer</h1>
        <p className="mt-1 text-ink-muted">
          Your planners are stored only in this browser. Export them as JSON to keep a backup.
        </p>
      </header>
      <ProjectDashboard />
      <footer className="mt-16 text-xs text-ink-muted">
        Build {process.env.NEXT_PUBLIC_BUILD_SHA}
      </footer>
    </main>
  );
}
