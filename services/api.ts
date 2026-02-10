import { GoogleGenAI, Type } from '@google/genai';
import { supabase } from './supabase';
import { storageService } from './storageService';
import {
  Client, Appointment, Payment, DocumentFile, FormSubmission,
  SessionRecord, SROPProgress, ClientActivity, NetworkScanner,
  VideoSession, PracticeMetrics, User, AsamAnalysisResult, DailyBriefingData, ComplianceStatus,
  RevenueDataPoint, ComplianceDataPoint
} from '../types';
import { v4 as uuidv4 } from 'uuid';

import {
    dbMessages, dbSropData, dbComplianceEvents, dbAuditLogs,
    dbClientAssignments, dbFormTemplates, dbBillingSummaries,
    dbClientActivityFeed, dbNetworkScanners, dbForms, dbVideoSessions,
    dbSessionRecords,
    dbDocumentFiles,
    dbClientDocuments,
    dbAsamAssessments,
    dbProgramPlans,
    dbAppointments as mockAppointments,
    dbPayments as mockPayments,
    dbClients,
    dbFormSubmissions,
    dbAiSuggestions,
    initializeDatabase
} from '../data/database';

const DEFAULT_ORG_ID = '71077b47-66e8-4fd9-90e7-709773ea6582';
const MCP_ORCHESTRATOR_URL = 'https://ldzzlndsspkyohvzfiiu.supabase.co/functions/v1/mcp-orchestrator';

const mapVaultDocToApp = (vDoc: any): DocumentFile => ({
    id: vDoc.id,
    nodeId: vDoc.id,
    clientId: vDoc.metadata?.clientId || '',
    clientName: 'Client', 
    filename: vDoc.file_name,
    documentType: 'Unknown',
    gcs_file_path: vDoc.file_path,
    sql_metadata_id: vDoc.id,
    uploadDate: new Date(vDoc.uploaded_at),
    fileSize: vDoc.file_size,
    mimeType: vDoc.file_type,
    url: vDoc.public_url,
    extractedData: {
        summary: vDoc.metadata?.summary || '',
        fields: vDoc.metadata?.fields || [],
        actionItems: vDoc.metadata?.actionItems || [],
        suggestedSubfolder: vDoc.metadata?.suggestedSubfolder || 'Intake'
    },
    complianceStatus: 'Approved',
    auditTrail: []
});

const mapClientToApp = (c: any): Client => ({
    ...c,
    initials: c.name ? c.name.split(' ').map((n: any) => n[0]).join('') : '??',
    missingDocuments: c.missingDocuments || [],
    gamification: c.gamification || { points: 0, badges: [] },
    attendanceHistory: c.attendanceHistory || []
});

export const callMcpOrchestrator = async (tool: string, params: any) => {
    try {
        const response = await fetch(MCP_ORCHESTRATOR_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ agent: 'ACS_THERAPYHUB', tool, params })
        });
        if (!response.ok) throw new Error('MCP Transmission Failed');
        return await response.json();
    } catch (e) {
        console.error("MCP Error:", e);
        return { error: "Service unavailable", status: "OFFLINE" };
    }
};

export const callWestFlowOrchestrator = callMcpOrchestrator;

export const getClients = async (): Promise<Client[]> => {
    try {
        const { data, error } = await supabase.from('clients').select('*');
        if (error || !data || data.length === 0) return (dbClients || []).map(mapClientToApp); 
        return data.map(mapClientToApp);
    } catch (e) {
        return (dbClients || []).map(mapClientToApp);
    }
};

export const getClient = async (id: string): Promise<Client | undefined> => {
    try {
        const { data, error } = await supabase.from('clients').select('*').eq('id', id).single();
        if (error || !data) {
            const mock = (dbClients || []).find(c => c.id === id);
            return mock ? mapClientToApp(mock) : undefined;
        }
        return mapClientToApp(data);
    } catch (e) {
        const mock = (dbClients || []).find(c => c.id === id);
        return mock ? mapClientToApp(mock) : undefined;
    }
};

export const getDocumentFilesForClient = async (clientId: string): Promise<DocumentFile[]> => {
    try {
        const vaultDocs = await storageService.fetchVault(clientId);
        if (!vaultDocs || (vaultDocs || []).length === 0) {
            return (dbDocumentFiles || []).filter(d => d.clientId === clientId);
        }
        return (vaultDocs || []).map(mapVaultDocToApp);
    } catch (e) {
        return (dbDocumentFiles || []).filter(d => d.clientId === clientId);
    }
};

export const saveDocumentFile = async (doc: DocumentFile, file?: File): Promise<DocumentFile> => {
    if (!file) throw new Error("Binary required for Vault ingestion.");
    const vDoc = await storageService.uploadToVault(file, doc.clientId);
    return mapVaultDocToApp(vDoc);
};

export const checkSupabaseConnection = () => storageService.checkConnection();
export const getSyncedAppointments = async (date?: Date) => (await getAppointments(date));
export const getAppointments = async (date?: Date) => (mockAppointments || []).map(a => ({...a, date: new Date(a.date)}));
export const getClientAppointments = async (id: string) => (await getAppointments()).filter(a => a.clientId === id);
export const getPayments = async () => (mockPayments || []).map(p => ({...p, id: p.id.toString(), date: new Date(p.date), amount: p.amount, method: 'Stripe', status: 'Completed'}));
export const getPracticeMetrics = async () => ({ incomeMTD: 15400, unbilledAmount: 1200, missingNotesCount: 3, outstandingInvoicesCount: 2, totalActiveClients: (dbClients || []).length });
export const addAppointment = async (data: any) => ({...data, id: uuidv4()});
export const getFormSubmissions = async (filters: any) => (dbFormSubmissions || []).filter(s => !filters.clientId || s.clientId === filters.clientId);
export const saveFormSubmission = async (sub: any) => sub;
export const getSROPData = async (id: string) => (dbSropData || []).find(d => d.clientId === id) || null;
export const getClientActivityFeed = async (id: string) => (dbClientActivityFeed || []).filter(a => a.clientId === id);
export const saveClinicalNote = async (clientId: string, note: string) => true;
export const getMessages = async () => dbMessages || [];
export const getStaffMessages = async () => (dbMessages || []).filter(m => m.sender === 'counselor' || m.sender === 'system');
export const getConversation = async (clientId?: string) => dbMessages || [];
export const getFormTemplates = async () => dbFormTemplates || [];
export const getBillingSummary = async (id: string) => dbBillingSummaries[id];
export const getClientDocuments = async (id: string) => (dbClientDocuments || []).filter(d => d.clientId === id);
export const getClientAssignments = async (id: string) => (dbClientAssignments || []).filter(a => a.clientId === id);
export const addClientAssignment = async (assignment: any) => {};
export const addSignedDocument = async (doc: any) => {};
export const getForms = async () => dbForms || [];
export const assignForm = async (formId: string, clientIds: string[], dueDate: Date) => {};
export const getAiSuggestions = async (context: any) => (dbAiSuggestions || []).filter(s => s.contextId === context.clientId || s.contextId === context.documentId);
export const getNetworkScanners = async () => dbNetworkScanners || [];
export const addNetworkScanner = async (scanner: any) => {};
export const removeNetworkScanner = async (id: string) => {};
export const getProgressData = async () => [];
export const getVideoSessions = async () => dbVideoSessions || [];
export const getVideoSessionById = async (id: string) => (dbVideoSessions || []).find(s => s.id === id);
export const addVideoSession = async (s: any) => ({...s, id: uuidv4(), createdAt: new Date()});
export const updateVideoSessionStatus = async (id: string, status: string) => {};
export const getAsamAssessment = async (id: string) => dbAsamAssessments[id] || {1:{dimension:1, name:'Intoxication', notes:''}, 2:{dimension:2, name:'Biomedical', notes:''}, 3:{dimension:3, name:'Emotional', notes:''}, 4:{dimension:4, name:'Readiness', notes:''}, 5:{dimension:5, name:'Relapse', notes:''}, 6:{dimension:6, name:'Environment', notes:''}};
export const getProgramPlan = async (id: string) => dbProgramPlans[id] || {clientId: id, goals: []};
export const getComplianceEvents = async () => dbComplianceEvents || [];
export const getAuditLogs = async () => dbAuditLogs || [];
export const getDocumentForSigning = async (id: string) => (dbClientDocuments || []).find(d => d.id === id);
export const saveClientSignature = async (docId: string, signature: string) => ({success: true});
export const updateDocumentComplianceStatus = async (ids: string[], status: string, user: any) => [];
export const addSessionRecord = async (record: any) => {};
export const getComplianceAnalysis = async (client: any, sropData: any) => "Analysis";
export const generateFormSuggestions = async (field: string, context: string) => "Suggestion";
export const getDailyBriefingData = async () => ({ therapistStats: { reportingStreak: 10, caseloadSize: (dbClients || []).length, thisWeekCompletions: 2 }, todaysAppointments: (mockAppointments || []).slice(0,3), highPriorityAlerts: [], complianceRisks: [], clientMilestones: [] });
export const getWestFlowExecutiveSummary = async () => "Executive summary data";

export const getRevenueData = async (): Promise<RevenueDataPoint[]> => [
    { name: 'SATOP', revenue: 12500 },
    { name: 'REACT', revenue: 8400 },
    { name: 'Anger', revenue: 5200 },
    { name: 'Gambling', revenue: 3100 },
];

export const getComplianceTrendData = async (): Promise<ComplianceDataPoint[]> => [
    { month: 'Jan', score: 88 },
    { month: 'Feb', score: 91 },
    { month: 'Mar', score: 89 },
    { month: 'Apr', score: 94 },
    { month: 'May', score: 96 },
    { month: 'Jun', score: 98 },
];

export const resetDemoData = async () => {
    initializeDatabase();
};

/**
 * HIGH-STAKES CLINICAL ANALYSIS: Gemini 3 Pro with Max Thinking Budget.
 */
export const generateAsamAnalysis = async (notes: string): Promise<AsamAnalysisResult> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `Perform a High-Fidelity Multidimensional ASAM Analysis. Deliberate on cross-dimensional interactions. Priority: Regulatory Compliance (9 CSR 30-3). Notes: ${notes}`,
        config: {
            thinkingConfig: { thinkingBudget: 32768 }, 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    clinicalSummary: { type: Type.STRING },
                    recommendedLevel: { type: Type.STRING },
                    dimensionRisks: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { dimension: { type: Type.STRING }, riskLevel: { type: Type.STRING } } } },
                    treatmentRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["clinicalSummary", "recommendedLevel", "dimensionRisks", "treatmentRecommendations"]
            }
        }
    });
    return JSON.parse(response.text || "{}");
};

/**
 * SPEED-OPTIMIZED CLINICAL SYNTHESIS: Gemini 3 Flash.
 */
export const generateSoapNoteFromTranscript = async (transcript: string, clientName: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Construct a structural SOAP note for ${clientName}. Content must be HIPAA-compliant. Source: ${transcript}`
    });
    return response.text || '';
};

export const generateClinicalSnapshot = async (client: Client) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Synthesize operational intelligence for client ${client.name} (Program: ${client.program}, County: ${client.county}). Identify critical workflow bottlenecks.`
    });
    return response.text || '';
};

/**
 * COMMUNITY RESOURCE FINDER: Google Maps Grounding via Gemini 2.5 Flash.
 */
export const searchCommunityResources = async (query: string, coords?: { latitude: number, longitude: number }) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Urgently locate verified community recovery resources for: ${query}. Focus on St. Louis/Jefferson County. Provide direct access links and place reviews.`,
        config: { 
            tools: [{ googleMaps: {} }],
            toolConfig: coords ? {
                retrievalConfig: {
                    latLng: {
                        latitude: coords.latitude,
                        longitude: coords.longitude
                    }
                }
            } : undefined
        }
    });
    return {
        text: response.text || '',
        chunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
};

/**
 * RELAPSE RISK PREDICTION: Gemini 3 reasoning for proactive clinical flagging.
 */
export const generateRelapseRiskPrediction = async (client: Client, history: any[]) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Analyze historical telemetry for ${client.name} to predict relapse probability. Signals: ${JSON.stringify(history)}. Return probability (0-100) and rationale.`,
        config: {
            thinkingConfig: { thinkingBudget: 4000 },
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    score: { type: Type.NUMBER },
                    reasoning: { type: Type.STRING }
                },
                required: ["score", "reasoning"]
            }
        }
    });
    try {
        return JSON.parse(response.text || '{"score": 0, "reasoning": "Processing error"}');
    } catch {
        return { score: 0, reasoning: "Orchestration timeout." };
    }
};

/**
 * MILESTONE VIDEO GENERATION: Veo-3.1 Milestone celebrations.
 */
export const generateMilestoneCelebration = async (clientName: string, milestone: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    if (!(await (window as any).aistudio.hasSelectedApiKey())) {
        await (window as any).aistudio.openSelectKey();
    }
    
    let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: `A vibrant cinematic celebration for ${clientName} completing ${milestone}. Background shows a sunrise over a peaceful road, symbolizing a new path in recovery. Inspirational, cinematic 4k style.`,
        config: {
            numberOfVideos: 1,
            resolution: '1080p',
            aspectRatio: '16:9'
        }
    });
    
    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
    }
    
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    return `${downloadLink}&key=${process.env.API_KEY}`;
};

export const addClient = async (clientData: any) => ({ ...clientData, id: uuidv4(), initials: clientData.name ? clientData.name.split(' ').map((n: string) => n[0]).join('') : '??', avatarUrl: `https://i.pravatar.cc/150?u=${uuidv4()}` });
export const analyzeTravelRisk = async (id: string, date: string, time: string) => ({ risk: 'Low' as const, reason: 'Commute cleared by GeMyndFlow Dispatcher.' });
export const getSessionRecords = async (id: string) => (dbSessionRecords || []).filter(r => r.clientId === id);

export const processDocument = async (file: File, apiKey: string, clientId: string, clientName: string, onProgress: (p: number) => void): Promise<DocumentFile> => {
    onProgress(30);
    const dna = await storageService.extractDocumentDNA(file);
    onProgress(100);
    return {
        id: uuidv4(), nodeId: '', clientId, clientName, filename: file.name, uploadDate: new Date(), fileSize: file.size, 
        mimeType: file.type, url: '', sql_metadata_id: '', gcs_file_path: '',
        extractedData: { summary: dna.summary, fields: [], actionItems: [], suggestedSubfolder: 'Intake' },
        complianceStatus: 'Pending', auditTrail: [], documentType: 'Unknown'
    };
};
