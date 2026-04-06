/**
 * SubscriptionBadge — Shows current plan in headers/dashboards
 */

import { Badge } from '@/components/ui/badge';
import { Crown, Sparkles } from 'lucide-react';
import { useSubscription } from '@/context/SubscriptionContext';
import { useNavigate } from 'react-router-dom';

export function SubscriptionBadge() {
    const { isSubscribed, planName, subscription } = useSubscription();
    const navigate = useNavigate();

    if (!isSubscribed) {
        return (
            <Badge
                className="bg-muted text-muted-foreground rounded-lg text-xs cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => navigate('/subscription')}
            >
                <Sparkles className="h-3 w-3 mr-1" />
                Upgrade
            </Badge>
        );
    }

    const isPremium = subscription?.planId === 'premium';

    return (
        <Badge
            className={`rounded-lg text-xs cursor-pointer transition-colors ${
                isPremium
                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
            onClick={() => navigate('/subscription')}
        >
            <Crown className="h-3 w-3 mr-1" />
            {isPremium ? 'Premium' : 'Plus'}
        </Badge>
    );
}
