import React, { useState } from 'react';
import Header from '../components/ui/Header';
import { FormLibrary, View } from '../components/FormLibrary';
import { BaseFormTemplate } from '../components/BaseFormTemplate';
import { SATOP_INTAKE_DEFINITION } from '../components/forms/SatopClientIntakeForm'; // This would be the first form

const Forms: React.FC = () => {
    const [currentView, setCurrentView] = useState<View>('library');

    const renderView = () => {
        switch (currentView) {
            case 'satop-intake':
                return <BaseFormTemplate formDefinition={SATOP_INTAKE_DEFINITION} onBackToLibrary={() => setCurrentView('library')} />;
            // Other cases would follow...
            case 'library':
            default:
                return <FormLibrary onSelectForm={setCurrentView} />;
        }
    };

    return (
        <div className="animate-fade-in-up">
            {renderView()}
        </div>
    );
};

export default Forms;
