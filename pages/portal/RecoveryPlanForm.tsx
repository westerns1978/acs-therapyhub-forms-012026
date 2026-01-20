
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PortalLayout from '../../layouts/PortalLayout';
import { RecoveryPlanData } from '../../types';
import { saveFormSubmission, generateFormSuggestions } from '../../services/api';
import SignaturePad from '../../components/ui/SignaturePad';
import { ArrowLeft, Check, Trash2, Plus, Sparkles, Loader2 } from 'lucide-react';

const initialFormData: RecoveryPlanData = {
    clientName: 'Alice Johnson', 
    dateOfBirth: '1985-05-15', 
    caseNumber: 'STL-2024-001', 
    dateOfPlan: new Date().toISOString().split('T')[0],
    clientEmail: 'alice@example.com',
    remainSober: null,
    problemsToAddress: '',
    howToAddressProblems: '',
    peoplePlacesThingsToAvoid: '',
    changesNoticed: '',
    whatToDoIfWantToUse: '',
    relapsePreventionSteps: '',
    whoSupportsRecovery: '',
    meetingsToAttend: '',
    sponsorDate: '',
    prescribedMedications: null,
    clearOnDosing: null,
    dailyRecoveryActivities: '',
    signature: '',
    acknowledgment: false,
    primaryGoals: '', 
    goalMotivations: '',
    supportPeople: [{ name: '', relationship: '', contact: '', role: '' }],
    supportGroups: 'Local AA Chapter', 
    therapistName: 'Dr. Anya Sharma', 
    therapistContact: '314-849-2800',
    triggers: '', 
    copingSkills: '', 
    emergencyContacts: '',
    actionSteps: [{ step: '', targetDate: '', completed: false }],
    signatureDataUrl: ''
};

const LS_KEY = 'recovery_plan_draft_1'; // Use client ID in real app

const AiSuggestButton = ({ fieldName, context, onSuggest }: { fieldName: string, context: string, onSuggest: (text: string) => void }) => {
    const [loading, setLoading] = useState(false);
    
    const handleSuggest = async (e: React.MouseEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const suggestions = await generateFormSuggestions(fieldName, context);
            onSuggest(suggestions);
        } catch(e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button 
            onClick={handleSuggest} 
            className="absolute right-2 top-2 p-1.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-800 transition flex items-center gap-1 text-xs font-semibold"
            title="Get AI Suggestions"
        >
            {loading ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14} />}
            {loading ? 'Thinking...' : 'AI Suggest'}
        </button>
    );
};

const RecoveryPlanForm: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<RecoveryPlanData>(initialFormData);
    const [isSigned, setIsSigned] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    useEffect(() => {
        const draft = localStorage.getItem(LS_KEY);
        if (draft) {
            setFormData(JSON.parse(draft));
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(LS_KEY, JSON.stringify(formData));
    }, [formData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleAiFill = (name: string, text: string) => {
        setFormData(prev => ({ ...prev, [name]: text }));
    }
    
    const handleArrayChange = (index: number, field: string, value: string, arrayName: 'supportPeople' | 'actionSteps') => {
        const newArray = [...formData[arrayName]];
        // @ts-ignore
        newArray[index][field] = value;
        setFormData(prev => ({...prev, [arrayName]: newArray}));
    };
    
    const addArrayItem = (arrayName: 'supportPeople' | 'actionSteps') => {
        const newItem = arrayName === 'supportPeople' 
            ? { name: '', relationship: '', contact: '', role: '' }
            : { step: '', targetDate: '', completed: false };
        setFormData(prev => ({...prev, [arrayName]: [...prev[arrayName], newItem]}));
    };
    
    const removeArrayItem = (index: number, arrayName: 'supportPeople' | 'actionSteps') => {
        setFormData(prev => ({...prev, [arrayName]: prev[arrayName].filter((_, i) => i !== index)}));
    };

    const nextStep = () => setStep(s => Math.min(s + 1, 5));
    const prevStep = () => setStep(s => Math.max(s - 1, 1));
    
    const handleSubmit = async () => {
        setIsSubmitting(true);
        setSubmitError('');
        try {
            await saveFormSubmission({
                formId: 'form-crp-1',
                clientId: '1',
                status: 'Completed',
                submittedAt: new Date(),
                data: formData
            });
            localStorage.removeItem(LS_KEY);
            alert("Recovery Plan submitted successfully!");
            navigate('/portal/dashboard');
        } catch (error) {
            console.error("Submission Error:", error);
            setSubmitError(error instanceof Error ? error.message : "An unknown error occurred. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const progress = (step / 5) * 100;

    return (
        <PortalLayout>
            <div className="max-w-3xl mx-auto bg-slate-800/80 backdrop-blur-lg border border-slate-700 p-8 rounded-2xl text-white">
                <h1 className="text-3xl font-bold text-center">Continuing Recovery Plan</h1>
                <p className="text-center text-slate-400 mt-2">A personalized plan for your continued success.</p>
                
                <div className="my-6">
                    <div className="w-full bg-slate-700 rounded-full h-2.5">
                        <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p className="text-center text-sm mt-2 text-slate-300">Step {step} of 5</p>
                </div>
                
                <div className="min-h-[400px]">
                    {step === 1 && <Step1 data={formData} onChange={handleChange} onAiFill={handleAiFill} />}
                    {step === 2 && <Step2 data={formData} onArrayChange={handleArrayChange} add={addArrayItem} remove={removeArrayItem} />}
                    {step === 3 && <Step3 data={formData} onChange={handleChange} onAiFill={handleAiFill} />}
                    {step === 4 && <Step4 data={formData} onArrayChange={handleArrayChange} add={addArrayItem} remove={removeArrayItem} />}
                    {step === 5 && <Step5 onSave={(sig) => { setFormData(p => ({...p, signatureDataUrl: sig })); setIsSigned(true); }} isSigned={isSigned} />}
                </div>

                {submitError && (
                    <div className="mt-4 text-center text-red-400 bg-red-900/50 p-3 rounded-lg">
                        <p className="font-bold">Submission Failed</p>
                        <p className="text-sm">{submitError}</p>
                    </div>
                )}

                <div className="mt-8 flex justify-between items-center">
                    <button onClick={prevStep} disabled={step === 1} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50">
                        <ArrowLeft size={16} /> Back
                    </button>
                    {step < 5 ? (
                         <button onClick={nextStep} className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 font-semibold">Next</button>
                    ) : (
                        <button onClick={handleSubmit} disabled={!isSigned || isSubmitting} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold disabled:opacity-50">
                            {isSubmitting ? 'Submitting...' : <><Check size={16} /> Submit Plan</>}
                        </button>
                    )}
                </div>
            </div>
        </PortalLayout>
    );
};

const Step1 = ({data, onChange, onAiFill}: {data: RecoveryPlanData, onChange: any, onAiFill: any}) => (
    <div>
        <h2 className="text-xl font-semibold mb-4">Client Information</h2>
        <div className="grid grid-cols-2 gap-4">
            <input name="clientName" value={data.clientName} readOnly className="p-2 bg-slate-700 rounded border border-slate-600" />
            <input name="dateOfBirth" value={data.dateOfBirth} readOnly className="p-2 bg-slate-700 rounded border border-slate-600" />
            <input name="caseNumber" value={data.caseNumber} readOnly className="p-2 bg-slate-700 rounded border border-slate-600" />
            <input name="dateOfPlan" type="date" value={data.dateOfPlan} onChange={onChange} className="p-2 bg-slate-900 rounded border border-slate-600" />
        </div>
        <h2 className="text-xl font-semibold mt-6 mb-4">Recovery Goals</h2>
        <div className="relative">
            <textarea name="primaryGoals" value={data.primaryGoals} onChange={onChange} rows={4} placeholder="What are your primary recovery goals?" className="w-full p-2 bg-slate-900 rounded border border-slate-600 pr-24" />
            <AiSuggestButton fieldName="Primary Goals" context="Client is in early recovery, aiming for license reinstatement." onSuggest={(text) => onAiFill('primaryGoals', text)} />
        </div>
        <div className="relative mt-4">
            <textarea name="goalMotivations" value={data.goalMotivations} onChange={onChange} rows={3} placeholder="What motivates you to achieve these goals?" className="w-full p-2 bg-slate-900 rounded border border-slate-600 pr-24" />
            <AiSuggestButton fieldName="Motivation" context="Client has a family and wants to drive for work." onSuggest={(text) => onAiFill('goalMotivations', text)} />
        </div>
    </div>
);

const Step2 = ({data, onArrayChange, add, remove}: {data: RecoveryPlanData, onArrayChange: any, add: any, remove: any}) => (
    <div>
        <h2 className="text-xl font-semibold mb-4">Support Network</h2>
        {data.supportPeople.map((p, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 mb-2 p-2 bg-slate-900/50 rounded-lg">
                <input value={p.name} onChange={e => onArrayChange(i, 'name', e.target.value, 'supportPeople')} placeholder="Name" className="p-2 bg-slate-700 rounded border border-slate-600"/>
                <input value={p.relationship} onChange={e => onArrayChange(i, 'relationship', e.target.value, 'supportPeople')} placeholder="Relationship" className="p-2 bg-slate-700 rounded border border-slate-600"/>
                <input value={p.contact} onChange={e => onArrayChange(i, 'contact', e.target.value, 'supportPeople')} placeholder="Contact Info" className="p-2 bg-slate-700 rounded border border-slate-600"/>
                <div className="flex items-center"><input value={p.role} onChange={e => onArrayChange(i, 'role', e.target.value, 'supportPeople')} placeholder="Role in recovery" className="p-2 bg-slate-700 rounded border border-slate-600 w-full"/><button onClick={() => remove(i, 'supportPeople')} className="ml-2 text-red-500"><Trash2 size={16}/></button></div>
            </div>
        ))}
        <button onClick={() => add('supportPeople')} className="flex items-center gap-2 text-sm mt-2 text-green-400"><Plus size={16} /> Add Support Person</button>
    </div>
);

const Step3 = ({data, onChange, onAiFill}: {data: RecoveryPlanData, onChange: any, onAiFill: any}) => (
     <div>
        <h2 className="text-xl font-semibold mb-4">Coping Strategies</h2>
        <div className="relative">
            <textarea name="triggers" value={data.triggers} onChange={onChange} rows={4} placeholder="What are your personal triggers (people, places, feelings)?" className="w-full p-2 bg-slate-900 rounded border border-slate-600 pr-24" />
            <AiSuggestButton fieldName="Triggers" context="Client works in a high-stress environment." onSuggest={(text) => onAiFill('triggers', text)} />
        </div>
        <div className="relative mt-4">
            <textarea name="copingSkills" value={data.copingSkills} onChange={onChange} rows={4} placeholder="What coping skills will you use when faced with triggers?" className="w-full p-2 bg-slate-900 rounded border border-slate-600 pr-24" />
            <AiSuggestButton fieldName="Coping Skills" context="Client enjoys outdoor activities and meditation." onSuggest={(text) => onAiFill('copingSkills', text)} />
        </div>
        <textarea name="emergencyContacts" value={data.emergencyContacts} onChange={onChange} rows={3} placeholder="Who will you contact in an emergency or crisis?" className="w-full mt-4 p-2 bg-slate-900 rounded border border-slate-600" />
    </div>
);

const Step4 = ({data, onArrayChange, add, remove}: {data: RecoveryPlanData, onArrayChange: any, add: any, remove: any}) => (
     <div>
        <h2 className="text-xl font-semibold mb-4">Action Plan</h2>
         {data.actionSteps.map((s, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 mb-2 p-2 bg-slate-900/50 rounded-lg">
                <input value={s.step} onChange={e => onArrayChange(i, 'step', e.target.value, 'actionSteps')} placeholder="Specific action step" className="p-2 bg-slate-700 rounded border border-slate-600 col-span-2"/>
                <div className="flex items-center"><input type="date" value={s.targetDate} onChange={e => onArrayChange(i, 'targetDate', e.target.value, 'actionSteps')} className="p-2 bg-slate-700 rounded border border-slate-600 w-full"/><button onClick={() => remove(i, 'actionSteps')} className="ml-2 text-red-500"><Trash2 size={16}/></button></div>
            </div>
        ))}
        <button onClick={() => add('actionSteps')} className="flex items-center gap-2 text-sm mt-2 text-green-400"><Plus size={16} /> Add Action Step</button>
    </div>
);

const Step5 = ({ onSave, isSigned }: { onSave: (sig: string) => void, isSigned: boolean}) => (
    <div>
        <h2 className="text-xl font-semibold mb-2 text-center">Final Acknowledgement</h2>
        <p className="text-center text-slate-400 mb-4">By signing below, you acknowledge that this is a personal, living document that you will use to guide your recovery journey.</p>
        <div className="bg-slate-700/50 p-4 rounded-lg">
            <SignaturePad onSave={onSave} />
        </div>
        {isSigned && <p className="text-center mt-4 text-green-400 font-semibold">✓ Signature Saved!</p>}
    </div>
);

export default RecoveryPlanForm;
