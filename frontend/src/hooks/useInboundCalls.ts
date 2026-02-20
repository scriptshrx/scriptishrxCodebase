import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export function useInboundCalls(
    page = 1,
    limit = 10,
    search = '',
    options?: { poll?: boolean | number }
) {
    // allow callers to disable or customise polling interval
    const interval = options?.poll === undefined ? false : options.poll;

    return useQuery({
        queryKey: ['inboundCalls', page, limit, search],
        queryFn: async () => {
            const { data } = await api.get('/leads/inbound', {
                params: { page, limit, search }
            });
            return data;
        },
        placeholderData: (previousData) => previousData,
        // don't poll by default; caller can pass a number (ms) or `true` for 5s
        refetchInterval: interval === true ? 5000 : interval || false
    });
}

export async function deleteInboundCall(id: string) {
    const { data } = await api.delete(`/leads/inbound/${id}`);
    return data;
}

export async function convertInboundCallToLead(id: string, leadData: { name?: string; email?: string; notes?: string }) {
    const { data } = await api.post(`/leads/inbound/${id}/convert-to-lead`, leadData);
    return data;
}
