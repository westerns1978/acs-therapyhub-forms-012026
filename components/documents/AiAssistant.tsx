

import React, { useState, useEffect } from 'react';
import { AiSuggestion } from '../../types';
import { getAiSuggestions } from '../../services/api';
import { BrainCircuit, AlertTriangle, Lightbulb, FileCheck } from 'lucide-react';

interface AiAssistantProps {
  context: {
    clientId?: string;
    documentId?: string;
  };
}

const getSuggestionStyles = (type: AiSuggestion['type'], priority: AiSuggestion['priority']) => {
    let icon = Lightbulb;
    let borderColor = 'border-blue-500';
    let textColor = 'text-blue-800 dark:text-blue-200';
    let bgColor = 'bg-blue-50 dark:bg-blue-900/30';

    switch (type) {
        case 'missing_document':
        case 'deadline_alert':
            icon = AlertTriangle;
            borderColor = 'border-red-500';
            textColor = 'text-red-800 dark:text-red-200';
            bgColor = 'bg-red-50 dark:bg-red-900/30';
            break;
        case 'content_summary':
             icon = FileCheck;
             borderColor = 'border-green-500';
             textColor = 'text-green-800 dark:text-green-200';
             bgColor = 'bg-green-50 dark:bg-green-900/30';
             break;
    }

    if (priority === 'medium') {
        borderColor = 'border-yellow-500';
        textColor = 'text-yellow-800 dark:text-yellow-200';
        bgColor = 'bg-yellow-50 dark:bg-yellow-900/30';
    }
    
    return { Icon: icon, borderColor, textColor, bgColor };
};


const AiAssistant: React.FC<AiAssistantProps> = ({ context }) => {
    const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSuggestions = async () => {
            setIsLoading(true);
            const fetchedSuggestions = await getAiSuggestions(context);
            setSuggestions(fetchedSuggestions);
            setIsLoading(false);
        };

        if (context.clientId || context.documentId) {
            fetchSuggestions();
        } else {
            setSuggestions([]);
            setIsLoading(false);
        }
    }, [context]);

    return (
        <div className="mt-4 pt-4 border-t border-border dark:border-slate-700/50">
            <h3 className="text-base font-bold flex items-center gap-2 mb-3">
                <BrainCircuit className="w-5 h-5 text-primary" />
                AI Assistant
            </h3>
            <div className="space-y-3">
                {isLoading ? (
                    <div className="text-sm text-on-surface-secondary">Analyzing...</div>
                ) : suggestions.length > 0 ? (
                    suggestions.map(suggestion => {
                        const { Icon, borderColor, textColor, bgColor } = getSuggestionStyles(suggestion.type, suggestion.priority);
                        return (
                            <div key={suggestion.id} className={`p-3 rounded-lg border-l-4 ${borderColor} ${bgColor} animate-fade-in-up`}>
                                <div className="flex items-start gap-2">
                                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${textColor}`} />
                                    <div className="flex-1">
                                        <p className={`text-sm font-medium ${textColor}`}>{suggestion.message}</p>
                                        {suggestion.actionText && (
                                            <button className="mt-2 text-xs font-bold bg-white dark:bg-slate-700 px-3 py-1 rounded-full shadow hover:bg-gray-50 dark:hover:bg-slate-600 transition">
                                                {suggestion.actionText}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <p className="text-sm text-on-surface-secondary">No specific AI suggestions at this time.</p>
                )}
            </div>
        </div>
    );
};

export default AiAssistant;