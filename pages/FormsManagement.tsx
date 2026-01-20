import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import { getFormTemplates } from '../services/api';
import { FormTemplate } from '../types';

const PlusCircleIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="16"/><line x1="8" x2="16" y1="12" y2="12"/></svg>;
const EditIcon = (props: React.ComponentProps<'svg'>) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;

const FormsManagement: React.FC = () => {
    const [templates, setTemplates] = useState<FormTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const data = await getFormTemplates();
            setTemplates(data);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    if (isLoading) {
        return <div className="p-8 text-center">Loading form templates...</div>;
    }

    return (
        <div>
            <Card noPadding>
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-surface">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase">Template Title</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase">Fields</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase">Last Modified</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-on-surface-secondary uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-background divide-y divide-border">
                            {templates.map(template => (
                                <tr key={template.id} className="hover:bg-surface transition">
                                    <td className="px-6 py-4 font-medium">{template.title}</td>
                                    <td className="px-6 py-4">{template.category}</td>
                                    <td className="px-6 py-4">{template.fieldCount}</td>
                                    <td className="px-6 py-4">{template.lastModified}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700">
                                            <EditIcon className="w-5 h-5 text-primary" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default FormsManagement;