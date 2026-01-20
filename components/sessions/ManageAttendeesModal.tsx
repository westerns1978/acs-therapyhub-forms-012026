

import React, { useState, useMemo } from 'react';
import { Appointment, Client, Attendee } from '../../types';
import SignaturePad from '../ui/SignaturePad';

const CheckCircleIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
const AlertTriangleIcon = (props: React.ComponentProps<'svg'>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>;

interface ManageAttendeesModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment: Appointment;
    onUpdateAppointment: (updatedAppointment: Appointment) => void;
    clients: Client[];
}

const getStatusPill = (attendanceStatus: Attendee['attendanceStatus']) => {
    switch(attendanceStatus) {
        case 'Checked In': return 'bg-green-100 text-green-800';
        case 'Checked Out': return 'bg-blue-100 text-blue-800';
        case 'No Show': return 'bg-red-100 text-red-800';
        case 'Awaiting': return 'bg-yellow-100 text-yellow-800';
    }
};

type RegisteredClient = Attendee & Partial<Client>;

const ManageAttendeesModal: React.FC<ManageAttendeesModalProps> = ({ isOpen, onClose, appointment, onUpdateAppointment, clients }) => {
    const [signingClient, setSigningClient] = useState<Client | null>(null);

    const updateAttendeeStatus = (clientId: string, updates: Partial<Attendee>) => {
        const updatedAttendees = appointment.attendees?.map(att => 
            att.clientId === clientId ? { ...att, ...updates } : att
        );
        onUpdateAppointment({ ...appointment, attendees: updatedAttendees });
    };

    const handleCheckIn = (client: Client) => {
        setSigningClient(client);
    };

    const handleSaveSignature = (signatureDataUrl: string) => {
        if (!signingClient) return;
        updateAttendeeStatus(signingClient.id, {
            attendanceStatus: 'Checked In',
            checkInTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            signatureDataUrl
        });
        setSigningClient(null);
    };

    const handleCheckOut = (clientId: string) => {
        updateAttendeeStatus(clientId, {
            attendanceStatus: 'Checked Out',
            checkOutTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        });
    };
    
    const handleNoShow = (clientId: string) => {
        updateAttendeeStatus(clientId, { attendanceStatus: 'No Show' });
    };

    const registeredClients: RegisteredClient[] = useMemo(() => {
        return appointment.attendees?.map(attendee => {
            const client = clients.find(c => c.id === attendee.clientId);
            return client ? { ...attendee, ...client } : attendee;
        }) || [];
    }, [appointment.attendees, clients]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col h-[90vh]">
                <header className="flex justify-between items-center p-4 border-b border-black/10 dark:border-white/10 flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-semibold">Manage Attendees</h2>
                        <p className="text-sm text-on-surface-secondary">{appointment.title} - {new Date(appointment.date).toLocaleDateString()}</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-2xl font-light" aria-label="Close modal">&times;</button>
                </header>

                <main className="flex-1 p-2 sm:p-6 overflow-y-auto">
                    {signingClient ? (
                        <div className="max-w-xl mx-auto p-4 bg-surface rounded-lg border">
                             <h3 className="text-xl font-bold text-center mb-2">Check-in Signature</h3>
                            <p className="text-center text-gray-500 mb-6">Client: {signingClient.name}</p>
                             <SignaturePad onSave={handleSaveSignature} />
                            <button onClick={() => setSigningClient(null)} className="w-full mt-2 text-sm text-center text-primary">Cancel</button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-border">
                                <thead className="bg-surface">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase">Client</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase">Check-in Time</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-secondary uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-background divide-y divide-border">
                                    {registeredClients.map(c => (
                                        <tr key={c.clientId}>
                                            <td className="px-6 py-4 flex items-center gap-3">
                                                {c.avatarUrl && c.name && (
                                                    <>
                                                        <img src={c.avatarUrl} alt={c.name} className="w-10 h-10 rounded-full"/>
                                                        <div>
                                                            <p className="font-semibold">{c.name}</p>
                                                            <p className="text-xs text-on-surface-secondary">{c.program}</p>
                                                        </div>
                                                    </>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusPill(c.attendanceStatus)}`}>
                                                    {c.attendanceStatus}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono">{c.checkInTime || '--:--'}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-2 text-sm font-semibold">
                                                    {c.id && c.attendanceStatus === 'Awaiting' && (
                                                        <>
                                                            <button onClick={() => handleCheckIn(c as Client)} className="text-green-600 hover:underline">Check In</button>
                                                            <button onClick={() => handleNoShow(c.id!)} className="text-red-600 hover:underline">No Show</button>
                                                        </>
                                                    )}
                                                     {c.id && c.attendanceStatus === 'Checked In' && (
                                                        <>
                                                            <button onClick={() => handleCheckOut(c.id!)} className="text-blue-600 hover:underline">Check Out</button>
                                                            {c.signatureDataUrl && <a href={c.signatureDataUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:underline">View Sig</a>}
                                                        </>
                                                    )}
                                                    {c.attendanceStatus === 'Checked Out' && <span className="text-gray-500">Completed</span>}
                                                    {c.attendanceStatus === 'No Show' && <span className="text-red-500">$40 Fee Assessed</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default ManageAttendeesModal;