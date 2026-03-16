'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000,
            },
        },
    })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
    if (typeof window === 'undefined') {
        return makeQueryClient()
    } else {
        if (!browserQueryClient) browserQueryClient = makeQueryClient()
        return browserQueryClient
    }
}

// Dark Mode Context
const DarkModeContext = createContext<{
    darkMode: boolean;
    setDarkMode: (enabled: boolean) => void;
} | null>(null);

export const useDarkMode = () => {
    const context = useContext(DarkModeContext);
    if (!context) {
        throw new Error('useDarkMode must be used within a DarkModeProvider');
    }
    return context;
};

function DarkModeProvider({ children }: { children: React.ReactNode }) {
    const [darkMode, setDarkModeState] = useState<boolean>(false);

    const applyDark = (enabled: boolean) => {
        const html = document.documentElement;
        if (enabled) html.classList.add('dark');
        else html.classList.remove('dark');
    };

    const setDarkMode = (enabled: boolean) => {
        setDarkModeState(enabled);
        applyDark(enabled);
    };

    useEffect(() => {
        const m = window.matchMedia('(prefers-color-scheme: dark)');
        setDarkModeState(m.matches);
        applyDark(m.matches);
        const listener = (e: MediaQueryListEvent) => {
            setDarkModeState(e.matches);
            applyDark(e.matches);
        };
        m.addEventListener('change', listener);
        return () => m.removeEventListener('change', listener);
    }, []);

    return (
        <DarkModeContext.Provider value={{ darkMode, setDarkMode }}>
            {children}
        </DarkModeContext.Provider>
    );
}

export default function Providers({ children }: { children: React.ReactNode }) {
    const queryClient = getQueryClient()

    return (
        <QueryClientProvider client={queryClient}>
            <DarkModeProvider>
                {children}
            </DarkModeProvider>
        </QueryClientProvider>
    )
}
