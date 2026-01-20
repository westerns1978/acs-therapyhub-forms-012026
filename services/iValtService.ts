
import { supabase } from './supabase';

export interface IValtAuthStatus {
  step: number;
  message: string;
  status: 'pending' | 'success' | 'error';
  request_id?: string;
}

class IValtService {
  /**
   * Triggers the biometric push notification.
   */
  async startAuthentication(mobile: string, demoMode: boolean = false): Promise<string> {
    if (demoMode) return 'demo-' + crypto.randomUUID();

    const digitsOnly = mobile.replace(/\D/g, '');
    const cleanMobile = `+1${digitsOnly}`;

    try {
      const { data, error } = await supabase.functions.invoke('ivalt-auth', {
        body: { action: 'start-auth', mobile: cleanMobile },
      });

      if (error) throw new Error(error.message || 'Verification gateway unreachable.');
      return data.request_id;
    } catch (err: any) {
      console.error('[iVALT] HANDSHAKE_FAILED:', err.message);
      throw new Error('Biometric gateway connection failed.');
    }
  }

  /**
   * Continuous Telemetry Polling.
   * Prioritizes the "success" flag over sequential steps.
   */
  pollStatus(
    requestId: string, 
    mobile: string, 
    callback: (status: IValtAuthStatus) => void, 
    demoMode: boolean = false
  ): () => void {
    if (demoMode) {
      let step = 1;
      const interval = setInterval(() => {
        step++;
        if (step <= 6) {
          callback({ step, message: 'Verifying Identity...', status: 'pending', request_id: requestId });
        } else {
          clearInterval(interval);
          callback({ step: 7, message: 'Verified', status: 'success', request_id: requestId });
        }
      }, 800);
      return () => clearInterval(interval);
    }

    const digitsOnly = mobile.replace(/\D/g, '');
    const cleanMobile = `+1${digitsOnly}`;
    const startTime = Date.now();
    let timerId: number | undefined;

    const poll = async () => {
      // 8 minute max timeout per session
      if (Date.now() - startTime > 480000) {
        callback({ step: 0, message: 'Uplink Expired', status: 'error', request_id: requestId });
        return;
      }

      try {
        const { data, status } = await supabase.functions.invoke('ivalt-auth', {
          body: { action: 'validate', mobile: cleanMobile, request_id: requestId },
        });

        // TERMINAL SUCCESS (Priority 1)
        if (data?.status === 'success' || status === 200) {
          callback({ step: 7, message: 'Access Approved', status: 'success', request_id: requestId });
          return;
        }

        // TERMINAL FAILURE (Priority 2)
        if (data?.status === 'error' || (status >= 400 && status !== 403)) {
          callback({ step: 0, message: data?.message || 'Verification Failed', status: 'error', request_id: requestId });
          return;
        }

        // PENDING STATE (Priority 3)
        // 403 often indicates device push is successful but biometric scan is pending
        const currentStep = status === 403 ? 5 : 3;
        callback({ 
          step: currentStep, 
          message: data?.message || 'Awaiting mobile biometric...', 
          status: 'pending', 
          request_id: requestId 
        });
        
        timerId = window.setTimeout(poll, 2000);

      } catch (err: any) {
        // Network flutter handling: retry with exponential backoff feel
        timerId = window.setTimeout(poll, 3000);
      }
    };

    timerId = window.setTimeout(poll, 500); 
    return () => { if (timerId) clearTimeout(timerId); };
  }
}

export const iValtService = new IValtService();
