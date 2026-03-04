import { HONEYPOT_BLOCK_MS, HONEYPOT_MAX_TRIGGERS } from './config';

export interface HoneypotIpState {
  triggers: number[];
  blockedUntil: number;
}

export const honeypotIps = new Map<string, HoneypotIpState>();

export function getHoneypotState(ip: string): HoneypotIpState {
  const existing = honeypotIps.get(ip);
  if (!existing) {
    const initial: HoneypotIpState = { triggers: [], blockedUntil: 0 };
    honeypotIps.set(ip, initial);
    return initial;
  }
  // Clean up old triggers outside the block window
  const cutoff = Date.now() - HONEYPOT_BLOCK_MS;
  existing.triggers = existing.triggers.filter((ts) => ts > cutoff);
  return existing;
}

/**
 * Check honeypot status and optionally record a trigger.
 * Returns 'allowed' if the IP can proceed, 'bot_blocked' if the honeypot field was filled,
 * or 'ip_blocked' if the IP has been blocked from previous triggers.
 */
export function checkHoneypot(
  ip: string,
  honeypotFilled: boolean,
): 'allowed' | 'bot_blocked' | 'ip_blocked' {
  const state = getHoneypotState(ip);
  const now = Date.now();

  // Check if IP is already blocked
  if (state.blockedUntil > now) {
    return 'ip_blocked';
  }

  // If honeypot field was filled, record the trigger
  if (honeypotFilled) {
    state.triggers.push(now);
    if (state.triggers.length >= HONEYPOT_MAX_TRIGGERS) {
      state.blockedUntil = now + HONEYPOT_BLOCK_MS;
    }
    return 'bot_blocked';
  }

  // Check if this IP has accumulated enough triggers to be blocked
  if (state.triggers.length >= HONEYPOT_MAX_TRIGGERS) {
    state.blockedUntil = now + HONEYPOT_BLOCK_MS;
    return 'ip_blocked';
  }

  return 'allowed';
}

/**
 * Get all currently blocked IPs from the in-memory Map (for admin panel).
 */
export function getInMemoryBlockedIps(): Array<{
  ip: string;
  blockedUntil: number;
  triggerCount: number;
}> {
  const now = Date.now();
  const blocked: Array<{ ip: string; blockedUntil: number; triggerCount: number }> = [];

  for (const [ip, state] of honeypotIps) {
    if (state.blockedUntil > now || state.triggers.length >= HONEYPOT_MAX_TRIGGERS) {
      blocked.push({
        ip,
        blockedUntil: state.blockedUntil,
        triggerCount: state.triggers.length,
      });
    }
  }

  return blocked;
}
