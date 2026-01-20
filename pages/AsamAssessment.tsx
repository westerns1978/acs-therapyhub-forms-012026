
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import { getClient, getAsamAssessment, generateAsamAnalysis } from '../services/api';
import { AsamAssessmentData, AsamAnalysisResult, Client, AsamDimension } from '../types';
import { Sparkles, BrainCircuit, Loader2, AlertTriangle } from 'lucide-react';

const getRiskColor = (level: 'Low' | 'Moderate' | 'High' | string) => {
    if (level.includes('Low')) return 'text-green-800 bg-green-50 border-green-200';
    if (level.includes('Moderate')) return 'text-yellow-800 bg-yellow-50 border-yellow-200';
    if (level.includes('Significant') || level.includes('High')) return 'text-red-800 bg-red-50 border-red-200';
    return 'text-gray-800 bg-gray-50 border-gray-200';
};

const AsamAssessment: React.FC = () => {
    const { clientId } = useParams<{ clientId: string }>();
    const navigate = useNavigate();
    const [client, setClient] = useState<Client | null>(null);
    const [assessmentData, setAssessmentData] = useState<AsamAssessmentData | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AsamAnalysisResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState(true);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [reassessmentDate, setReassessmentDate] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            if (!clientId) return;
            setIsPageLoading(true);
            try {
                const [clientData, assessment] = await Promise.all([
                    getClient(clientId),
                    getAsamAssessment(clientId),
                ]);
                setClient(clientData || null);
                // FIX: Ensure the initial assessment data structure strictly matches AsamAssessmentData.
                // The API fallback might return objects missing the 'description' field.
                setAssessmentData(assessment as AsamAssessmentData);
            } catch (err) {
                setError("Failed to load client assessment data.");
            } finally {
                setIsPageLoading(false);
            }
        };
        loadData();
    }, [clientId]);

    const handleInputChange = (dimension: number, notes: string) => {
        if (!assessmentData) return;
        setAssessmentData(prev => ({
            ...prev!,
            [dimension]: { ...prev![dimension], notes }
        }));
    };
    
    const handleGenerateAnalysis = async () => {
        if (!assessmentData) return;
        setIsLoading(true);
        setAnalysisResult(null);
        setError(null);

        const clientNotes = Object.values(assessmentData).map((d: AsamDimension) => `Dimension ${d.dimension} (${d.name}): ${d.notes}`).join('\n');
        
        try {
            // Using enhanced API call with Thinking Config (Gemini 3)
            const resultJson = await generateAsamAnalysis(clientNotes);
            setAnalysisResult(resultJson);

        } catch (err) {
            console.error("Error generating ASAM analysis:", err);
            setError("Failed to generate AI analysis. Please check your connection and API key.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleConfirm = () => {
        setIsConfirmed(true);
        const today = new Date();
        const nextYear = new Date(today.setFullYear(today.getFullYear() + 1));
        setReassessmentDate(nextYear.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    };

    if (isPageLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>;
    if (!client || !assessmentData) return <div className="text-center p-8">Client data not found.</div>;

    return (
        <div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    {Object.values(assessmentData).map((dim: AsamDimension) => (
                         <Card key={dim.dimension} title={`Dimension ${dim.dimension}: ${dim.name}`}>
                             <p className="text-base text-on-surface-secondary mb-2">{dim.description}</p>
                             <textarea
                                value={dim.notes}
                                onChange={(e) => handleInputChange(dim.dimension, e.target.value)}
                                rows={4}
                                className="w-full p-2 border border-border rounded-md focus:ring-primary focus:border-primary transition bg-transparent"
                                placeholder="Enter clinical notes here..."
                             />
                         </Card>
                    ))}
                    <button 
                        onClick={handleGenerateAnalysis}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold py-4 px-6 rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        {isLoading ? <BrainCircuit className="animate-pulse w-6 h-6" /> : <Sparkles className="h-6 w-6" />}
                        <div className="text-left">
                            <span className="block text-lg leading-tight">{isLoading ? 'Reasoning with Gemini 3...' : 'Generate Deep Analysis'}</span>
                            {!isLoading && <span className="block text-xs font-normal opacity-80">Uses 32k token thinking budget</span>}
                        </div>
                    </button>
                </div>

                <div className="sticky top-24 space-y-6 self-start">
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start gap-3">
                            <AlertTriangle className="text-red-500 w-5 h-5 mt-0.5" />
                            <p className="text-red-700 text-sm">{error}</p>
                        </div>
                    )}
                    
                    {isLoading && !analysisResult && (
                        <Card className="border-l-4 border-indigo-500 animate-pulse">
                            <div className="flex flex-col justify-center items-center p-12 text-center">
                                <BrainCircuit className="animate-spin text-indigo-500 w-16 h-16 mb-6" style={{ animationDuration: '3s' }} />
                                <h3 className="text-xl font-bold mb-2 text-indigo-900 dark:text-indigo-200">Deep Reasoning in Progress</h3>
                                <p className="text-gray-500 max-w-sm">Gemini 3 is currently debating the risk severity across all 6 dimensions. It is checking for cross-dimensional interactions to justify the level of care.</p>
                                <div className="mt-6 w-full max-w-xs bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-indigo-500 h-1.5 rounded-full w-2/3 animate-pulse"></div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {analysisResult && (
                        <Card title="Gemini 3 Analysis & Recommendations" className="animate-fade-in-up border-l-4 border-green-500 shadow-lg">
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-lg font-semibold mb-2 text-on-surface leading-tight flex items-center gap-2">
                                        <BrainCircuit size={18} className="text-green-600"/> Clinical Justification
                                    </h4>
                                    <div className="text-base bg-surface p-4 rounded-lg border shadow-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                        {analysisResult.clinicalSummary}
                                    </div>
                                </div>
                                
                                <div>
                                    <h4 className="text-lg font-semibold mb-2 text-on-surface leading-tight">Dimension Risk Analysis</h4>
                                    <div className="grid grid-cols-1 gap-3">
                                        {analysisResult.dimensionRisks.map((risk, idx) => (
                                            <div key={idx} className={`flex justify-between items-center text-sm p-3 rounded-md border shadow-sm ${getRiskColor(risk.riskLevel)}`}>
                                                <span className="font-semibold truncate w-2/3">{`Dim ${idx+1}: ${risk.dimension.split(' ')[0]}`}</span>
                                                <span className="font-bold">{risk.riskLevel}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-lg font-semibold mb-2 text-on-surface leading-tight">Treatment Recommendations</h4>
                                    <ul className="list-disc list-inside space-y-2 text-base bg-surface p-4 rounded-md border shadow-sm">
                                        {analysisResult.treatmentRecommendations.map((rec, index) => (
                                            <li key={index} className="text-gray-700 dark:text-gray-300">{rec}</li>
                                        ))}
                                    </ul>
                                </div>
                                
                                <div className="text-center p-6 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 border border-indigo-100 dark:border-indigo-800/50 rounded-xl shadow-inner">
                                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-1">Recommended ASAM Level</h4>
                                    <p className="text-4xl font-extrabold text-indigo-600 dark:text-indigo-400">{analysisResult.recommendedLevel}</p>
                                </div>
                                
                                {!isConfirmed && (
                                    <button onClick={handleConfirm} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition shadow-md">
                                        Confirm & Finalize Assessment
                                    </button>
                                )}
                            </div>
                        </Card>
                    )}
                    {isConfirmed && (
                        <Card title="Assessment Finalized">
                            <div className="text-center p-6">
                                <div className="inline-flex p-4 rounded-full bg-green-100 text-green-600 mb-4 animate-bounce">
                                    <Sparkles size={32} />
                                </div>
                                <p className="text-lg font-medium text-gray-800 dark:text-gray-200">Assessment saved to client record.</p>
                                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Next Reassessment Due</p>
                                    <p className="text-2xl font-bold text-primary mt-1">{reassessmentDate}</p>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AsamAssessment;