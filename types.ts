
import React from 'react';

// Role model for the trial. Director is the superuser (David); Therapist is the
// clinician (Karen); Admin is the office role (Jessica) with no clinical access.
// Be careful when reading any historical role === 'Admin' check — pre-rename,
// 'Admin' meant superuser. Post-rename, 'Admin' is the office role.
//
// StaffRole = the three counselor-app roles. UserRole also includes 'Client'
// (portal users). Counselor routes are gated to StaffRole only (see
// STAFF_ROLES / isStaffRole and components/ProtectedRoute + RequireRole).
export type StaffRole = 'Director' | 'Therapist' | 'Admin';
export type UserRole = StaffRole | 'Client';

/** Allowlist for counselor-app access. Excludes 'Client' AND unknown/no-role. */
export const STAFF_ROLES: readonly StaffRole[] = ['Director', 'Therapist', 'Admin'];
export const isStaffRole = (r: UserRole | null | undefined): r is StaffRole =>
  r === 'Director' || r === 'Therapist' || r === 'Admin';

/** Financial-reporting access (Director Reports / Financials). Mirrors the DB's
 *  private.is_financial_staff() exactly: role in ('Director','Admin') — Therapist
 *  and Client excluded. */
export const FINANCIAL_ROLES: readonly StaffRole[] = ['Director', 'Admin'];
export const isFinancialRole = (r: UserRole | null | undefined): r is 'Director' | 'Admin' =>
  r === 'Director' || r === 'Admin';

/** Clinical sign-off access (the WS2 placement determination). Mirrors the DB's
 *  private.is_clinician() exactly: role in ('Director','Therapist') — Admin and
 *  Client excluded. A UI gate using this MUST match the table's INSERT policy
 *  (pd_insert_clinician) so we never render an affordance the DB would reject. */
export const CLINICIAN_ROLES: readonly StaffRole[] = ['Director', 'Therapist'];
export const isClinicianRole = (r: UserRole | null | undefined): r is 'Director' | 'Therapist' =>
  r === 'Director' || r === 'Therapist';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

// Client lifecycle — the ONLY thing clients.status stores (DB CHECK-enforced,
// migration 20260611_status_lifecycle_normalization). Compliance standing
// (compliant / non-compliant / warrant) is NOT a status value: the
// deterministic engine computes standing at render; storing it here would be
// a second source of truth that could contradict the engine.
export type ClientStatus = 'active' | 'completed' | 'archived';
export const CLIENT_STATUSES: readonly ClientStatus[] = ['active', 'completed', 'archived'];
// Display labels — presentation only; identity is the lowercase value.
export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
};

export interface Client {
  id: string;
  name: string;
  initials: string;
  email?: string;
  phone: string;
  avatarUrl: string;
  lastSession: string;
  program: 'SATOP' | 'REACT' | 'Anger Management' | 'Compulsive Gambling' | 'GAMBLING_RECOVERY' | 'OPIOID_RECOVERY' | 'DOT' | 'Individual Counseling' | 'SROP';
  programType: 'SATOP_Level_IV' | 'Individual_Counseling' | 'Substance_Use_Assessment';
  status: ClientStatus;
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
  attendanceHistory: ('present' | 'late' | 'absent')[];
  folder_link?: string;
}

// ====== FORMS SYSTEM TYPES ======

export type FormErrors<T> = {
  [K in keyof T]?: string;
};

export interface FormSectionProps<T> {
  formData: T;
  setFormData: React.Dispatch<React.SetStateAction<T>>;
  errors: FormErrors<T>;
}

export type FieldDefinition = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'tel' | 'date' | 'rating' | 'boolean' | 'object' | 'email' | 'password';
  min?: number;
  max?: number;
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
};

export type FormDefinition<T> = {
  id: string;
  title: string;
  description: string;
  category: 'Intake' | 'Assessment' | 'Treatment' | 'Legal' | 'Clinical' | 'Testing';
  initialState: T;
  steps?: React.FC<FormSectionProps<T>>[];
  validateStep: (data: T) => FormErrors<T>;
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

export type FormCategory = 'Intake' | 'Assessment' | 'Treatment' | 'Legal' | 'Clinical' | 'Testing';
export type FormField = FieldDefinition;

// --- WS5 single-signature legal forms (fidelity to ACS Forms-090825 / New folder) ---
export interface HipaaAckData {
  clientName: string;
  acknowledgesNotice: boolean;
  clientSignature: string;
  signatureDate: string;
}
export interface TelehealthConsentData {
  clientName: string;
  understandsWithdrawAnytime: boolean;
  understandsRisks: boolean;
  understandsNoRecording: boolean;
  understandsPrivacyLimits: boolean;
  understandsCrisisHigherCare: boolean;
  understandsReconnectProtocol: boolean;
  consentsToTelehealth: boolean;
  clientSignature: string;
  staffSignature: string;
  signatureDate: string;
}
export interface LateCancellationData {
  clientName: string;
  acknowledgesPolicy: boolean;
  clientSignature: string;
  signatureDate: string;
}

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
  phoneClarity: number;
  phoneResponsiveness: number;
  phoneHelpfulness: number;
  assessmentConvenience: number;
  assessmentCommunication: number;
  assessmentConnection: number;
  groupConvenience: number;
  groupParticipation: number;
  groupHelpfulness: number;
  groupTechnology: number;
  oneOnOneConvenience: number;
  oneOnOneConnection: number;
  oneOnOneListening: number;
  oneOnOneHelpfulness: number;
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
// WS3 reg hour-category (9 CSR 30-3.206) for session-hours accrual — distinct from
// AppointmentType (program/format). Required before an appointment can be Completed;
// 'other' = a non-program session that deliberately does not accrue.
export type ServiceType = 'counseling' | 'education' | 'rehabilitative_support' | 'other';

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
  zoomMeetingId?: string;
  status: AppointmentStatus;
  serviceType?: ServiceType;
  groupId?: string; // WS6: standing-group instance (null/undefined = ad-hoc session)
  capacity?: number;
  attendees?: Attendee[];
  clientId?: string;
  clientName?: string;
  isRecurring?: boolean;
  googleEventId?: string;
  googleEventLink?: string;
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
export interface DocumentFile { id: string; nodeId: string; clientId: string; clientName: string; filename: string; documentType: DocumentFileType; gcs_file_path: string; sql_metadata_id: string; uploadDate: Date; fileSize: number; mimeType: string; url: string; extractedData: { summary: string; fields: ExtractedField[]; actionItems: string[]; suggestedSubfolder?: ClientFolderType; }; category?: string; needsReview?: boolean; complianceStatus: ComplianceStatus; auditTrail: Array<{ timestamp: Date; user: string; action: string }>; }
export interface FileSystemNode { id: string; name: string; type: 'folder' | 'document'; parentId?: string; clientId?: string; children?: FileSystemNode[]; documentId?: string; }
export interface AiSuggestion { id: string; contextId: string; type: 'missing_document' | 'deadline_alert' | 'workflow_suggestion' | 'content_summary'; message: string; actionText?: string; priority: 'low' | 'medium' | 'high'; }
export interface Form { id: string; title: string; category: 'Recovery Plans' | 'Assessments' | 'Intake'; description: string; format: 'electronic' | 'pdf'; pdfUrl?: string; }
export interface FormSubmission { id: string; formId: string; formName?: string; clientId: string; status: 'Not Started' | 'In Progress' | 'Completed' | 'Reviewed'; submittedAt?: Date; reviewedAt?: Date; reviewedBy?: string; data?: any; assignedAt?: Date; dueDate?: Date; }
export interface AuthContextType {
  user: User | null;
  /** True while the initial Supabase session is being resolved. */
  loading: boolean;
  /** Primary factor: real email/password sign-in. Returns a registered phone (if any) for the optional iVALT second factor. */
  loginWithPassword: (email: string, password: string) => Promise<{ error?: string; phone?: string }>;
  /** Demo path — still produces a REAL (test) Supabase session, not a stub. */
  loginDemo: (role: StaffRole) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}
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

// --- Treatment Plans (Phase F2) ---
// Mirrors the TreatmentPlanTemplate shape in data/treatmentPlanTemplates.ts
// so applying a template to a client is a 1:1 JSON serialize.
export interface TreatmentPlanIntervention {
  description: string;
  frequency?: string;
}

export interface TreatmentPlanProblem {
  title: string;
  goals: string[];
  interventions: TreatmentPlanIntervention[];
}

export interface TreatmentPlanContent {
  problems: TreatmentPlanProblem[];
}

export type TreatmentPlanStatus = 'Active' | 'Completed' | 'Archived';

export interface TreatmentPlan {
  id: string;
  clientId: string;
  templateId?: string;
  title: string;
  category: string;
  estimatedDuration?: string;
  content: TreatmentPlanContent;
  status: TreatmentPlanStatus;
  createdBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
