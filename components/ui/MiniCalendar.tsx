import React, { useState } from 'react';

const MiniCalendar: React.FC = () => {
    const [date, setDate] = useState(new Date());

    const today = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startingDay = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();
    
    const days = Array.from({ length: startingDay }, (_, i) => <div key={`empty-${i}`} className="text-center py-1"></div>);
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
        days.push(
            <div key={day} className={`text-center py-1 text-sm rounded-full ${isToday ? 'bg-primary text-white font-bold' : 'text-surface-secondary dark:text-dark-surface-secondary'}`}>
                {day}
            </div>
        );
    }
    
    const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
        <div className="p-2">
            <div className="flex justify-between items-center mb-2">
                <button type="button" onClick={() => setDate(new Date(year, month - 1, 1))} className="text-surface-secondary dark:text-dark-surface-secondary hover:text-surface-content dark:hover:text-dark-surface-content p-1 rounded-full">&lt;</button>
                <h4 className="font-semibold text-sm">{date.toLocaleString('default', { month: 'long', year: 'numeric' })}</h4>
                <button type="button" onClick={() => setDate(new Date(year, month + 1, 1))} className="text-surface-secondary dark:text-dark-surface-secondary hover:text-surface-content dark:hover:text-dark-surface-content p-1 rounded-full">&gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-1">
                {weekDays.map(d => <div key={d} className="text-center font-bold text-xs text-surface-secondary dark:text-dark-surface-secondary">{d}</div>)}
                {days}
            </div>
        </div>
    );
};

export default MiniCalendar;