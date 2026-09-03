// User Preferences and App Configuration Management

export interface UserSettings {
  // Account & Profile
  displayName?: string;
  
  // Time Frame & Daily Rhythm
  timelineStartMode: 'dynamic' | 'custom'; // dynamic = now, custom = fixed workday start
  customStartTime: string; // e.g. "09:00"
  customEndTime: string; // e.g. "18:00"
  targetDailyFocusHours: number; // e.g. 4
  defaultFocusDuration: number; // e.g. 25
  defaultBreakDuration: number; // e.g. 5
  workdays: string[]; // ['mon', 'tue', 'wed', 'thu', 'fri']
  
  // AI Algorithm & Executive Engine
  decompositionGranularity: 'micro' | 'balanced' | 'deep';
  schedulingAlgorithm: 'circadian' | 'momentum';
  habitStreakMode: 'grace' | 'strict'; // grace = ADHD forgiveness grace-day
  coachingStyle: 'gentle' | 'direct';
  
  // Focus & Sensory
  soundChime: 'bell' | 'bowl' | 'digital' | 'chime' | 'none';
  soundVolume: number; // 0 to 1
  confettiEnabled: boolean;
  notificationsEnabled: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  timelineStartMode: 'dynamic',
  customStartTime: '09:00',
  customEndTime: '18:00',
  targetDailyFocusHours: 4,
  defaultFocusDuration: 25,
  defaultBreakDuration: 5,
  workdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  
  decompositionGranularity: 'micro',
  schedulingAlgorithm: 'circadian',
  habitStreakMode: 'grace',
  coachingStyle: 'gentle',
  
  soundChime: 'bell',
  soundVolume: 0.7,
  confettiEnabled: true,
  notificationsEnabled: false,
};

const SETTINGS_KEY = 'serene_user_settings_v1';

export function getStoredSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn("Failed to read settings from localStorage", e);
  }
  return DEFAULT_SETTINGS;
}

export function saveStoredSettings(newSettings: Partial<UserSettings>): UserSettings {
  try {
    const current = getStoredSettings();
    const updated = { ...current, ...newSettings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    // Dispatch custom storage event for live reactive sync across components
    window.dispatchEvent(new CustomEvent('serene_settings_updated', { detail: updated }));
    return updated;
  } catch (e) {
    console.warn("Failed to write settings to localStorage", e);
    return DEFAULT_SETTINGS;
  }
}
