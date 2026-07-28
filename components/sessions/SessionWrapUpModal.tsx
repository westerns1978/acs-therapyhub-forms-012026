





import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client } from '../../types';
import { addClientAssignment, saveClinicalNote } from '../../services/api';

// Icons
const CheckCircleIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const EditIcon = (props: React.ComponentProps<'svg'>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const ClipboardCheckIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>;


interface SessionWrapUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client;
    noteContent: string;
    sessionDuration: number;
    /** The appointment this session belongs to, when known — links the saved note
     *  via clinical_notes.appointment_id so it resolves in Session History. Left
     *  undefined (not guessed) when the caller has no real appointment in scope,
     *  e.g. Start Session launched directly from the client header. */
    appointmentId?: string | null;
}

// "Submit Charge" and "Schedule Next" FORMALLY CUT (David 7/15, confirmed 7/28).
// They were the wizard's phantom writers: the charge step never billed anything
// (addSessionRecord throws) and the schedule step force-booked a hardcoded
// un-conflict-checked next-week slot. Charges live on the client's Fees tab;
// booking lives in ScheduleSessionModal.
const steps = [
    { title: 'Sign Note', icon: EditIcon },
    { title: 'Assign Tasks', icon: ClipboardCheckIcon }
];

const SessionWrapUpModal: React.FC<SessionWrapUpModalProps> = ({ isOpen, onClose, client, noteContent, sessionDuration, appointmentId }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [editedNote, setEditedNote] = useState(noteContent);
    const [isSigned, setIsSigned] = useState(false);
    const [homework, setHomework] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);
    // Honest completion (2026-07-28): steps whose writer isn't implemented record a
    // warning here, and the final screen reports what did NOT happen instead of
    // "All post-session tasks are complete."
    const [stepWarnings, setStepWarnings] = useState<string[]>([]);
    const navigate = useNavigate();

    const handleNext = async () => {
        if (currentStep === 0) { // After signing the note
            // Persist the signed clinical note to the client's record via the SAME
            // real path SmartNoteImporter uses (saveClinicalNote → clinical_notes).
            // Saved at sign time so the note survives even if the user abandons the
            // later billing/scheduling steps.
            const noteText = editedNote.trim();
            if (noteText) {
                setIsSavingNote(true);
                try {
                    await saveClinicalNote(client.id, noteText, { isSigned, noteType: 'Session', appointmentId });
                } catch (e) {
                    setIsSavingNote(false);
                    alert('Could not save the clinical note: ' + (e as Error).message);
                    return; // stay on this step so the note isn't silently lost
                }
                setIsSavingNote(false);
            }
        }
        if (currentStep === 1) { // After assigning homework
             if (homework.trim()) {
                // addClientAssignment is NOT IMPLEMENTED and now throws (2026-07-28).
                try {
                    await addClientAssignment({
                        clientId: client.id,
                        task: homework,
                        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                        isComplete: false
                    });
                } catch (e) {
                    setStepWarnings(w => [...w, 'The client task was NOT saved and will not appear in the client’s portal — client tasks are not implemented.']);
                }
            }
        }
        setCurrentStep(prev => prev + 1);
    };

    const handleFinish = () => {
        onClose();
        // Land on the client's record so the note just saved during wrap-up is
        // right there in their Clinical Notes.
        navigate(`/clients/${client.id}`);
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 0: // Sign Note
                return (
                    <div className="space-y-4">
                        <textarea
                            value={editedNote}
                            onChange={(e) => setEditedNote(e.target.value)}
                            rows={12}
                            className="w-full p-2 border border-border rounded-md focus:ring-primary focus:border-primary transition"
                        />
                        <button onClick={() => setIsSigned(true)} disabled={isSigned} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400">
                            {isSigned ? 'Signature Applied' : 'Click to Apply Digital Signature'}
                        </button>
                    </div>
                );
            case 1: // Assign Homework
                return (
                    <div className="space-y-4">
                        <label htmlFor="homework-input" className="font-semibold text-lg">Assign Client Task (Optional)</label>
                        <input
                            id="homework-input"
                            type="text"
                            value={homework}
                            onChange={(e) => setHomework(e.target.value)}
                            placeholder="e.g., Attend 2 verified AA meetings"
                            className="w-full p-3 border border-border rounded-md focus:ring-primary focus:border-primary transition"
                        />
                         <p className="text-xs text-warning-700 dark:text-warning-300">Client tasks are not implemented — anything entered here will NOT be saved and will NOT appear in the client’s portal.</p>
                    </div>
                );
            case 2: // Complete — reports what actually persisted, not a blanket success.
                return (
                    <div className="text-center p-8">
                        <CheckCircleIcon className="w-20 h-20 text-green-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold">Session wrap-up finished</h2>
                        <p className="text-on-surface-secondary mt-2">Your clinical note has been saved to the client’s record.</p>
                        {stepWarnings.length > 0 && (
                            <div className="mt-5 text-left p-4 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-xl">
                                <p className="text-xs font-black uppercase tracking-widest text-warning-700 dark:text-warning-300">Not saved</p>
                                <ul className="mt-2 space-y-1.5 list-disc list-inside">
                                    {stepWarnings.map((w, i) => (
                                        <li key={i} className="text-sm text-warning-800 dark:text-warning-200">{w}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )
            default: return null;
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in-up">
            <div className="bg-background dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
                <header className="p-4 border-b border-border dark:border-slate-800 text-center relative">
                    <h2 className="text-xl font-bold">Session Wrap-Up for {client.name}</h2>
                    <p className="text-sm text-on-surface-secondary">Streamlining your post-session workflow.</p>
                </header>
                {/* Fix: Add main and footer sections to complete the component structure. */}
                <main className="flex-1 p-6 overflow-y-auto">
                    <div className="max-w-xl mx-auto">
                        {/* Step indicators */}
                        <div className="flex justify-between items-center mb-8 px-4">
                            {steps.map((step, index) => (
                                <React.Fragment key={step.title}>
                                    <div className="flex flex-col items-center text-center">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${currentStep >= index ? 'bg-primary border-primary text-white' : 'bg-surface border-border text-on-surface-secondary'}`}>
                                            <step.icon className="w-5 h-5" />
                                        </div>
                                        <p className={`mt-2 text-xs font-semibold ${currentStep >= index ? 'text-primary' : 'text-on-surface-secondary'}`}>{step.title}</p>
                                    </div>
                                    {index < steps.length - 1 && <div className={`flex-1 h-0.5 mt-[-1.5rem] ${currentStep > index ? 'bg-primary' : 'bg-border'}`}></div>}
                                </React.Fragment>
                            ))}
                        </div>
                        {renderStepContent()}
                    </div>
                </main>
                <footer className="p-4 border-t border-border dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-200 dark:bg-slate-700 rounded-md hover:bg-gray-300 dark:hover:bg-slate-600">Cancel</button>
                    {currentStep < 2 ? (
                        <button onClick={handleNext} disabled={(currentStep === 0 && !isSigned) || isSavingNote} className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-focus transition disabled:bg-gray-400">
                            {isSavingNote ? 'Saving Note…' : currentStep === 1 ? 'Finish & Assign' : 'Save & Continue'}
                        </button>
                    ) : (
                        <button onClick={handleFinish} className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition">
                            Return to Client Workspace
                        </button>
                    )}
                </footer>
            </div>
        </div>
    );
};

export default SessionWrapUpModal;