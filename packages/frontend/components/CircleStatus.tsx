'use client';

import { CircleState } from '@/lib/contracts';

interface CircleStatusProps {
  state: number;
  currentRound: number;
  totalRounds: number;
  joinedCount: number;
  memberCount: number;
}

export function CircleStatus({
  state,
  currentRound,
  totalRounds,
  joinedCount,
  memberCount,
}: CircleStatusProps) {
  const steps = [
    { label: 'JOINING', state: CircleState.JOINING },
    ...Array.from({ length: totalRounds }, (_, i) => ({
      label: `R${i + 1}`,
      state: CircleState.ACTIVE,
      round: i + 1,
    })),
    { label: 'DONE', state: CircleState.COMPLETED },
  ];

  const activeIndex =
    state === CircleState.JOINING
      ? 0
      : state === CircleState.COMPLETED
      ? steps.length - 1
      : currentRound; // round 1 = index 1, etc.

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-0">
        {steps.map((step, i) => {
          const isPast    = i < activeIndex;
          const isCurrent = i === activeIndex;
          const isFuture  = i > activeIndex;
          const isLast    = i === steps.length - 1;

          return (
            <div key={i} className="flex items-center">
              {/* Node */}
              <div className="flex flex-col items-center">
                <div
                  className={[
                    'w-2 h-2 rounded-full transition-all duration-300',
                    isPast    ? 'bg-accent/50'    : '',
                    isCurrent ? 'bg-accent ring-2 ring-accent/30' : '',
                    isFuture  ? 'bg-border'        : '',
                  ].join(' ')}
                />
                <span
                  className={[
                    'text-[9px] mt-1 font-mono whitespace-nowrap',
                    isCurrent ? 'text-accent'  : '',
                    isPast    ? 'text-muted/60' : '',
                    isFuture  ? 'text-muted/30' : '',
                  ].join(' ')}
                >
                  {step.label}
                </span>
              </div>
              {/* Connector line */}
              {!isLast && (
                <div
                  className={[
                    'h-px w-6 mx-0.5 transition-all duration-300',
                    i < activeIndex ? 'bg-accent/30' : 'bg-border',
                  ].join(' ')}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Summary line */}
      <div className="font-mono text-xs text-muted">
        {state === CircleState.JOINING && (
          <>{joinedCount}/{memberCount} members joined</>
        )}
        {state === CircleState.ACTIVE && (
          <>Round {currentRound} of {totalRounds}</>
        )}
        {state === CircleState.COMPLETED && (
          <>All rounds complete</>
        )}
      </div>
    </div>
  );
}
