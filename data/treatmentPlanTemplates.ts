export type TemplateCategory =
  | 'SATOP'
  | 'Gambling Recovery'
  | 'Opioid Recovery'
  | 'Anger Management'
  | 'Mental Health';

export interface TemplateIntervention {
  description: string;
  frequency?: string;
}

export interface TemplateProblem {
  title: string;
  goals: string[];
  interventions: TemplateIntervention[];
}

export interface TreatmentPlanTemplate {
  id: string;
  title: string;
  description: string;
  category: TemplateCategory;
  estimatedDuration: string;
  problems: TemplateProblem[];
}

export const CATEGORY_STYLES: Record<TemplateCategory, { badge: string; accent: string; ring: string }> = {
  'SATOP': {
    badge: 'bg-primary text-white',
    accent: 'text-primary',
    ring: 'ring-primary/20',
  },
  'Gambling Recovery': {
    badge: 'bg-teal-600 text-white',
    accent: 'text-teal-700 dark:text-teal-300',
    ring: 'ring-teal-500/20',
  },
  'Opioid Recovery': {
    badge: 'bg-violet-600 text-white',
    accent: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-500/20',
  },
  'Anger Management': {
    badge: 'bg-amber-600 text-white',
    accent: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-500/20',
  },
  'Mental Health': {
    badge: 'bg-indigo-600 text-white',
    accent: 'text-indigo-700 dark:text-indigo-300',
    ring: 'ring-indigo-500/20',
  },
};

export const TREATMENT_PLAN_TEMPLATES: TreatmentPlanTemplate[] = [
  {
    id: 'satop-level-iii-standard',
    title: 'SATOP Level III — Standard Recovery',
    description: 'Court-mandated standard recovery pathway for Level III SATOP clients addressing alcohol-related impaired driving offenses.',
    category: 'SATOP',
    estimatedDuration: '50 hours / ~16 weeks',
    problems: [
      {
        title: 'Substance Use Disorder (alcohol)',
        goals: [
          'Client will abstain from alcohol use for the duration of the program, verified by random screens.',
          'Client will identify three primary high-risk situations and a coping plan for each within 30 days.',
          'Client will complete a personal drinking history and timeline.',
        ],
        interventions: [
          { description: 'Weekly group counseling focused on psychoeducation and identification of use patterns', frequency: 'Weekly, 90 min' },
          { description: 'Random urinalysis / breathalyzer testing through ACS chain-of-custody protocol', frequency: 'Biweekly' },
          { description: 'Individual counseling to develop personalized relapse prevention plan', frequency: 'Biweekly, 50 min' },
        ],
      },
      {
        title: 'Group counseling participation',
        goals: [
          'Client will attend 100% of scheduled group sessions or follow make-up policy.',
          'Client will verbally contribute to group discussions in at least 80% of sessions.',
        ],
        interventions: [
          { description: 'Structured Phase I psychoeducation curriculum on impaired-driving consequences', frequency: 'Weekly' },
          { description: 'Phase II relapse-prevention skills practice and peer feedback', frequency: 'Weekly' },
        ],
      },
      {
        title: 'Cognitive distortions around drinking',
        goals: [
          'Client will identify and reframe at least five recurring cognitive distortions related to alcohol use.',
          'Client will complete a daily thought-tracking log for four consecutive weeks.',
        ],
        interventions: [
          { description: 'CBT-based worksheets and homework assignments reviewed in session', frequency: 'Weekly' },
          { description: 'Motivational interviewing to strengthen change talk and reduce ambivalence', frequency: 'As clinically indicated' },
        ],
      },
    ],
  },
  {
    id: 'satop-level-iv-high-risk',
    title: 'SATOP Level IV — High Risk',
    description: 'Intensive 75-hour SATOP Level IV pathway for repeat-offender and high-risk DWI clients requiring extended treatment and oversight.',
    category: 'SATOP',
    estimatedDuration: '75 hours / ~26 weeks',
    problems: [
      {
        title: 'Substance Use Disorder (high risk)',
        goals: [
          'Client will maintain continuous sobriety verified by negative screens throughout program.',
          'Client will demonstrate insight into addictive thinking patterns through written assignments.',
          'Client will complete a comprehensive ASAM-aligned biopsychosocial within 14 days of intake.',
        ],
        interventions: [
          { description: 'Intensive group counseling combining education and process work', frequency: 'Twice weekly' },
          { description: 'Random drug screens with chain-of-custody documentation', frequency: 'Weekly' },
          { description: 'Individual counseling to address co-occurring concerns and trauma history', frequency: 'Weekly' },
        ],
      },
      {
        title: 'Compliance with court requirements',
        goals: [
          'Client will submit all court-ordered documentation by required deadlines.',
          'Client will attend all probation appointments and follow officer recommendations.',
        ],
        interventions: [
          { description: 'Compliance coordination with probation officer and court referral source', frequency: 'Monthly' },
          { description: 'Documentation review and signature workflow through ACS portal', frequency: 'Ongoing' },
        ],
      },
      {
        title: 'Relapse prevention planning',
        goals: [
          'Client will create a written relapse prevention plan identifying triggers, warning signs, and supports.',
          'Client will rehearse refusal skills in role-play with counselor and peers at least three times.',
        ],
        interventions: [
          { description: 'CBT-based relapse prevention curriculum (Marlatt model)', frequency: 'Weekly' },
          { description: 'Skills practice and role-play in group counseling', frequency: 'Biweekly' },
        ],
      },
      {
        title: 'Sober support system',
        goals: [
          'Client will attend a minimum of two community recovery meetings per week.',
          'Client will identify and engage one accountability partner outside of clinical staff.',
        ],
        interventions: [
          { description: 'Referral to AA / NA / SMART Recovery meetings local to client county', frequency: 'Ongoing' },
          { description: 'Family / collateral session to reinforce home recovery environment', frequency: 'Monthly' },
        ],
      },
    ],
  },
  {
    id: 'gambling-recovery-standard',
    title: 'Gambling Recovery — Standard',
    description: 'Evidence-based pathway for compulsive gambling clients addressing behavioral addiction, financial harm, and relational repair.',
    category: 'Gambling Recovery',
    estimatedDuration: '24 sessions / ~6 months',
    problems: [
      {
        title: 'Gambling addiction',
        goals: [
          'Client will abstain from all forms of gambling for the duration of treatment.',
          'Client will identify three primary gambling triggers and a coping response for each.',
        ],
        interventions: [
          { description: 'Individual counseling using CBT and motivational interviewing', frequency: 'Weekly, 50 min' },
          { description: 'Referral to Gamblers Anonymous and online self-exclusion programs', frequency: 'One-time, with follow-up' },
          { description: 'Urge-surfing and behavioral substitution skills practice', frequency: 'Weekly' },
        ],
      },
      {
        title: 'Financial harm mitigation',
        goals: [
          'Client will produce a monthly budget and review it with counselor.',
          'Client will engage a trusted third party to oversee finances for the first 90 days.',
        ],
        interventions: [
          { description: 'Financial counseling referral and budget review in session', frequency: 'Biweekly' },
          { description: 'Self-exclusion enrollment and credit-monitoring setup support', frequency: 'One-time' },
        ],
      },
      {
        title: 'Family / relationship repair',
        goals: [
          'Client will participate in at least three family / partner sessions during treatment.',
          'Client will demonstrate two healthy communication skills in observed interaction.',
        ],
        interventions: [
          { description: 'Conjoint family counseling addressing trust rebuilding and boundary setting', frequency: 'Monthly' },
          { description: 'Psychoeducation for family on gambling disorder and recovery', frequency: 'As needed' },
        ],
      },
    ],
  },
  {
    id: 'opioid-recovery-mat',
    title: 'Opioid Recovery with MAT',
    description: 'Integrated outpatient pathway for opioid use disorder clients receiving medication-assisted treatment alongside counseling.',
    category: 'Opioid Recovery',
    estimatedDuration: '48 sessions / ~12 months',
    problems: [
      {
        title: 'Opioid dependency',
        goals: [
          'Client will maintain medication adherence as prescribed by MAT provider.',
          'Client will produce negative urine drug screens for non-prescribed opioids throughout program.',
          'Client will identify and address one primary use trigger per month.',
        ],
        interventions: [
          { description: 'Care coordination with MAT prescriber and pharmacy', frequency: 'Monthly' },
          { description: 'Individual counseling using CBT, motivational interviewing, and contingency management', frequency: 'Weekly' },
          { description: 'Random observed urine drug screens', frequency: 'Weekly to biweekly' },
        ],
      },
      {
        title: 'Pain management without controlled substances',
        goals: [
          'Client will identify two non-opioid pain management strategies and use them as primary response.',
          'Client will engage primary-care or pain specialist for chronic pain management plan.',
        ],
        interventions: [
          { description: 'Psychoeducation on chronic pain and the pain–addiction cycle', frequency: 'Biweekly' },
          { description: 'Mindfulness-based pain coping and relaxation training', frequency: 'Weekly' },
        ],
      },
      {
        title: 'Family relationship repair',
        goals: [
          'Client will engage at least one family member in supportive recovery activity.',
          'Client will identify and practice one healthy boundary-setting skill per month.',
        ],
        interventions: [
          { description: 'Family counseling sessions focused on enabling, codependency, and support roles', frequency: 'Monthly' },
          { description: 'Referral to Nar-Anon or family support group', frequency: 'One-time' },
        ],
      },
    ],
  },
  {
    id: 'anger-management-court',
    title: 'Anger Management — Court Ordered',
    description: 'Structured 12-session anger management pathway for court-mandated clients addressing emotional regulation and conflict skills.',
    category: 'Anger Management',
    estimatedDuration: '12 sessions / ~12 weeks',
    problems: [
      {
        title: 'Emotional dysregulation',
        goals: [
          'Client will identify primary anger triggers and physiological warning signs.',
          'Client will demonstrate use of two de-escalation skills (e.g., timeout, controlled breathing) in session.',
        ],
        interventions: [
          { description: 'CBT-based psychoeducation on the anger cycle and physiological response', frequency: 'Weekly' },
          { description: 'Daily anger log with reflection on triggers and responses', frequency: 'Ongoing' },
        ],
      },
      {
        title: 'Conflict resolution skills',
        goals: [
          'Client will demonstrate active-listening and "I-statement" skills in role-play.',
          'Client will resolve one real-life conflict per month using assertive (not aggressive) communication.',
        ],
        interventions: [
          { description: 'Skills training in assertive communication and active listening', frequency: 'Biweekly' },
          { description: 'Group role-play and peer feedback on conflict scenarios', frequency: 'Biweekly' },
        ],
      },
      {
        title: 'Trigger identification',
        goals: [
          'Client will produce a written trigger map covering home, work, and social contexts.',
          'Client will rehearse a coping response for each top-three trigger.',
        ],
        interventions: [
          { description: 'Individual session work on cognitive restructuring of hot thoughts', frequency: 'Weekly' },
          { description: 'Mindfulness and grounding skills practice', frequency: 'Weekly' },
        ],
      },
    ],
  },
  {
    id: 'mental-health-eval-followup',
    title: 'Mental Health Evaluation Follow-up',
    description: 'Short-term follow-up pathway for clients flagged in evaluation for anxiety or depressive symptoms requiring brief outpatient support.',
    category: 'Mental Health',
    estimatedDuration: '8 sessions / ~8 weeks',
    problems: [
      {
        title: 'Anxiety / depression screening',
        goals: [
          'Client will complete PHQ-9 and GAD-7 at intake, mid-treatment, and discharge.',
          'Client will reduce PHQ-9 and GAD-7 scores by at least one severity tier by discharge.',
        ],
        interventions: [
          { description: 'Standardized PHQ-9 / GAD-7 administration and review', frequency: 'Every 4 weeks' },
          { description: 'Psychiatric referral for medication evaluation when clinically indicated', frequency: 'As needed' },
        ],
      },
      {
        title: 'Coping skills development',
        goals: [
          'Client will learn and consistently practice three coping skills (e.g., grounding, behavioral activation, thought records).',
          'Client will report use of at least one new skill weekly.',
        ],
        interventions: [
          { description: 'CBT-based session work on cognitive restructuring and behavioral activation', frequency: 'Weekly' },
          { description: 'Between-session skills practice with written homework log', frequency: 'Ongoing' },
        ],
      },
    ],
  },
  {
    id: 'sub-abuse-eval-recommended',
    title: 'Substance Abuse Evaluation Recommended Treatment',
    description: 'Bridge plan for clients completing a Substance Use Evaluation and entering recommended SATOP level placement.',
    category: 'SATOP',
    estimatedDuration: 'Bridge plan / 4–6 weeks',
    problems: [
      {
        title: 'Substance use assessment review',
        goals: [
          'Client will review and acknowledge all findings of the Substance Use Evaluation in session.',
          'Client will identify two areas of agreement and any concerns with the recommendation.',
        ],
        interventions: [
          { description: 'Counselor-led review of evaluation findings and ASAM dimensions', frequency: 'One session' },
          { description: 'Motivational interviewing to strengthen commitment to recommended level', frequency: 'As needed' },
        ],
      },
      {
        title: 'Recommended level placement',
        goals: [
          'Client will enroll in recommended SATOP level (II, III, or IV) within 14 days of recommendation.',
          'Client will complete all enrollment paperwork and pay required intake fees.',
        ],
        interventions: [
          { description: 'Coordination with intake coordinator and court reporting where applicable', frequency: 'One-time' },
          { description: 'Documentation of enrollment in ACS compliance record', frequency: 'One-time' },
        ],
      },
      {
        title: 'Treatment engagement',
        goals: [
          'Client will attend first two scheduled sessions of recommended program.',
          'Client will engage with assigned counselor and set personal program goals.',
        ],
        interventions: [
          { description: 'Warm hand-off to assigned counselor and orientation to group structure', frequency: 'One-time' },
          { description: 'Follow-up contact at week 2 of new program to address barriers', frequency: 'One-time' },
        ],
      },
    ],
  },
  {
    id: 'continuing-recovery-plan',
    title: 'Continuing Recovery Plan',
    description: 'Aftercare plan for clients transitioning out of active treatment, focused on long-term sobriety maintenance and community support.',
    category: 'SATOP',
    estimatedDuration: 'Ongoing / 6–12 months',
    problems: [
      {
        title: 'Long-term sobriety support',
        goals: [
          'Client will maintain abstinence and report any slips to recovery support within 24 hours.',
          'Client will identify and use at least one recovery accountability tool weekly (e.g., journal, app, sponsor check-in).',
        ],
        interventions: [
          { description: 'Monthly check-in session with primary counselor', frequency: 'Monthly' },
          { description: 'Continued random drug screens at reduced frequency', frequency: 'Monthly to quarterly' },
        ],
      },
      {
        title: 'Sober social network',
        goals: [
          'Client will participate in a community recovery meeting at least weekly.',
          'Client will maintain ongoing contact with one recovery peer or sponsor.',
        ],
        interventions: [
          { description: 'Referral and continued engagement with AA / NA / SMART Recovery', frequency: 'Ongoing' },
          { description: 'Alumni group or recovery community events through ACS', frequency: 'Monthly' },
        ],
      },
      {
        title: 'Ongoing self-care practices',
        goals: [
          'Client will maintain a written self-care plan covering sleep, nutrition, movement, and stress reduction.',
          'Client will review and adjust self-care plan with counselor each quarter.',
        ],
        interventions: [
          { description: 'Quarterly counseling session focused on lifestyle and self-care review', frequency: 'Quarterly' },
          { description: 'Coordination with primary-care provider for annual wellness exam', frequency: 'Annually' },
        ],
      },
    ],
  },
];
