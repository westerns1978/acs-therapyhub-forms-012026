
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getClients } from '../../services/api';
import { Client } from '../../types';
import LoadingSpinner from '../ui/LoadingSpinner';
import ClientAvatar from './ClientAvatar';
import { Search } from 'lucide-react';

const ClientCard: React.FC<{ client: Client }> = ({ client }) => {
    const navigate = useNavigate();
    return (
        <div 
            onClick={() => navigate(`/clients/${client.id}`)}
            className="bg-white/70 dark:bg-dark-surface/70 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-xl shadow-md p-4 flex flex-col items-center text-center cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
        >
            <ClientAvatar client={client} className="w-20 h-20 text-3xl mb-3" />
            <h3 className="font-bold">{client.name}</h3>
            <p className="text-sm text-surface-secondary-content">{client.program}</p>
            <div className="w-full bg-gray-200 rounded-full h-2 my-3">
                <div className="bg-primary h-2 rounded-full" style={{ width: `${client.completionPercentage}%` }}></div>
            </div>
            <p className="text-xs text-surface-secondary-content">Compliance: <span className="font-semibold">{client.complianceScore}%</span></p>
        </div>
    );
};

const ClientSelectionGrid: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const location = useLocation();

    useEffect(() => {
        const fetchClients = async () => {
            setIsLoading(true);
            const clientsData = await getClients();
            setClients(clientsData.filter(c => c.status !== 'Archived'));
            setIsLoading(false);
        };
        fetchClients();
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const search = params.get('search');
        if (search) {
            setSearchTerm(search);
        }
    }, [location.search]);

    const filteredClients = useMemo(() => {
        return clients.filter(client => 
            client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.caseNumber.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [clients, searchTerm]);

    if (isLoading) {
        return <LoadingSpinner />;
    }

    return (
        <div>
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Select a Client</h1>
                    <p className="text-surface-secondary-content">Choose a client to view their dedicated workspace.</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input 
                        type="text"
                        placeholder="Search by name or case #"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-64 pl-9 pr-3 py-2 text-sm bg-background dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-lg focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {filteredClients.map(client => (
                    <ClientCard key={client.id} client={client} />
                ))}
            </div>
        </div>
    );
};

export default ClientSelectionGrid;
