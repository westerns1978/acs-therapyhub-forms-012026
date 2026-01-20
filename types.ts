
import React from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Clinical';
}

export interface Client {
  id: string;
  name: string;
  initials: string;
  email?: string;
  phone: string;
  avatarUrl: string;
  lastSession: string;
  program: 'SATOP' | 'REACT' | 'Anger Management' | 'Compulsive Gambling' | 'DOT' | 'Individual Counseling' | 'SROP';
  programType: 'SATOP_Level_IV' | 'Individual_Counseling' | 'Substance_Use_Assessment';
  status: 'Compliant' | 'Non-Compliant' | 'Warrant Issued' | 'Completed' | 'Archived';
  enrollmentDate: string;
  completionPercentage: number;
  nextDeadline?: string;
  missingDocuments: string[];
  caseNumber: string;
  probationOfficer: string;
  licenseStatus: 'Valid' | 'Suspended' | 'Revoked' | 'Reinstated';
  dwiConvictions: number;
  billingType: 'Court Mandate' | 'Employer Mandate' | 'State Funded' | 'Insurance' | 'Sliding Scale';
  county: 'St. Louis' | 'Jefferson';
  referralSource: string;
  interlockStatus: 'Not Required' | 'Compliant' | 'Violation' | 'Awaiting Installation';
  gamification: {
    points: number;
    badges: string[];
  };
  complianceScore: number;
  attendanceHistory: ('present' | 'late' | 'absent')[];
  folder_link?: string;
}

// Shared types for all forms
export type FormErrors<T> = {
  [K in keyof T]?: string;
};

export interface FormSectionProps<T> {
  formData: T;
  setFormData: React.Dispatch<React.SetStateAction<T>>;
  errors: FormErrors<T>;
}

export type FieldDefinition = {
  key: string;
  label: string;
  type?: 'boolean' | 'string' | 'date' | 'object' | 'rating';
};

export type FormDefinition<T> = {
  id: string;
  title: string;
  description: string;
  category: 'Intake' | 'Assessment' | 'Treatment' | 'Legal' | 'Clinical' | 'Testing';
  initialState: T;
  steps: React.FC<FormSectionProps<T>>[];
  validateStep: (step: number, data: T) => FormErrors<T>;
  fieldDefinitions: FieldDefinition[];
  successScreen?: {
    googleReview?: boolean;
  };
  estimatedTime?: string;
  difficulty?: 'Simple' | 'Moderate' | 'Complex';
  isNew?: boolean;
  isRecommended?: boolean;
  tags?: string[];
};

// --- Form Data Interfaces ---

export interface RecoveryPlanData {
  clientName: string;
  dateOfBirth: string;
  caseNumber: string;
  dateOfPlan: string;
  clientEmail: string;
  remainSober: boolean | null;
  problemsToAddress: string;
  howToAddressProblems: string;
  peoplePlacesThingsToAvoid: string;
  changesNoticed: string;
  whatToDoIfWantToUse: string;
  relapsePreventionSteps: string;
  whoSupportsRecovery: string;
  meetingsToAttend: string;
  sponsorDate: string;
  prescribedMedications: boolean | null;
  clearOnDosing: boolean | null;
  dailyRecoveryActivities: string;
  signature: string;
  acknowledgment: boolean;
  primaryGoals: string;
  goalMotivations: string;
  supportPeople: Array<{ name: string; relationship: string; contact: string; role: string }>;
  supportGroups: string;
  therapistName: string;
  therapistContact: string;
  triggers: string;
  copingSkills: string;
  emergencyContacts: string;
  actionSteps: Array<{ step: string; targetDate: string; completed: boolean }>;
  signatureDataUrl: string;
}

export interface ConsentForTreatmentData {
  clientName: string;
  clientEmail: string;
  groupDays: { [key: string]: boolean };
  groupTimeFrom: string;
  groupTimeTo: string;
  understandsAttendancePolicy: boolean;
  agreesToFee: boolean;
  understandsCancellationPolicy: boolean;
  understandsExcusedAbsences: boolean;
  agreesToAbstinence: boolean;
  consentsToTesting: boolean;
  understandsConsequences: boolean;
  acknowledgesMarijuanaPolicy: boolean;
  disclosedMedications: string;
  disclosesControlledSubstances: boolean;
  disclosesMedicalIssues: boolean;
  agreesToSupportGroups: boolean;
  clientSignature: string;
  staffSignature: string;
  date: string;
}

export interface MeetingReportData {
  clientName: string;
  groupName: string;
  location: string;
  dateAttended: string;
  timeAttended: string;
  meetingType: {
    aa: boolean; na: boolean; speaker: boolean; discussion: boolean;
    bigBook: boolean; step: boolean; open: boolean; closed: boolean;
  };
  meetingSubject: string;
  whatApplied: string;
  whatLearned: string;
  chairpersonSignature: string;
}

export interface EmergencyContactData {
  clientName: string;
  clientEmail: string;
  contactName: string;
  relationship: string;
  primaryPhone: string;
  secondaryPhone: string;
  permissionToContact: boolean;
  disclosureChoice: 'accept' | 'deny' | null;
  clientSignature: string;
  witnessSignature: string;
  date: string;
}

export interface DischargeSummaryData {
  clientName: string;
  clientEmail: string;
  admissionDate: string;
  dischargeDate: string;
  referralSource: string;
  diagnosis: string;
  reasonForAdmission: string;
  servicesProvided: string;
  problem1_plan: string;
  problem1_outcome: string;
  problem2_plan: string;
  problem2_outcome: string;
  problem3_plan: string;
  problem3_outcome: string;
  reasonForDischarge: { completed: boolean; clientRequest: boolean; nonCompliance: boolean; other: boolean; };
  otherReason: string;
  prognosis: string;
  medicalStatus: string;
  recommendedFollowUp: string;
  counselorSignature: string;
  counselorCredentials: string;
  signatureDate: string;
}

export interface TelehealthFeedbackData {
  clientName: string;
  clientEmail: string;
  phoneClarity: number | null;
  phoneResponsiveness: number | null;
  phoneHelpfulness: number | null;
  assessmentConvenience: number | null;
  assessmentCommunication: number | null;
  assessmentConnection: number | null;
  groupConvenience: number | null;
  groupParticipation: number | null;
  groupHelpfulness: number | null;
  groupTechnology: number | null;
  oneOnOneConvenience: number | null;
  oneOnOneConnection: number | null;
  oneOnOneListening: number | null;
  oneOnOneHelpfulness: number | null;
  feltRespected: boolean | null;
  wouldRecommend: boolean | null;
  likelyToRefer: boolean | null;
  referralExplanation: string;
  additionalComments: string;
}

export interface SatopChecklistData {
  clientName: string;
  clientEmail: string;
  orientationDate: string;
  checklist: {
    clientRights: boolean; grievanceProcedure: boolean; confidentiality: boolean;
    hoursAndAppointments: boolean; crisisProcedures: boolean; programRules: boolean;
    questionsAnswered: boolean; agreesToTreatment: boolean;
  };
  clientSignature: string;
  staffSignature: string;
  signatureDate: string;
}

interface ContactInfo { name: string; address: string; city: string; state: string; zip: string; phone: string; }

export interface AuthorizationForReleaseData {
  clientName: string;
  clientEmail: string;
  authorizeDMH: boolean;
  authorizeRevenue: boolean;
  courtInfo: ContactInfo;
  attorneyInfo: ContactInfo;
  probationOfficerInfo: ContactInfo;
  otherInfo: ContactInfo;
  acknowledgesFederalRegulations: boolean;
  understandsRevocation: boolean;
  understandsExpiration: boolean;
  clientSignature: string;
  ssn: string;
  witnessSignature: string;
  date: string;
}

export interface ProgressNote { date: string; note: string; }

export interface ChartChecklistData {
  clientName: string;
  formId: string;
  attendingGroupRegularly: boolean | null;
  attendingGroupRegularlyAction: string;
  attendsOneOnOnes: boolean | null;
  attendsOneOnOnesAction: string;
  UAs: boolean | null;
  UAsAction: string;
  paymentsToDate: boolean | null;
  paymentsToDateAction: string;
  twelveStepMeetings: boolean | null;
  twelveStepMeetingsAction: string;
  poUpdate: boolean | null;
  poUpdateAction: string;
  needToStaff: boolean | null;
  needToStaffAction: string;
  soberDate: boolean | null;
  soberDateAction: string;
  progressNotes: ProgressNote[];
  therapistSignature: string;
  signatureDate: string;
}

export interface SatopClientIntakeData {
  clientName: string;
  dob: string;
  clientPhone: string;
  clientEmail: string;
  caseNumber: string;
  offenseDate: string;
  convictionDate: string;
  programType: '12-week' | '16-week' | null;
  referralSource: string;
  previousSatop: boolean | null;
  paymentMethod: string;
}

export interface SessionAttendanceData {
  therapistName: string;
  clientName: string;
  clientEmail: string;
  sessionDate: string;
  sessionTime: string;
  sessionNumber: string;
  attendanceStatus: 'Present' | 'Absent' | 'Excused' | null;
  sessionType: 'Group' | 'Individual' | null;
  sessionNotes: string;
}

export type AppointmentStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Canceled' | 'No Show';
export type AppointmentType = 'SATOP Group' | 'REACT Group' | 'Anger Management Group' | 'Gambling Group' | 'Individual Counseling' | 'DOT Assessment' | 'Intake Assessment';

export interface Attendee {
    clientId: string;
    attendanceStatus: 'Awaiting' | 'Present' | 'Late' | 'Absent' | 'Excused' | 'Checked In' | 'Checked Out' | 'No Show';
    checkInTime?: string;
    checkOutTime?: string;
    signatureDataUrl?: string;
}

export interface Appointment {
  id: string;
  title: string;
  type: AppointmentType;
  date: Date;
  startTime: string;
  endTime: string;
  modality: 'Virtual (Zoom)' | 'In-Person';
  therapist: string;
  zoomLink?: string;
  status: AppointmentStatus;
  capacity?: number;
  attendees?: Attendee[];
  clientId?: string; 
  clientName?: string;
  isRecurring?: boolean;
}

export interface ProgressData { month: string; score: number; notes: string; }
export interface Message { id:string; sender: 'counselor' | 'client' | 'system' | 'probation_officer'; clientName: string; avatarUrl: string; text: string; timestamp: string; read: boolean; status?: 'sent' | 'delivered' | 'read'; }
export interface ChatMessage { role: 'user' | 'model'; parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>; }
export interface DrugScreen { date: string; testType: string; chainOfCustodyId: string; result: 'Negative' | 'Positive'; }
export interface SROPProgress { clientId: string; totalHours: number; phase1: { title: string; requiredHours: number; completedHours: number; }; phase2: { title: string; requiredHours: number; completedHours: number; }; drugScreens: DrugScreen[]; }
export type DocumentType = 'consent' | 'treatment-plan' | 'court-report';
export interface SignedDocument { id: string; clientId: string; documentType: DocumentType; signatureDataUrl: string; signedAt: Date; }
export interface ComplianceEvent { id: string; clientId: string; clientName: string; type: 'ASAM Reassessment' | 'Program Plan Review' | 'Court Report Due' | 'Recovery Plan Review'; dueDate: Date; status: 'upcoming' | 'overdue' | 'complete'; }
export interface AuditLog { id: string; timestamp: Date; user: string; action: string; details: string; }
export interface ProgramGoal { id: string; description: string; status: 'Not Started' | 'In Progress' | 'Completed' | 'On Hold'; progress: number; objectives: string[]; interventions: string[]; }
export interface ProgramPlan { clientId: string; goals: ProgramGoal[]; }
export interface SessionRecord { id: string; clientId: string; date: Date; type: 'Individual Session' | 'SROP Group' | 'Intake Assessment'; duration: number; rate: number; status: 'Paid' | 'Unpaid' | 'Pending' | 'No Show Fee'; }
export interface ClientAssignment { id: string; clientId: string; task: string; dueDate: Date; isComplete: boolean; }
export interface ExtractedField { field: string; value: string; confidence: number; }
export type DocumentFileType = 'SATOP_Certificate' | 'Court_Order' | 'Intake_Form' | 'Progress_Note' | 'Payment_Record' | 'Unknown';
export type ComplianceStatus = 'Pending' | 'Approved' | 'Requires_Review';
export type ClientFolderType = 'Intake' | 'Progress' | 'Compliance' | 'Financial' | 'Completion' | 'DMV' | 'Insurance';
export interface DocumentFile { id: string; nodeId: string; clientId: string; clientName: string; filename: string; documentType: DocumentFileType; gcs_file_path: string; sql_metadata_id: string; uploadDate: Date; fileSize: number; mimeType: string; url: string; extractedData: { summary: string; fields: ExtractedField[]; actionItems: string[]; suggestedSubfolder?: ClientFolderType; }; complianceStatus: ComplianceStatus; auditTrail: Array<{ timestamp: Date; user: string; action: string }>; }
export interface FileSystemNode { id: string; name: string; type: 'folder' | 'document'; parentId?: string; clientId?: string; children?: FileSystemNode[]; documentId?: string; }
export interface AiSuggestion { id: string; contextId: string; type: 'missing_document' | 'deadline_alert' | 'workflow_suggestion' | 'content_summary'; message: string; actionText?: string; priority: 'low' | 'medium' | 'high'; }
export type ScannerStatus = 'Online' | 'Offline' | 'Busy' | 'Error' | 'Low Paper';
export interface NetworkScanner { id: string; name: string; ipAddress: string; model: string; location: string; status: ScannerStatus; }
export interface ScanJob { id: string; clientId: string; category: ClientFolderType; jobName: string; scannerId: string; settings: { dpi: number; colorMode: 'color' | 'grayscale' | 'blackwhite'; isDuplex: boolean; format: 'pdf' | 'jpeg' | 'tiff'; }; status: 'pending' | 'scanning' | 'review' | 'analyzing' | 'complete' | 'failed'; pages: string[]; error?: string; }
export interface Form { id: string; title: string; category: 'Recovery Plans' | 'Assessments' | 'Intake'; description: string; format: 'electronic' | 'pdf'; pdfUrl?: string; }
export interface FormSubmission { id: string; formId: string; clientId: string; status: 'Not Started' | 'In Progress' | 'Completed' | 'Reviewed'; submittedAt?: Date; reviewedAt?: Date; reviewedBy?: string; data?: any; assignedAt?: Date; dueDate?: Date; }
export interface AuthContextType { user: User | null; login: (user: User) => void; logout: () => void; }
export interface AsamDimension { dimension: number; name: string; description: string; notes: string; }
export interface AsamAssessmentData { [key: number]: AsamDimension; }
export interface AsamAnalysisResult { clinicalSummary: string; dimensionRisks: Array<{ dimension: string; riskLevel: 'Low' | 'Moderate' | 'High' | string; }>; recommendedLevel: string; treatmentRecommendations: string[]; }
export interface StaffCertification { id: string; staffName: string; credential: string; renewalDate: Date | string; }
export interface Integration { id: string; name: string; status: 'Connected' | 'Disconnected'; description: string; }
export interface Payment { id: string; date: Date; clientName: string; method: 'Credit Card' | 'Insurance' | 'Stripe'; status: 'Completed' | 'Pending' | 'Failed'; amount: number; }
export interface TherapistStats { reportingStreak: number; caseloadSize: number; thisWeekCompletions: number; }
export interface ClientMilestone { clientId: string; clientName: string; milestoneText: string; }
export interface ComplianceRisk { clientId: string; clientName: string; riskText: string; complianceScore: number; }
export interface HighPriorityAlert { clientId: string; clientName: string; alertText: string; }
export interface DailyBriefingData { therapistStats: TherapistStats; todaysAppointments: Appointment[]; highPriorityAlerts: HighPriorityAlert[]; complianceRisks: ComplianceRisk[]; clientMilestones: ClientMilestone[]; }
export interface ClientDocument { id: string; clientId: string; title: string; status: 'Pending Signature' | 'Completed'; lastModified: string; }
export interface FormTemplate { id: string; title: string; category: 'Intake' | 'Compliance' | 'Assessment'; lastModified: string; fieldCount: number; }
export interface Transaction { id: string; date: string; description: string; charge: number | null; payment: number | null; balance: number; }
export interface BillingSummary { clientId: string; currentBalance: number; paymentMethod: 'Card on File' | 'None'; transactions: Transaction[]; }
export interface RevenueDataPoint { name: string; revenue: number; }
export interface ComplianceDataPoint { month: string; score: number; }
export interface SyncedAppointment { id: string; title: string; start: string; end: string; calendar: 'Google Calendar' | 'Outlook'; }
export interface AiMessage { id: string; content: string; timestamp: Date; isUser: boolean; }
export interface ClientActivity { id: string; clientId: string; timestamp: Date; type: 'Session' | 'Achievement' | 'Document' | 'Task' | 'Payment' | 'Form'; description: string; }
export interface VideoSession { id: string; clientId: string; clientName: string; therapistId: string; therapistName: string; zoomMeetingId: string; zoomJoinUrl: string; startTime: Date; durationMinutes: number; status: 'scheduled' | 'in_progress' | 'completed' | 'missed' | 'canceled'; createdAt: Date; }
export interface PracticeMetrics { incomeMTD: number; unbilledAmount: number; missingNotesCount: number; outstandingInvoicesCount: number; totalActiveClients: number; }
