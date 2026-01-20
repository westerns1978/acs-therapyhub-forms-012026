import {
  User, Client, Appointment, Message, SROPProgress, SignedDocument, ComplianceEvent,
  AuditLog, ProgramPlan, SessionRecord, ClientAssignment, AsamAssessmentData, Payment,
  DocumentFile, StaffCertification, Integration, FormTemplate, ClientDocument, BillingSummary,
  FileSystemNode, AiSuggestion, ClientActivity, NetworkScanner, Form, FormSubmission, VideoSession
} from '../types';

// --- DYNAMIC DATE HELPERS ---
const today = new Date();
const getRelativeDate = (daysOffset: number, timeStr?: string): Date => {
    const d = new Date(today);
    d.setDate(today.getDate() + daysOffset);
    if (timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        d.setHours(hours, minutes, 0, 0);
    } else {
        d.setHours(9, 0, 0, 0); // Default to 9am
    }
    return d;
};

const getRelativeDateStr = (daysOffset: number): string => {
    return getRelativeDate(daysOffset).toISOString();
};

const getRelativeMonthStr = (monthOffset: number): string => {
    const d = new Date(today);
    d.setMonth(today.getMonth() + monthOffset);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
};

// --- INITIAL STATE ---

const initialDbUsers: User[] = [
    { id: 'user1', name: 'Dr. Anya Sharma', email: 'dr.anya@therapyhub.com', role: 'Clinical' },
    { id: 'user2', name: 'David Yoder', email: 'david.yoder@therapyhub.com', role: 'Admin' },
];

export const programDocuments = {
  SATOP_Level_IV: ['Initial Assessment', 'Weekly Progress Notes', 'Court Order', 'Completion Certificate', 'DMV Notification', 'Payment Records'],
  Individual_Counseling: ['Intake Form', 'Treatment Plan', 'Session Notes', 'Progress Evaluations', 'Insurance Documentation'],
  Substance_Use_Assessment: ['Assessment Report', 'Recommendations', 'Referral Documentation', 'Follow-up Notes']
};

const initialDbClients: Omit<Client, 'initials'>[] = [
    {
        id: '1', name: 'Alice Johnson', phone: '314-555-1234', avatarUrl: 'https://i.pravatar.cc/150?img=1', lastSession: getRelativeDateStr(-2), program: 'SROP', programType: 'SATOP_Level_IV', status: 'Compliant', enrollmentDate: getRelativeDateStr(-45), completionPercentage: 75, nextDeadline: getRelativeDateStr(12), missingDocuments: ['DMV Notification'], caseNumber: 'STL-2024-001', probationOfficer: 'Jane Doe', licenseStatus: 'Reinstated', dwiConvictions: 1, billingType: 'Court Mandate', county: 'St. Louis', referralSource: 'St. Louis County Court', interlockStatus: 'Compliant', gamification: { points: 1250, badges: ['Phase 1 Complete', 'Consistent Attendance', '50% Done'] }, complianceScore: 95, attendanceHistory: ['present', 'present', 'late', 'present'], folder_link: 'https://console.cloud.google.com/storage/browser/acs-therapy-hub-sample-docs',
    },
    {
        id: '2', name: 'Bob Williams', phone: '636-555-5678', avatarUrl: 'https://i.pravatar.cc/150?img=2', lastSession: getRelativeDateStr(-5), program: 'REACT', programType: 'Individual_Counseling', status: 'Non-Compliant', enrollmentDate: getRelativeDateStr(-20), completionPercentage: 30, nextDeadline: getRelativeDateStr(-3), missingDocuments: ['Treatment Plan', 'Insurance Documentation'], caseNumber: 'JEF-2024-005', probationOfficer: 'John Smith', licenseStatus: 'Suspended', dwiConvictions: 2, billingType: 'State Funded', county: 'Jefferson', referralSource: 'Jefferson County Court', interlockStatus: 'Violation', gamification: { points: 450, badges: [] }, complianceScore: 65, attendanceHistory: ['present', 'absent', 'present', 'absent'], folder_link: 'https://console.cloud.google.com/storage/browser/acs-therapy-hub-sample-docs',
    },
    {
        id: '3', name: 'Charlie Brown', phone: '314-555-9876', avatarUrl: 'https://i.pravatar.cc/150?img=3', lastSession: getRelativeDateStr(-60), program: 'Anger Management', programType: 'Individual_Counseling', status: 'Completed', enrollmentDate: getRelativeDateStr(-120), completionPercentage: 100, missingDocuments: [], caseNumber: 'STL-2023-101', probationOfficer: 'Jane Doe', licenseStatus: 'Valid', dwiConvictions: 1, billingType: 'Sliding Scale', county: 'St. Louis', referralSource: 'Self-referred', interlockStatus: 'Not Required', gamification: { points: 2000, badges: ['Program Graduate', 'Perfect Attendance', 'Compliance Champion'] }, complianceScore: 100, attendanceHistory: ['present', 'present', 'present', 'present'], folder_link: 'https://console.cloud.google.com/storage/browser/acs-therapy-hub-sample-docs',
    },
    {
        id: '4', name: 'Diana Prince', phone: '314-555-4444', avatarUrl: 'https://i.pravatar.cc/150?img=5', lastSession: getRelativeDateStr(-1), program: 'SROP', programType: 'SATOP_Level_IV', status: 'Compliant', enrollmentDate: getRelativeDateStr(-10), completionPercentage: 15, nextDeadline: getRelativeDateStr(20), missingDocuments: [], caseNumber: 'STL-2024-045', probationOfficer: 'Steve Trevor', licenseStatus: 'Suspended', dwiConvictions: 1, billingType: 'Insurance', county: 'St. Louis', referralSource: 'Attorney', interlockStatus: 'Awaiting Installation', gamification: { points: 150, badges: ['First Steps'] }, complianceScore: 92, attendanceHistory: ['present', 'present'], folder_link: '',
    },
    {
        id: '5', name: 'Evan Wright', phone: '636-555-2222', avatarUrl: 'https://i.pravatar.cc/150?img=8', lastSession: getRelativeDateStr(-14), program: 'DOT', programType: 'Substance_Use_Assessment', status: 'Warrant Issued', enrollmentDate: getRelativeDateStr(-90), completionPercentage: 40, nextDeadline: getRelativeDateStr(-10), missingDocuments: ['Court Order', 'Payment Records'], caseNumber: 'JEF-2023-888', probationOfficer: 'Unknown', licenseStatus: 'Revoked', dwiConvictions: 3, billingType: 'Court Mandate', county: 'Jefferson', referralSource: 'Probation', interlockStatus: 'Violation', gamification: { points: 0, badges: [] }, complianceScore: 25, attendanceHistory: ['absent', 'absent', 'late'], folder_link: '',
    },
    {
        id: '6', name: 'Fiona Gallagher', phone: '314-555-7777', avatarUrl: 'https://i.pravatar.cc/150?img=9', lastSession: getRelativeDateStr(-3), program: 'Compulsive Gambling', programType: 'Individual_Counseling', status: 'Compliant', enrollmentDate: getRelativeDateStr(-60), completionPercentage: 60, nextDeadline: getRelativeDateStr(5), missingDocuments: [], caseNumber: 'STL-2024-112', probationOfficer: 'Jimmy Steve', licenseStatus: 'Valid', dwiConvictions: 0, billingType: 'Sliding Scale', county: 'St. Louis', referralSource: 'Self-referred', interlockStatus: 'Not Required', gamification: { points: 800, badges: ['Consistent Attendance'] }, complianceScore: 98, attendanceHistory: ['present', 'present', 'present', 'present'], folder_link: '',
    },
    {
        id: '7', name: 'George Miller', phone: '314-555-3333', avatarUrl: 'https://i.pravatar.cc/150?img=11', lastSession: getRelativeDateStr(0), program: 'SROP', programType: 'SATOP_Level_IV', status: 'Compliant', enrollmentDate: getRelativeDateStr(-5), completionPercentage: 5, nextDeadline: getRelativeDateStr(25), missingDocuments: ['Intake Assessment'], caseNumber: 'STL-2024-200', probationOfficer: 'Max Rockatansky', licenseStatus: 'Suspended', dwiConvictions: 1, billingType: 'Court Mandate', county: 'St. Louis', referralSource: 'Court', interlockStatus: 'Compliant', gamification: { points: 50, badges: [] }, complianceScore: 100, attendanceHistory: ['present'], folder_link: '',
    },
    {
        id: '8', name: 'Hannah Abbott', phone: '636-555-9999', avatarUrl: 'https://i.pravatar.cc/150?img=12', lastSession: getRelativeDateStr(-4), program: 'REACT', programType: 'Individual_Counseling', status: 'Non-Compliant', enrollmentDate: getRelativeDateStr(-30), completionPercentage: 20, nextDeadline: getRelativeDateStr(-1), missingDocuments: ['Payment Records'], caseNumber: 'JEF-2024-123', probationOfficer: 'Neville L.', licenseStatus: 'Suspended', dwiConvictions: 1, billingType: 'State Funded', county: 'Jefferson', referralSource: 'Court', interlockStatus: 'Compliant', gamification: { points: 300, badges: [] }, complianceScore: 78, attendanceHistory: ['late', 'present', 'absent'], folder_link: '',
    }
];

const initialDbFileSystem: FileSystemNode[] = [
  { id: 'root-active', name: 'Active Clients', type: 'folder' },
  { id: 'root-archived', name: 'Archived Clients', type: 'folder' },
  { id: 'root-templates', name: 'Templates', type: 'folder' },
  { id: 'root-admin', name: 'Administrative', type: 'folder' },
  { id: 'root-reports', name: 'Reports', type: 'folder' },
];

const GCS_BASE_URL = 'https://storage.googleapis.com/acs-therapy-hub-sample-docs/';

const initialDbDocumentFiles: DocumentFile[] = [
    // Alice Johnson Docs
    {
        id: `doc-1-1`, nodeId: '', clientId: '1', clientName: 'Alice Johnson', filename: 'Intake Assessment.pdf', documentType: 'Intake_Form',
        gcs_file_path: 'gs://acs-therapy-documents/1/Intake/Intake_Assessment.pdf', url: `${GCS_BASE_URL}Sample-Intake-Assessment.pdf`, sql_metadata_id: 'meta-1-1',
        uploadDate: getRelativeDate(-45), fileSize: 120400, mimeType: 'application/pdf',
        extractedData: { summary: 'Initial ASAM assessment for Alice Johnson.', fields: [], actionItems: [], suggestedSubfolder: 'Intake' },
        complianceStatus: 'Approved', auditTrail: [{ timestamp: getRelativeDate(-45), user: 'Dr. Anya Sharma', action: 'Uploaded' }],
    },
    {
        id: `doc-1-2`, nodeId: '', clientId: '1', clientName: 'Alice Johnson', filename: 'Court Order.pdf', documentType: 'Court_Order',
        gcs_file_path: 'gs://acs-therapy-documents/1/Compliance/Court_Order.pdf', url: `${GCS_BASE_URL}Sample-Court-Order.pdf`, sql_metadata_id: 'meta-1-2',
        uploadDate: getRelativeDate(-44), fileSize: 85200, mimeType: 'application/pdf',
        extractedData: { summary: 'Court order mandating Level IV SATOP completion.', fields: [{field: "Case Number", value: "STL-2024-001", confidence: 0.98}], actionItems: ['Set compliance deadline'], suggestedSubfolder: 'Compliance' },
        complianceStatus: 'Approved', auditTrail: [{ timestamp: getRelativeDate(-44), user: 'Dr. Anya Sharma', action: 'Uploaded' }],
    },
    // Bob Williams Docs
    {
        id: 'doc-2-1', nodeId: '', clientId: '2', clientName: 'Bob Williams', filename: 'Counseling Intake.pdf', documentType: 'Intake_Form',
        gcs_file_path: 'gs://acs-therapy-documents/2/Intake/Counseling_Intake.pdf', url: `${GCS_BASE_URL}Sample-Intake-Assessment.pdf`, sql_metadata_id: 'meta-2-1',
        uploadDate: getRelativeDate(-20), fileSize: 120400, mimeType: 'application/pdf',
        extractedData: { summary: 'Intake for individual counseling.', fields: [], actionItems: ['Develop treatment plan'], suggestedSubfolder: 'Intake' },
        complianceStatus: 'Approved', auditTrail: [{ timestamp: getRelativeDate(-20), user: 'Dr. Anya Sharma', action: 'Uploaded' }],
    },
    // System Docs
    {
        id: 'doc-sys-1', nodeId: '', clientId: 'SYSTEM', clientName: 'ACS System', filename: 'ACS_Compliance_Manual_2024.pdf', documentType: 'Unknown',
        gcs_file_path: 'gs://acs-therapy-documents/system/ACS_Compliance_Manual.pdf', url: `${GCS_BASE_URL}Sample-Compliance-Manual.pdf`, sql_metadata_id: 'meta-sys-1',
        uploadDate: new Date('2024-01-01'), fileSize: 1250000, mimeType: 'application/pdf',
        extractedData: { summary: 'Official ACS compliance manual for 2024.', fields: [], actionItems: [] },
        complianceStatus: 'Approved', auditTrail: [{ timestamp: new Date(), user: 'David Yoder', action: 'Uploaded' }]
    }
];

const initialDbSropData: SROPProgress[] = [
    { clientId: '1', totalHours: 75, phase1: { title: 'Phase I: Education & Awareness', requiredHours: 25, completedHours: 25 }, phase2: { title: 'Phase II: Relapse Prevention', requiredHours: 50, completedHours: 31.5 }, drugScreens: [{ date: getRelativeDateStr(-10), testType: '5-Panel Urine', chainOfCustodyId: 'COC-789123', result: 'Negative' }] },
    { clientId: '2', totalHours: 75, phase1: { title: 'Phase I: Education & Awareness', requiredHours: 25, completedHours: 10 }, phase2: { title: 'Phase II: Relapse Prevention', requiredHours: 50, completedHours: 5 }, drugScreens: [{ date: getRelativeDateStr(-5), testType: '5-Panel Urine', chainOfCustodyId: 'COC-456789', result: 'Positive' }] },
];

const initialDbMessages: Message[] = [
    { id: 'msg1', sender: 'client', clientName: 'Alice Johnson', avatarUrl: 'https://i.pravatar.cc/150?img=1', text: 'I have a question about my next session.', timestamp: '10:30 AM', read: false, status: 'delivered' },
    { id: 'msg2', sender: 'client', clientName: 'Bob Williams', avatarUrl: 'https://i.pravatar.cc/150?img=2', text: 'I need to reschedule my appointment for tomorrow.', timestamp: 'Yesterday', read: true, status: 'read' },
    { id: 'msg3', sender: 'system', clientName: 'System', avatarUrl: '', text: 'New court report request received for Client #2.', timestamp: '9:00 AM', read: false, status: 'delivered' }
];

const initialDbComplianceEvents: ComplianceEvent[] = [
    { id: 'ce1', clientId: '1', clientName: 'Alice Johnson', type: 'Program Plan Review', dueDate: getRelativeDate(10), status: 'upcoming' },
    { id: 'ce2', clientId: '2', clientName: 'Bob Williams', type: 'Court Report Due', dueDate: getRelativeDate(-5), status: 'overdue' },
    { id: 'ce3', clientId: '4', clientName: 'Diana Prince', type: 'ASAM Reassessment', dueDate: getRelativeDate(15), status: 'upcoming' },
];

const initialDbAuditLogs: AuditLog[] = [
    { id: 'al1', timestamp: getRelativeDate(0, '08:30'), user: 'Dr. Anya Sharma', action: 'Client Check-in', details: 'Alice Johnson checked into SROP Group' },
    { id: 'al2', timestamp: getRelativeDate(0, '09:15'), user: 'David Yoder', action: 'Generate Report', details: 'Generated monthly compliance report' },
    { id: 'al3', timestamp: getRelativeDate(-1, '14:20'), user: 'Dr. Anya Sharma', action: 'Note Created', details: 'SOAP note created for Bob Williams' },
];

const initialDbClientDocuments: ClientDocument[] = [
    { id: 'cldoc1', clientId: '1', title: 'Informed Consent for Program Participation', status: 'Completed', lastModified: getRelativeDateStr(-45) },
    { id: 'cldoc2', clientId: '1', title: 'Program Plan Approval', status: 'Completed', lastModified: getRelativeDateStr(-44) },
];

const initialDbAiSuggestions: AiSuggestion[] = [
    { id: 'sug1', contextId: '1', type: 'missing_document', message: "Alice is nearing program completion but her DMV Notification form hasn't been filed.", actionText: "Generate Form", priority: 'high' },
    { id: 'sug3', contextId: '2', type: 'deadline_alert', message: "Bob's court report is overdue. A notification should be sent to his probation officer.", actionText: "Send Notification", priority: 'high' },
];

const initialDbClientActivityFeed: ClientActivity[] = [
    { id: 'act-a-1', clientId: '1', timestamp: getRelativeDate(-1), type: 'Session', description: 'Attended SROP Group session.' },
    { id: 'act-b-1', clientId: '2', timestamp: getRelativeDate(-2), type: 'Session', description: 'Attended REACT Group session.' },
    { id: 'act-a-2', clientId: '1', timestamp: getRelativeDate(-3), type: 'Achievement', description: "Earned 'Consistent Attendance' badge!" },
    { id: 'act-a-5', clientId: '1', timestamp: getRelativeDate(-5), type: 'Payment', description: 'Payment of $150.00 was successfully processed.' },
];

const initialDbNetworkScanners: NetworkScanner[] = [
    { id: 'scanner-1', name: 'Front Desk Scanner', ipAddress: '192.168.1.101', model: 'Epson DS-790WN', location: 'Main Office', status: 'Online' },
    { id: 'scanner-2', name: 'Dr. Sharma\'s Office', ipAddress: '192.168.1.102', model: 'Epson DS-790WN', location: 'Main Office', status: 'Offline' },
];

const initialDbForms: Form[] = [
    { id: 'form-crp-1', title: 'Continuing Recovery Plan', category: 'Recovery Plans', description: 'A collaborative plan to support long-term recovery goals.', format: 'electronic', pdfUrl: '' },
    { id: 'form-intake-1', title: 'SATOP Intake Packet', category: 'Intake', description: 'Standard intake forms for SATOP programs.', format: 'electronic', pdfUrl: '' }
];

const initialDbFormSubmissions: FormSubmission[] = [
    { id: 'sub-1', formId: 'form-crp-1', clientId: '1', status: 'Completed', submittedAt: getRelativeDate(-2), assignedAt: getRelativeDate(-10), dueDate: getRelativeDate(0) },
    { id: 'sub-2', formId: 'form-crp-1', clientId: '2', status: 'In Progress', assignedAt: getRelativeDate(-5), dueDate: getRelativeDate(-1) },
];

const initialDbVideoSessions: VideoSession[] = [
    {
        id: 'vs-1', clientId: '1', clientName: 'Alice Johnson', therapistId: 'user1', therapistName: 'Dr. Anya Sharma',
        zoomMeetingId: '987654321', zoomJoinUrl: 'https://zoom.us/j/987654321',
        startTime: getRelativeDate(0, '14:00'), durationMinutes: 50, status: 'scheduled', createdAt: new Date()
    },
    {
        id: 'vs-2', clientId: '2', clientName: 'Bob Williams', therapistId: 'user1', therapistName: 'Dr. Anya Sharma',
        zoomMeetingId: '123456789', zoomJoinUrl: 'https://zoom.us/j/123456789',
        startTime: getRelativeDate(-2, '10:00'), durationMinutes: 50, status: 'completed', createdAt: getRelativeDate(-3)
    }
];

// --- MUTABLE DATABASE STATE ---

export let dbUsers: User[] = [];
export let dbClients: Client[] = [];
export let dbFileSystem: FileSystemNode[] = [];
export let dbDocumentFiles: DocumentFile[] = [];
export let dbAppointments: Appointment[] = [];
export let dbSignedDocuments: SignedDocument[] = [];
export let dbClientAssignments: ClientAssignment[] = [];
export let dbMessages: Message[] = [];
export let dbSropData: SROPProgress[] = [];
export let dbComplianceEvents: ComplianceEvent[] = [];
export let dbAuditLogs: AuditLog[] = [];
export let dbProgramPlans: Record<string, ProgramPlan> = {};
export let dbSessionRecords: SessionRecord[] = [];
export let dbAsamAssessments: Record<string, AsamAssessmentData> = {};
export let dbPayments: Payment[] = [];
export let dbFormTemplates: FormTemplate[] = [];
export let dbClientDocuments: ClientDocument[] = [];
export let dbBillingSummaries: Record<string, BillingSummary> = {};
export let dbStaffCertifications: StaffCertification[] = [];
export let dbIntegrations: Integration[] = [];
export let dbAiSuggestions: AiSuggestion[] = [];
export let dbClientActivityFeed: ClientActivity[] = [];
export let dbNetworkScanners: NetworkScanner[] = [];
export let dbForms: Form[] = [];
export let dbFormSubmissions: FormSubmission[] = [];
export let dbVideoSessions: VideoSession[] = [];


// --- INITIALIZATION LOGIC ---

export const initializeDatabase = () => {
    dbUsers = JSON.parse(JSON.stringify(initialDbUsers));
    dbClients = JSON.parse(JSON.stringify(initialDbClients)).map((c: any) => ({
        ...c,
        initials: (c.name || '??').split(' ').map((n: string) => n[0]).join(''),
        missingDocuments: c.missingDocuments || [],
        gamification: c.gamification || { points: 0, badges: [] },
        attendanceHistory: c.attendanceHistory || []
    }));
    dbFileSystem = JSON.parse(JSON.stringify(initialDbFileSystem));
    dbDocumentFiles = JSON.parse(JSON.stringify(initialDbDocumentFiles));
    dbSropData = JSON.parse(JSON.stringify(initialDbSropData));
    dbMessages = JSON.parse(JSON.stringify(initialDbMessages));
    dbComplianceEvents = JSON.parse(JSON.stringify(initialDbComplianceEvents));
    dbAuditLogs = JSON.parse(JSON.stringify(initialDbAuditLogs));
    dbClientDocuments = JSON.parse(JSON.stringify(initialDbClientDocuments));
    dbAiSuggestions = JSON.parse(JSON.stringify(initialDbAiSuggestions));
    dbClientActivityFeed = JSON.parse(JSON.stringify(initialDbClientActivityFeed));
    dbNetworkScanners = JSON.parse(JSON.stringify(initialDbNetworkScanners));
    dbForms = JSON.parse(JSON.stringify(initialDbForms));
    dbFormSubmissions = JSON.parse(JSON.stringify(initialDbFormSubmissions));
    dbVideoSessions = JSON.parse(JSON.stringify(initialDbVideoSessions));

    // Dynamic Appointments for a "Full" Calendar
    dbAppointments = [
        // Today
        { id: 'apt-t-1', title: 'Individual Counseling', type: 'Individual Counseling', date: getRelativeDate(0), startTime: '09:00 AM', endTime: '09:50 AM', modality: 'Virtual (Zoom)', therapist: 'Dr. Anya Sharma', status: 'Scheduled', clientId: '1', clientName: 'Alice Johnson', zoomLink: 'https://zoom.us/j/123' },
        { id: 'apt-t-2', title: 'SROP Group Session', type: 'SATOP Group', date: getRelativeDate(0), startTime: '10:00 AM', endTime: '11:30 AM', modality: 'In-Person', therapist: 'Bill Sunderman', status: 'Scheduled', attendees: [{clientId: '1', attendanceStatus: 'Awaiting'}, {clientId: '4', attendanceStatus: 'Awaiting'}] },
        { id: 'apt-t-3', title: 'Individual Counseling', type: 'Individual Counseling', date: getRelativeDate(0), startTime: '01:00 PM', endTime: '01:50 PM', modality: 'Virtual (Zoom)', therapist: 'Dr. Anya Sharma', status: 'Scheduled', clientId: '7', clientName: 'George Miller', zoomLink: 'https://zoom.us/j/456' },
        { id: 'apt-t-4', title: 'New Client Intake', type: 'Intake Assessment', date: getRelativeDate(0), startTime: '02:30 PM', endTime: '04:00 PM', modality: 'In-Person', therapist: 'Dr. Anya Sharma', status: 'Scheduled', clientId: '3', clientName: 'Charlie Brown' },
        
        // Yesterday
        { id: 'apt-y-1', title: 'REACT Group', type: 'REACT Group', date: getRelativeDate(-1), startTime: '05:30 PM', endTime: '07:30 PM', modality: 'In-Person', therapist: 'Sarah Jenkins', status: 'Completed', attendees: [{clientId: '2', attendanceStatus: 'Present'}, {clientId: '8', attendanceStatus: 'Late'}] },
        
        // Tomorrow
        { id: 'apt-tm-1', title: 'Individual Counseling', type: 'Individual Counseling', date: getRelativeDate(1), startTime: '10:00 AM', endTime: '10:50 AM', modality: 'Virtual (Zoom)', therapist: 'Dr. Anya Sharma', status: 'Scheduled', clientId: '6', clientName: 'Fiona Gallagher' },
        
        // Recurring Weekly
        { id: 'apt-w-1', title: 'Anger Management Group', type: 'Anger Management Group', date: getRelativeDate(3), startTime: '06:00 PM', endTime: '07:30 PM', modality: 'In-Person', therapist: 'David Yoder', status: 'Scheduled' },
    ];

    dbSignedDocuments = [];
    dbClientAssignments = [
        { id: 'as1', clientId: '1', task: 'Complete Relapse Prevention worksheet.', dueDate: getRelativeDate(5), isComplete: false },
        { id: 'as2', clientId: '1', task: 'Attend 2 verified AA meetings.', dueDate: getRelativeDate(7), isComplete: true },
    ];
    
    dbProgramPlans = {};
    
    // Recent Session Records for Billing
    dbSessionRecords = [
        { id: 'sr1', clientId: '1', date: getRelativeDate(-2), type: 'Individual Session', duration: 50, rate: 150.00, status: 'Unpaid' },
        { id: 'sr2', clientId: '1', date: getRelativeDate(-9), type: 'Individual Session', duration: 50, rate: 150.00, status: 'Paid' },
        { id: 'sr3', clientId: '2', date: getRelativeDate(-5), type: 'Individual Session', duration: 50, rate: 150.00, status: 'Unpaid' },
        { id: 'sr4', clientId: '2', date: getRelativeDate(-12), type: 'Individual Session', duration: 50, rate: 150.00, status: 'Unpaid' },
    ];
    
    dbAsamAssessments = {};
    
    // Payments this month
    dbPayments = [
        { id: 'pay1', date: getRelativeDate(-3), clientName: 'Alice Johnson', method: 'Credit Card', status: 'Completed', amount: 150.00 },
        { id: 'pay2', date: getRelativeDate(-10), clientName: 'Bob Williams', method: 'Stripe', status: 'Completed', amount: 75.00 },
        { id: 'pay3', date: getRelativeDate(-15), clientName: 'Fiona Gallagher', method: 'Insurance', status: 'Completed', amount: 120.00 },
    ];
    
    dbFormTemplates = [
        { id: 'tpl1', title: 'SATOP Intake Packet', category: 'Intake', lastModified: '2024-07-15', fieldCount: 45 },
        { id: 'tpl2', title: 'Court Compliance Monthly Report', category: 'Compliance', lastModified: '2024-06-20', fieldCount: 12 },
    ];
    
    dbBillingSummaries = {
        '1': {
            clientId: '1', currentBalance: 150.00, paymentMethod: 'Card on File',
            transactions: [
                { id: 'tx1', date: getRelativeDateStr(-2), description: 'Individual Session', charge: 150.00, payment: null, balance: 150.00 },
                { id: 'tx2', date: getRelativeDateStr(-3), description: 'Payment Received', charge: null, payment: 150.00, balance: 0.00 },
            ]
        }
    };
    
    dbStaffCertifications = [
      { id: 'cert1', staffName: 'Dr. Anya Sharma', credential: 'LPC', renewalDate: getRelativeDate(365) },
      { id: 'cert2', staffName: 'David Yoder', credential: 'CADC', renewalDate: getRelativeDate(-30) }, // Expired
    ];
    
    dbIntegrations = [
        { id: 'google_calendar', name: 'Google Calendar Sync', status: 'Connected', description: 'Sync your TherapyHub schedule with Google Calendar.' },
        { id: 'quickbooks', name: 'QuickBooks Online', status: 'Connected', description: 'Sync billing and payments with QuickBooks.' },
        { id: 'zoom', name: 'Zoom Meetings', status: 'Disconnected', description: 'Generate secure meeting links automatically.' },
    ];
};

// Initialize DB on first load
initializeDatabase();