import React from 'react';

export enum FormCategory {
  CLINICAL = 'Clinical',
  INTAKE = 'Intake',
  ASSESSMENT = 'Assessment',
  TREATMENT = 'Treatment',
  LEGAL = 'Legal',
  TESTING = 'Testing',
}

export interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  min?: number;
  max?: number;
}

export interface FormDefinition<T extends object> {
  id: string;
  title: string;
  description: string;
  category: FormCategory;
  initialState: T;
  fieldDefinitions: FormField[];
  validateStep: (currentData: T) => { [key: string]: string };
}
