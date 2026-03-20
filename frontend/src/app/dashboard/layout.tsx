'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import useTokenExpiration from '@/hooks/useTokenExpiration';
import {
    LayoutDashboard, Users, Calendar, Settings, Phone, MessageSquare, Search,
    Bell, Menu, FileText, LogOut, Zap, PieChart, X,
    LayoutList, Brain, PhoneIncoming, CreditCard, Key, Globe
} from 'lucide-react';
import { useStore } from '@/lib/zustand';


interface UserPayload {
    name: string;
    email: string;
    avatarUrl?: string;
    role?: string;
    subscription?: {
        plan: string;
        status: string;
    };
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {

    const store = useStore();
    const pathname = usePathname();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [user, setUser] = useState<UserPayload | null>(null);
    const [openProfile, setOpenProfile] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [selectedSideBar, setSelectSideBar] = useState('');
    const [selectedVoiceAgentNav, setSelectedVoiceAgentNav] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const sidebarRef = useRef<HTMLElement>(null);
    const notificationRef = useRef<HTMLDivElement>(null);

    useTokenExpiration();

    // ✅ Mark as mounted — all localStorage/socket logic runs after this
    useEffect(() => {

        setMounted(true);
     
    }, []);

    // Fetch user — only after mount
    useEffect(() => {
        if (!mounted) return;
        (async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    setUser({ name: 'Guest User', email: '', avatarUrl: '' });
                    router.push('/login')
                    return;
                }
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                    try {
                        const parsedUser = JSON.parse(storedUser);
                        if (parsedUser.name) { setUser(parsedUser); return; }
                    } catch (parseErr) {
                        console.error('Error parsing stored user:', parseErr);
                    }
                }
                const storedName = localStorage.getItem('userName');
                const storedRole = localStorage.getItem('userRole');
                if (storedName) {
                    setUser({ name: storedName, email: '', avatarUrl: '', role: storedRole || '' });
                } else {
                    setUser({ name: 'Guest User', email: '', avatarUrl: '' });
                }
            } catch (err) {
                console.error('User initialization error:', err);
                setUser({ name: 'Guest User', email: '', avatarUrl: '' });
            }
        })();
    }, [mounted]);

    // Click outside handlers
    useEffect(() => {
        if (!mounted) return;
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
                setOpenProfile(false);
            if (showMobileMenu && sidebarRef.current && !sidebarRef.current.contains(e.target as Node))
                setShowMobileMenu(false);
            if (notificationRef.current && !notificationRef.current.contains(e.target as Node))
                setShowNotifications(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [mounted, showMobileMenu]);

    useEffect(() => {
        const voiceRoutes = ['/dashboard/agents', '/dashboard/phoneNumbers', '/dashboard/knowledgeResources'];
        if (voiceRoutes.some(route => pathname?.startsWith(route))) {
            setSelectedVoiceAgentNav(true);
        } else {
            setSelectedVoiceAgentNav(false);
        }
    }, [pathname]);

    // Debounced Search
    useEffect(() => {
        if (!mounted) return;
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length < 2) {
                setSearchResults([]);
                setShowResults(false);
                return;
            }
            setIsSearching(true);
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await fetch(`/api/clients?search=${encodeURIComponent(searchTerm)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setSearchResults(data);
                    setShowResults(true);
                }
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsSearching(false);
            }
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [mounted, searchTerm]);

    // Notifications + Socket — only after mount
    useEffect(() => {
        if (!mounted) return;

        const token = localStorage.getItem('token');
        if (!token) return;

        // Fetch initial notifications
        import('@/lib/api').then(m => {
            m.default.get('/notifications')
                .then(({ data }) => {
                    if (Array.isArray(data)) {
                        setNotifications(data);
                        setUnreadCount(data.filter((n: any) => !n.isRead).length);
                    }
                })
                .catch(console.error);
        });

        // ✅ Socket connection — safely inside useEffect, never runs on SSR
        let socketInstance: any = null;
        import('socket.io-client').then(({ io }) => {
            const socketUrl = process.env.NODE_ENV === 'development'
                ? 'http://localhost:5000'
                : '';

            // ✅ Pass token in query params instead of auth object to avoid SSR crash
            socketInstance = io(socketUrl, {
                query: { token },  // ✅ safe — no 'auth' property destructuring
                path: '/socket.io'
            });

            socketInstance.on('notification:new', (newNotification: any) => {
                setNotifications(prev => [newNotification, ...prev]);
                setUnreadCount(prev => prev + 1);
            });
        });

        return () => {
            if (socketInstance) socketInstance.disconnect();
        };
    }, [mounted]);

    const markAllAsRead = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/notifications/read-all', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (res.ok) {
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                setUnreadCount(0);
            }
        } catch (error) {
            console.error('Failed to mark notifications as read', error);
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        window.location.href = '/login';
    };

    const toggleVoiceNav = () => {
        setSelectedVoiceAgentNav(sel => !sel);
    };

    // ✅ Don't render anything until client is ready
    if (!mounted) return null;

    return (
        <div className="flex h-screen bg-[#F3F4F6] dark:bg-gray-900 overflow-hidden text-gray-900 dark:text-gray-100 font-sans">

            {showMobileMenu && (
                <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" />
            )}

            {/* SIDEBAR */}
            <aside
                ref={sidebarRef}
                className={`fixed lg:static top-0 left-0 h-full lg:h-auto w-64 bg-gradient-to-tl from-gray-100 via-gray-50/20 to-blue-200 dark:from-gray-800 dark:via-gray-800 dark:to-gray-700 z-50
                transition-transform duration-300 flex flex-col shadow-xl
                ${showMobileMenu ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
            >
                <div className="h-24 flex items-center px-8 border-b border-blue-500/30 dark:border-blue-900/30">
                    <div className="flex items-center gap-3">
                        <div className="bg-white dark:bg-gray-700 p-2 rounded-lg shadow-md">
                            <img src="/newLogo.png" alt="Scriptish" className="h-6 w-auto" />
                        </div>
                        <span className="font-bold text-xl text-gray-800 dark:text-gray-100 tracking-tight">Scriptish</span>
                    </div>
                    <button
                        onClick={() => setShowMobileMenu(false)}
                        className="lg:hidden ml-auto text-blue-200 dark:text-blue-300 hover:text-white transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto scrollbar-hide">
                    <Section title="MENU">
                        <NavItem href="/dashboard" label="Dashboard" icon={<LayoutDashboard />} active={pathname === '/dashboard'} />
                         <Section title="AI CONCIERGE">
                        <NavItem
                        href='/dashboard/agents'
                            
                            label="Voice Agents"
                            icon={<Phone />}
                            active={selectedVoiceAgentNav}
                            onClick={toggleVoiceNav}
                        />
                        {selectedVoiceAgentNav && (
                            <nav className="px-4 space-y-1">
                                {[
                                    { name: 'Agents', icon: LayoutList,route:'/dashboard/agents' },
                                    { name: 'Phone Numbers', icon: Phone,route:'/dashboard/phoneNumbers' },
                                    { name: 'Knowledge Resources', icon: Brain,route:'/dashboard/knowledgeResources' },
                                    { name: 'Call Logs', icon: PhoneIncoming, },
                                    { name: 'Patients', icon: Users, route: '' },
                                    { name: 'Billing', icon: CreditCard, route: '' },
                                    { name: 'API Keys', icon: Key, route: '' },
                                    { name: 'Webhooks', icon: Globe, route: '' },
                                ].map(item => {
                                    const Icon = item.icon;
                                    const route = user?.email!=='ezehmark@gmail.com'?'/dashboard/menAtWork':item.route
                                    const isActive = item.route ? pathname.includes(route) : store.selectedVoicePage === item.name;
                                    return (
                                        <button
                                            type="button"
                                            onClick={() => { store.setSelectedVoicePage(item.name); if (route) router.push(route) }}
                                            key={item.name}
                                            className={`w-full flex items-center gap-3 dark:text-gray-300 px-4 py-2 rounded-lg cursor-pointer transition ${
                                                isActive ? 'bg-blue-100 font-semibold text-blue-600' : 'bg-transparent text-blue-500 hover:bg-blue-50 hover:text-blue-600'
                                            }`}
                                        >
                                            <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-600 group-hover:text-blue-600 dark:text-gray-400'}`} />
                                            <span className="text-sm truncate">{item.name}</span>
                                        </button>
                                    );
                                })}
                            </nav>
                        )}
                        <NavItem href="/dashboard/chat" label="Chatbot" icon={<MessageSquare />} active={pathname.startsWith('/dashboard/chat')} />
                        <NavItem href="/dashboard/workflows" label="Workflows" icon={<Zap />} active={pathname.startsWith('/dashboard/workflows')} />
                    </Section>
                        <NavItem href="/dashboard/clients" label="Customers" icon={<Users />} active={pathname.startsWith('/dashboard/clients')} />
                        <NavItem href="/dashboard/leads" label="Leads" icon={<Users size={18} />} active={pathname.startsWith('/dashboard/leads')} badge="New" />
                        <NavItem href="/dashboard/bookings" label="Bookings" icon={<Calendar />} active={pathname.startsWith('/dashboard/bookings')} />
                        <NavItem href="/dashboard/minutes" label="Meeting Minutes" icon={<FileText />} active={pathname.startsWith('/dashboard/minutes')} />
                        <NavItem href="/dashboard/insights" label="Analytics" icon={<PieChart />} active={pathname.startsWith('/dashboard/insights')} />
                    </Section>

                   

                    <Section title="ADMINISTRATION">
                        <NavItem href="/dashboard/admin" label="Subscriber Management" icon={<Zap className="text-amber-300" />} active={pathname?.startsWith('/dashboard/admin')} />
                    </Section>

                    <Section title="GENERAL">
                        <NavItem href="/dashboard/settings" label="Settings" icon={<Settings />} active={pathname.startsWith('/dashboard/settings')} />
                        <button
                            onClick={logout}
                            className="flex items-center cursor-pointer px-4 py-3 w-full text-red-600 bg-red-100/50 hover:bg-red-400/50 hover:text-white rounded-xl transition-all group"
                        >
                            <span className="mr-3"><LogOut className="w-5 h-5 text-red-600 group-hover:text-white transition-colors" /></span>
                            <span className="font-medium text-sm">Log out</span>
                        </button>
                    </Section>
                </nav>

                {user?.subscription?.plan !== 'Advanced' &&
                 user?.subscription?.plan !== 'Trial' &&
                 user?.subscription?.plan !== 'Basic' && (
                
                                <button className="w-1/2 mx-auto cursor-pointer shadow-sm my-8 bg-blue-600 text-gray-100 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all active:scale-95">
                                    <Zap className="w-4 h-4 text-white animate-pulse" />
                                    Upgrade
                                </button>
                           
                )}
            </aside>

            {/* MAIN */}
            <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
                <header className="h-20 px-8 hidden flex items-center justify-between bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-30 shadow-sm relative">
                    <div className="flex-1 flex items-center gap-6">
                        <button
                            onClick={() => setShowMobileMenu(true)}
                            className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            <Menu className="h-6 w-6" />
                        </button>

                        <div className="relative z-50">
                            <div className="hidden md:flex items-center bg-gray-100 dark:bg-gray-700 rounded-full px-5 py-2.5 w-96 max-w-lg transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white dark:focus-within:bg-gray-600 border border-transparent focus-within:border-blue-100 dark:focus-within:border-blue-700">
                                <Search className={`h-4 w-4 ${isSearching ? 'text-blue-500 animate-pulse' : 'text-gray-400 dark:text-gray-500'}`} />
                                <input
                                    className="ml-3 bg-transparent outline-none w-full text-sm placeholder-gray-400 dark:placeholder-gray-500 text-gray-700 dark:text-gray-100"
                                    placeholder="Search clients..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
                                    onBlur={() => setTimeout(() => setShowResults(false), 200)}
                                />
                            </div>

                            {showResults && (
                                <div className="absolute top-full left-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                    <div className="px-4 py-2 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50 flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Clients Found ({searchResults.length})
                                        </span>
                                        {isSearching && <span className="text-xs text-blue-500">Updating...</span>}
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        {searchResults.length > 0 ? (
                                            searchResults.map(client => (
                                                <Link
                                                    key={client.id}
                                                    href="/dashboard/clients"
                                                    className="block px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors group"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">{client.name}</p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">{client.email}</p>
                                                        </div>
                                                        <span className="text-xs font-mono text-gray-400 dark:text-gray-600 group-hover:text-blue-500 dark:group-hover:text-blue-400">{client.phone}</span>
                                                    </div>
                                                </Link>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-sm text-gray-400 dark:text-gray-500">No clients found.</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="relative" ref={notificationRef}>
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className={`relative p-2.5 rounded-full transition-all duration-200 outline-none group ${
                                    showNotifications
                                        ? 'bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400 ring-2 ring-blue-100 dark:ring-blue-800'
                                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                <Bell className="w-6 h-6 stroke-[1.5]" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white transform translate-x-1/4 -translate-y-1/4">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </button>

                            {showNotifications && (
                                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in slide-in-from-top-2 zoom-in-95 origin-top-right z-[100]">
                                    <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50 flex justify-between items-center">
                                        <div className="flex items-baseline gap-2">
                                            <h3 className="font-bold text-gray-900 dark:text-gray-100">Notifications</h3>
                                            {unreadCount > 0 && (
                                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded-full">
                                                    {unreadCount} New
                                                </span>
                                            )}
                                        </div>
                                        {unreadCount > 0 && (
                                            <button
                                                onClick={markAllAsRead}
                                                className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                            >
                                                Mark all read
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-[400px] overflow-y-auto">
                                        {notifications.length > 0 ? (
                                            notifications.map((n, i) => (
                                                <div
                                                    key={i}
                                                    className={`p-4 border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors relative ${!n.isRead ? 'bg-blue-50/20 dark:bg-blue-900/20' : ''}`}
                                                >
                                                    <div className="flex gap-4">
                                                        <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${!n.isRead ? 'bg-blue-500 dark:bg-blue-400 ring-4 ring-blue-50 dark:ring-blue-900' : 'bg-transparent'}`} />
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <p className={`text-sm ${!n.isRead ? 'font-bold text-gray-900 dark:text-gray-100' : 'font-medium text-gray-700 dark:text-gray-300'}`}>{n.title}</p>
                                                                <span className="text-[10px] text-gray-400 dark:text-gray-600 whitespace-nowrap ml-2">
                                                                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{n.message}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                                                <div className="w-12 h-12 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                                                    <Bell className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                                                </div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No notifications</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">You're all caught up!</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-2 border-t border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50 text-center">
                                        <button
                                            onClick={() => { setShowNotifications(false); router.push('/dashboard/notifications'); }}
                                            className="text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors w-full py-1"
                                        >
                                            View all history
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3 pl-6 border-l border-gray-100 dark:border-gray-700">
                            <div className="text-right hidden md:block">
                                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{user?.name || 'Loading...'}</p>
                                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">{user?.role || 'Member'}</p>
                            </div>
                            <Avatar url={user?.avatarUrl} name={user?.name} size="lg" />
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-gray-900">
                    {children}
                </div>
            </main>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="mb-6">
            <p className="px-4 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-3">{title}</p>
            <div className="space-y-1">{children}</div>
        </div>
    );
}

function NavItem({
    href,
    onClick,
    label,
    icon,
    active,
    badge
}: {
    href: string;
    onClick?: () => void;
    label: string;
    icon: React.ReactNode;
    active: boolean;
    badge?: string;
}) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group relative
            ${active
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm font-bold'
                : 'text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-md'
            }`}
        >
            <div className="flex items-center gap-3 hover-text-blue-600">
                <span className={`${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'} transition-colors`}>
                    {icon}
                </span>
                <span className={`text-sm ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>{label}</span>
            </div>
            {badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${active ? 'bg-red-600 text-gray-100' : 'bg-red-600/90 text-white'}`}>
                    {badge}
                </span>
            )}
        </Link>
    );
}

function Avatar({ url, name, size = 'md' }: { url?: string; name?: string; size?: 'md' | 'lg' }) {
    const dims = size === 'lg' ? 'w-10 h-10' : 'w-9 h-9';
    return (
        <div className={`${dims} rounded-full overflow-hidden ring-4 ring-gray-50 dark:ring-gray-700 flex items-center justify-center font-bold bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-100 dark:border-gray-600`}>
            {url ? (
                <img src={url} className="w-full h-full object-cover" alt={name || 'User'} />
            ) : (
                <span>{name?.charAt(0).toUpperCase()}</span>
            )}
        </div>
    );
}