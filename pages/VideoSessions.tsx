import React from 'react';
import Card from '../components/ui/Card';
import { Video } from 'lucide-react';

/**
 * Video Sessions — HONEST PLACEHOLDER (2026-07-28).
 *
 * The previous version was a MOCK session console: getVideoSessions() returned a
 * hardcoded array, and its "Start"/"Complete"/"Cancel" controls called
 * updateVideoSessionStatus / addVideoSession — an empty body and a function that
 * returned a fabricated object without ever writing. Staff could "run" a whole
 * session lifecycle and nothing was ever recorded.
 *
 * Those API functions are now retired with do-not-reintroduce guards
 * (services/api.ts). The real session spine is the `appointments` table:
 * /session-management (calendar) + AppointmentStatusModal for completion, and the
 * Zoom edge functions for links. Its companion ScheduleVideoSessionModal is now
 * orphaned along with this page.
 *
 * Route kept (not deleted) so the TRIAL_MODE redirect in App.tsx stays the single
 * containment point. Stays hidden; rebuild on `appointments` before un-hiding.
 */
const VideoSessions: React.FC = () => (
    <div className="max-w-3xl mx-auto py-16">
        <Card title="Video Sessions" subtitle="Not yet rebuilt on real data.">
            <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Video size={40} className="text-slate-300" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    This page is not available.
                </p>
                <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                    Nothing is shown here because this surface has no verified data behind it yet.
                    Real sessions live on the Calendar, where scheduling and completion are recorded.
                </p>
            </div>
        </Card>
    </div>
);

export default VideoSessions;
