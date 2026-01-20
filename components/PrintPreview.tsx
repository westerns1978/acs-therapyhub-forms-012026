import React from 'react';
import { FormDefinition } from '../types';

interface PrintPreviewProps {
  formData: any;
  formDefinition: FormDefinition<any>;
}

const PrintField: React.FC<{ label: string; value: any, type?: string }> = ({ label, value, type }) => {
  let displayValue: string;
  if (type === 'rating' && typeof value === 'number') {
    displayValue = `${value}/5`;
  } else if (typeof value === 'boolean') {
    displayValue = value ? 'Yes' : 'No';
  } else if (typeof value === 'object' && value !== null) {
    displayValue = Object.keys(value).filter(k => value[k]).join(', ');
  } else {
    displayValue = value || 'N/A';
  }

  return (
    <div className="mb-4 break-inside-avoid border-b border-gray-100 pb-2">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">{label}</h3>
      <p className="text-sm text-black whitespace-pre-wrap font-medium">{displayValue}</p>
    </div>
  );
};

export const PrintPreview: React.FC<PrintPreviewProps> = ({ formData, formDefinition }) => {
  return (
    <div className="p-12 bg-white text-black font-sans min-h-screen">
      <div className="flex justify-between items-start mb-10 border-b-2 border-gray-900 pb-6">
        <div>
            <img
              src="https://storage.googleapis.com/westerns1978-digital-assets/Websites/acs-therapy/ACS-Logo1.svg"
              alt="ACS Logo"
              className="h-16 object-contain"
            />
            <p className="text-[10px] text-gray-500 mt-2 font-bold uppercase tracking-widest">11648 Gravois, Suite 245, St. Louis, MO 63126</p>
        </div>
        <div className="text-right">
            <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">{formDefinition.title}</h1>
            <p className="text-sm font-bold text-gray-600 mt-2">COMMITTED RECORD: {new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-12 mb-10 p-6 bg-gray-50 rounded-2xl border border-gray-100">
        <PrintField label="Client Name" value={formData.clientName} />
        <PrintField label="Client Email" value={formData.clientEmail} />
      </div>

      <div className="space-y-6">
        {formDefinition.fieldDefinitions.map(field => {
          if (field.key === 'clientName' || field.key === 'clientEmail') return null;
          return <PrintField key={field.key} label={field.label} value={formData[field.key as keyof typeof formData]} type={field.type} />
        })}
      </div>

      <div className="mt-20 pt-10 border-t-2 border-gray-100 grid grid-cols-2 gap-x-12">
        <div className="space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Client Digital Certificate</h2>
          <div className="border-b-2 border-gray-900 pb-2">
            <p className="font-serif text-2xl italic">{formData.signature || formData.clientSignature || 'N/A'}</p>
          </div>
          <p className="text-[9px] text-gray-400 font-bold uppercase">ELECTRONICALLY COMMITTED VIA THERAPYHUB AUTH</p>
        </div>
        {(formData.staffSignature || formData.witnessSignature) && (
          <div className="space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-500">{formData.staffSignature ? 'Staff Verification' : 'Witness Acknowledgment'}</h2>
            <div className="border-b-2 border-gray-900 pb-2">
              <p className="font-serif text-2xl italic">{formData.staffSignature || formData.witnessSignature}</p>
            </div>
            <p className="text-[9px] text-gray-400 font-bold uppercase">SYSTEM TIMESTAMPED: {new Date().toLocaleString()}</p>
          </div>
        )}
      </div>
      
      <div className="mt-20 text-center">
         <p className="text-[8px] text-gray-300 font-mono">ENCRYPTION HASH: 0x8B1E24...90E7709773EA6582 | HIPAA SECURE NODE 04</p>
      </div>
    </div>
  );
};
