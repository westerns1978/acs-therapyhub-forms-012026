

import React, { useState } from 'react';
import { Appointment } from '../../types';
// Fix: Import the Card component
import Card from './Card';

interface CalendarViewProps {
    appointments: Appointment[];
    onDateClick: (date: Date) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ appointments, onDateClick }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(startOfMonth);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    const endDate = new Date(endOfMonth);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const days = [];
    let day = new Date(startDate);

    while (day <= endDate) {
        days.push(new Date(day));
        day.setDate(day.getDate() + 1);
    }

    const appointmentsByDate: { [key: string]: Appointment[] } = {};
    appointments.forEach(apt => {
        const dateStr = new Date(apt.date).toDateString();
        if (!appointmentsByDate[dateStr]) {
            appointmentsByDate[dateStr] = [];
        }
        appointmentsByDate[dateStr].push(apt);
    });

    const changeMonth = (offset: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    const isToday = (date: Date) => {
        return date.toDateString() === new Date().toDateString();
    };

    return (
        <Card className="p-0">
            <div className="flex justify-between items-center p-4 border-b border-border dark:border-slate-700">
                <button onClick={() => changeMonth(-1)} className="px-3 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700">&lt;</button>
                <h2 className="text-lg font-semibold">
                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h2>
                <button onClick={() => changeMonth(1)} className="px-3 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700">&gt;</button>
            </div>
            <div className="grid grid-cols-7">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(dayName => (
                    <div key={dayName} className="text-center font-bold text-xs py-2 text-on-surface-secondary border-b border-r border-border dark:border-slate-700">
                        {dayName}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 grid-rows-5">
                {days.map(d => {
                    const dateStr = d.toDateString();
                    const dayAppointments = appointmentsByDate[dateStr] || [];
                    const isCurrentMonth = d.getMonth() === currentDate.getMonth();

                    return (
                        <div
                            key={d.toString()}
                            className={`p-2 border-b border-r border-border dark:border-slate-700 h-32 overflow-y-auto ${!isCurrentMonth ? 'bg-surface dark:bg-slate-800/50' : ''}`}
                        >
                            <span className={`text-sm ${isToday(d) ? 'bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center font-bold' : ''}`}>
                                {d.getDate()}
                            </span>
                            <div className="mt-1 space-y-1">
                                {dayAppointments.map(apt => (
                                    <div key={apt.id} className="text-xs p-1 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 truncate">
                                        {apt.startTime} {apt.title}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

export default CalendarView;
