'use client';

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { CheckCircle2, Circle, Linkedin, Clock, Users, GitBranch, X, ArrowRight, Sparkles } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

interface Steps {
  linkedin_connected: boolean;
  schedule_set: boolean;
  contacts_imported: boolean;
  sequence_assigned: boolean;
}

interface OnboardingState {
  steps: Steps;
  completed: number;
  total: number;
  percent: number;
  allDone: boolean;
  dismissed: boolean;
}

interface OnboardingContextType {
  state: OnboardingState | null;
  refresh: () => void;
  showModal: (stepKey?: keyof Steps | 'intro') => void;
}

const OnboardingContext = createContext<OnboardingContextType>({
  state: null,
  refresh: () => {},
  showModal: () => {},
});

export const useOnboarding = () => useContext(OnboardingContext);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [modalStep, setModalStep] = useState<keyof Steps | 'intro' | null>(null);
  const [hasShownIntro, setHasShownIntro] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const refresh = async () => {
    try {
      const res = await fetch('/api/onboarding/state');
      if (res.ok) setState(await res.json());
    } catch {}
  };

  useEffect(() => {
    refresh();
  }, [pathname]);

  // Show intro modal once on first load if new user hasn't dismissed it
  useEffect(() => {
    if (!state || state.dismissed || state.allDone || hasShownIntro) return;
    const introShown = typeof window !== 'undefined' ? sessionStorage.getItem('lp-intro-shown') : '1';
    if (!introShown && state.completed === 0) {
      setModalStep('intro');
      sessionStorage.setItem('lp-intro-shown', '1');
      setHasShownIntro(true);
    }
  }, [state, hasShownIntro]);

  const dismiss = async () => {
    await fetch('/api/onboarding/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dismissed: true }) });
    refresh();
  };

  const handleStepAction = (stepKey: keyof Steps) => {
    setModalStep(null);
    if (stepKey === 'linkedin_connected') router.push('/settings');
    else if (stepKey === 'schedule_set') router.push('/settings');
    else if (stepKey === 'contacts_imported') router.push('/contacts');
    else if (stepKey === 'sequence_assigned') router.push('/contacts');
  };

  return (
    <OnboardingContext.Provider value={{ state, refresh, showModal: (s) => setModalStep(s || 'intro') }}>
      {children}
      {modalStep && state && (
        <OnboardingModal
          step={modalStep}
          state={state}
          onClose={() => setModalStep(null)}
          onDismiss={() => { dismiss(); setModalStep(null); }}
          onAction={handleStepAction}
          onStepClick={(s) => setModalStep(s)}
        />
      )}
    </OnboardingContext.Provider>
  );
}

const STEP_META: Record<keyof Steps, { label: string; icon: any; description: string; cta: string; why: string }> = {
  linkedin_connected: {
    label: 'Connect LinkedIn',
    icon: Linkedin,
    description: "Link your LinkedIn account so we can send connection requests and messages on your behalf.",
    cta: 'Go to Settings → Connect LinkedIn',
    why: 'Without this, nothing can send. This takes about 30 seconds.',
  },
  schedule_set: {
    label: 'Set Your Send Schedule',
    icon: Clock,
    description: 'Choose when automated outreach runs — days of the week, hours, and your timezone.',
    cta: 'Review Schedule',
    why: 'Sending during business hours in your timezone improves reply rates significantly.',
  },
  contacts_imported: {
    label: 'Import Your First Contacts',
    icon: Users,
    description: 'Upload a CSV, paste a Google Sheets URL, or search LinkedIn to build your contact list.',
    cta: 'Import Contacts',
    why: 'This is your prospecting list. Start with 50-100 highly targeted people.',
  },
  sequence_assigned: {
    label: 'Start a Sequence',
    icon: GitBranch,
    description: 'Assign a sequence to at least one contact to kick off your first automated outreach.',
    cta: 'Go to Contacts',
    why: 'Sequences handle the connection → follow-up message flow on autopilot.',
  },
};

function OnboardingModal({
  step,
  state,
  onClose,
  onDismiss,
  onAction,
  onStepClick,
}: {
  step: keyof Steps | 'intro';
  state: OnboardingState;
  onClose: () => void;
  onDismiss: () => void;
  onAction: (s: keyof Steps) => void;
  onStepClick: (s: keyof Steps) => void;
}) {
  if (step === 'intro') {
    const nextStep = (Object.keys(state.steps) as (keyof Steps)[]).find(k => !state.steps[k]);
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-lg glass rounded-2xl p-8 relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all">
            <X size={16} />
          </button>
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-blue shadow-lg shadow-blue-500/20 mb-4">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground tracking-tight">Welcome to LinkedIn Prospector</h2>
            <p className="text-sm text-muted-foreground mt-2">4 quick steps to get you sending in under 5 minutes.</p>
          </div>

          <div className="space-y-2 mb-6">
            {(Object.keys(state.steps) as (keyof Steps)[]).map((key, i) => {
              const meta = STEP_META[key];
              const done = state.steps[key];
              const Icon = meta.icon;
              return (
                <button
                  key={key}
                  onClick={() => onStepClick(key)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    done ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-secondary/30 border-border hover:border-blue-500/30 hover:bg-secondary/50'
                  }`}
                >
                  {done ? <CheckCircle2 size={18} className="text-emerald-400 shrink-0" /> : <Circle size={18} className="text-muted-foreground shrink-0" />}
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/15 flex items-center justify-center shrink-0">
                    <Icon size={13} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {i + 1}. {meta.label}
                    </p>
                  </div>
                  {!done && <ArrowRight size={14} className="text-muted-foreground shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {nextStep && (
              <button
                onClick={() => onAction(nextStep)}
                className="flex-1 h-11 rounded-xl btn-primary text-white text-sm font-semibold flex items-center justify-center gap-2"
              >
                Start with: {STEP_META[nextStep].label}
                <ArrowRight size={15} />
              </button>
            )}
            <button onClick={onDismiss} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  const meta = STEP_META[step];
  const Icon = meta.icon;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md glass rounded-2xl p-7 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all">
          <X size={16} />
        </button>
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Icon size={22} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">{meta.label}</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{meta.description}</p>
          </div>
        </div>
        <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg p-3 mb-5">
          <p className="text-xs text-blue-400 font-medium mb-0.5">Why this matters</p>
          <p className="text-xs text-foreground/80 leading-relaxed">{meta.why}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onAction(step)}
            className="flex-1 h-10 rounded-lg btn-primary text-white text-sm font-semibold flex items-center justify-center gap-2"
          >
            {meta.cta}
            <ArrowRight size={14} />
          </button>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

// Sidebar tracker — shows in the nav
export function OnboardingSidebar() {
  const { state, showModal } = useOnboarding();

  if (!state || state.dismissed || state.allDone) return null;

  return (
    <div className="mb-5 px-1">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles size={10} className="text-blue-400" />
          <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-widest">Get Started</span>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">{state.completed}/{state.total}</span>
      </div>
      <button
        onClick={() => showModal('intro')}
        className="w-full p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-violet-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all text-left group"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-foreground">Setup Progress</span>
          <span className="text-xs font-bold text-blue-400 tabular-nums">{state.percent}%</span>
        </div>
        <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${state.percent}%`,
              background: 'linear-gradient(90deg, hsl(220 90% 56%), hsl(260 80% 55%))',
            }}
          />
        </div>
        <div className="flex items-center gap-1 mt-2.5">
          {(Object.keys(state.steps) as (keyof Steps)[]).map((key) => (
            <div
              key={key}
              className={`h-1 flex-1 rounded-full ${state.steps[key] ? 'bg-blue-400' : 'bg-secondary'}`}
            />
          ))}
        </div>
      </button>
    </div>
  );
}
