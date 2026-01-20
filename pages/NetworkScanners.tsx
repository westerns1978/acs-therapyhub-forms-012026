
import React, { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Header from '../components/ui/Header';
import { NetworkScanner, ScannerStatus } from '../types';
import { getNetworkScanners, addNetworkScanner, removeNetworkScanner } from '../services/api';
import { PlusCircle, Edit, Trash2, X, HardDrive } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const getStatusColor = (status: ScannerStatus) => {
    switch (status) {
        case 'Online': return 'bg-green-100 text-green-800';
        case 'Offline': return 'bg-gray-200 text-gray-800';
        case 'Busy': return 'bg-blue-100 text-blue-800';
        case 'Error': return 'bg-red-100 text-red-800';
        case 'Low Paper': return 'bg-yellow-100 text-yellow-800';
    }
};

const AddScannerModal: React.FC<{ isOpen: boolean, onClose: () => void, onAdd: (scanner: Omit<NetworkScanner, 'id' | 'status'>) => void }> = ({ isOpen, onClose, onAdd }) => {
    const [name, setName] = useState('');
    const [ipAddress, setIpAddress] = useState('');
    const [model, setModel] = useState('Epson DS-790WN');
    const [location, setLocation] = useState('Main Office');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAdd({ name, ipAddress, model, location });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-background dark:bg-dark-surface rounded-lg shadow-xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <header className="flex justify-between items-center p-4 border-b">
                        <h3 className="text-lg font-semibold">Add New Network Scanner</h3>
                        <button type="button" onClick={onClose}><X size={24} /></button>
                    </header>
                    <main className="p-6 space-y-4">
                        <div><label className="block text-sm font-medium mb-1">Scanner Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full p-2 border rounded-md" placeholder="e.g., Front Desk Scanner" /></div>
                        <div><label className="block text-sm font-medium mb-1">IP Address</label><input type="text" value={ipAddress} onChange={e => setIpAddress(e.target.value)} required className="w-full p-2 border rounded-md" placeholder="e.g., 192.168.1.101" /></div>
                        <div><label className="block text-sm font-medium mb-1">Model</label><input type="text" value={model} onChange={e => setModel(e.target.value)} required className="w-full p-2 border rounded-md" /></div>
                        <div><label className="block text-sm font-medium mb-1">Location</label><input type="text" value={location} onChange={e => setLocation(e.target.value)} required className="w-full p-2 border rounded-md" /></div>
                    </main>
                    <footer className="p-4 border-t flex justify-end">
                        <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Add Scanner</button>
                    </footer>
                </form>
            </div>
        </div>
    );
};

const NetworkScanners: React.FC = () => {
    const [scanners, setScanners] = useState<NetworkScanner[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchScanners = async () => {
        setIsLoading(true);
        const data = await getNetworkScanners();
        setScanners(data);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchScanners();
        const interval = setInterval(fetchScanners, 5000); // Poll for status updates
        return () => clearInterval(interval);
    }, []);

    const handleAddScanner = async (scannerData: Omit<NetworkScanner, 'id' | 'status'>) => {
        await addNetworkScanner(scannerData);
        fetchScanners(); // Re-fetch to get the new list
    };
    
    const handleRemoveScanner = async (scannerId: string) => {
        if(window.confirm("Are you sure you want to remove this scanner?")) {
            await removeNetworkScanner(scannerId);
            fetchScanners();
        }
    };

    return (
        <div>
            <Header title="Network Scanners" subtitle="Manage and monitor hardware scanners across all locations.">
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-primary text-white font-bold py-2 px-4 rounded-lg">
                    <PlusCircle size={18} /> Add Scanner
                </button>
            </Header>

            {isLoading && scanners.length === 0 ? (
                <LoadingSpinner />
            ) : (
                <Card noPadding>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-border">
                            <thead className="bg-surface">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase">IP Address</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase">Model</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase">Location</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-on-surface-secondary uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-background divide-y divide-border">
                                {scanners.map(scanner => (
                                    <tr key={scanner.id}>
                                        <td className="px-6 py-4 font-medium flex items-center gap-2"><HardDrive size={16} className={scanner.status === 'Online' ? 'text-green-500' : 'text-gray-400'}/> {scanner.name}</td>
                                        <td className="px-6 py-4 font-mono text-sm">{scanner.ipAddress}</td>
                                        <td className="px-6 py-4">{scanner.model}</td>
                                        <td className="px-6 py-4">{scanner.location}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(scanner.status)}`}>
                                                {scanner.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700"><Edit size={16} /></button>
                                            <button onClick={() => handleRemoveScanner(scanner.id)} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 text-red-500"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            <AddScannerModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onAdd={handleAddScanner}
            />
        </div>
    );
};

export default NetworkScanners;
