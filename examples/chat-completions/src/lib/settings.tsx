"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";

const STORAGE_KEY = "pageindex-chat-completions-settings";

export interface Settings {
  pageindexApiUrl: string;
  pageindexApiKey: string;
}

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (settings: Settings) => void;
  isConfigured: boolean;
  isLoaded: boolean;
  getHeaders: () => Record<string, string>;
}

const defaultSettings: Settings = {
  pageindexApiUrl: "https://api.pageindex.ai",
  pageindexApiKey: "",
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useMountEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Settings>;
        setSettings({
          ...defaultSettings,
          ...parsed,
        });
      }
    } catch {
      // ignore parse errors
    }
    setIsLoaded(true);
  });

  const updateSettings = useCallback((newSettings: Settings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch {
      // ignore storage errors
    }
  }, []);

  const isConfigured =
    !!settings.pageindexApiUrl && !!settings.pageindexApiKey;

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {};
    if (settings.pageindexApiUrl) {
      headers["x-pageindex-api-url"] = settings.pageindexApiUrl;
    }
    if (settings.pageindexApiKey) {
      headers["x-pageindex-api-key"] = settings.pageindexApiKey;
    }
    return headers;
  }, [settings]);

  return (
    <SettingsContext.Provider
      value={{ settings, updateSettings, isConfigured, isLoaded, getHeaders }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
