
const GOOGLE_CALENDAR_KEY = 'integration_google_calendar';
const ZOOM_KEY = 'integration_zoom';

export const isGoogleCalendarConnected = (): boolean => {
    try {
        return localStorage.getItem(GOOGLE_CALENDAR_KEY) === 'true';
    } catch {
        return false;
    }
};

export const connectGoogleCalendar = (): void => {
    try {
        localStorage.setItem(GOOGLE_CALENDAR_KEY, 'true');
    } catch (e) {
        console.error("Could not write to localStorage", e);
    }
};

export const disconnectGoogleCalendar = (): void => {
    try {
        localStorage.removeItem(GOOGLE_CALENDAR_KEY);
    } catch (e) {
        console.error("Could not write to localStorage", e);
    }
};

export const isZoomConnected = (): boolean => {
    try {
        return localStorage.getItem(ZOOM_KEY) === 'true';
    } catch {
        return false;
    }
};

export const connectZoom = (): void => {
    try {
        localStorage.setItem(ZOOM_KEY, 'true');
    } catch (e) {
        console.error("Could not write to localStorage", e);
    }
};

export const disconnectZoom = (): void => {
    try {
        localStorage.removeItem(ZOOM_KEY);
    } catch (e) {
        console.error("Could not write to localStorage", e);
    }
};
