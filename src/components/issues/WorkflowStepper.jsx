import React, { useState } from 'react';
import { CheckCircle2, ChevronLeft } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const STAGES = [
  { key: 'new',      label: 'New' },
  { key: 'on_hold',  label: 'On Hold' },
  { key: 'rcca',     label: 'RCCA' },
  { key: 'closed',   label: 'Closed' },
];

// Map legacy RCCA sub-stages to 'rcca' for display
const normalizeStatus = (status) => {
  if (['containment','root_cause_analysis','corrective_action','verification'].includes(status)) return 'rcca';
  return status || 'new';
};

const RETURNABLE_KEYS = ['on_hold', 'rcca', 'closed'];

export default function WorkflowStepper({ status, onStatusChange }) {
  const [confirmReturn, setConfirmReturn] = useState(false);
  const normalizedStatus = normalizeStatus(status);
  const currentIdx = STAGES.findIndex(s => s.key === normalizedStatus);
  const previousStage = currentIdx > 0 ? STAGES[currentIdx - 1] : null;
  const canReturn = RETURNABLE_KEYS.includes(normalizedStatus) && previousStage && onStatusChange;

  const handleReturn = () => setConfirmReturn(true);
  const handleConfirm = () => {
    onStatusChange(previousStage.key);
    setConfirmReturn(false);
  };

  return (
    <>
      <div className="flex items-center w-full overflow-x-auto">
        {STAGES.map((stage, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isLast = idx === STAGES.length - 1;

          return (
            <React.Fragment key={stage.key}>
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  isCompleted ? 'bg-green-500 border-green-500'
                  : isCurrent ? 'bg-blue-600 border-blue-600'
                  : 'bg-white border-slate-200'
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  ) : (
                    <span className={`text-xs font-bold ${isCurrent ? 'text-white' : 'text-slate-300'}`}>
                      {idx + 1}
                    </span>
                  )}
                </div>
                <span className={`text-xs font-medium text-center hidden sm:block whitespace-nowrap ${
                  isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-slate-400'
                }`}>
                  {stage.label}
                </span>
              </div>
              {!isLast && (
                <div className={`flex-1 h-0.5 mx-2 min-w-4 transition-all ${isCompleted ? 'bg-green-400' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {canReturn && (
        <div className="mt-3 flex justify-start">
          <button
            onClick={handleReturn}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-3 h-3" />
            Return to {previousStage.label}
          </button>
        </div>
      )}

      <AlertDialog open={confirmReturn} onOpenChange={setConfirmReturn}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return to previous stage?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the issue back to <strong>{previousStage?.label}</strong>. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}