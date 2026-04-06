/**
 * DiscountBanner — Shows discount applied at booking time
 *
 * Display only — actual discount is server-side (loophole #2).
 * Shows original price, discounted price, and savings.
 */

import { Badge } from '@/components/ui/badge';
import { Tag } from 'lucide-react';
import { useSubscription } from '@/context/SubscriptionContext';

interface DiscountBannerProps {
    doctorFee: number;
    doctorSpecialty?: string;
}

const GP_SPECIALTIES = ['general_practice', 'family_medicine', 'internal_medicine', 'primary_care'];

export function DiscountBanner({ doctorFee, doctorSpecialty }: DiscountBannerProps) {
    const { isSubscribed, discountPercent, subscription } = useSubscription();

    if (!isSubscribed || discountPercent === 0) return null;

    const isGp = GP_SPECIALTIES.includes(doctorSpecialty?.toLowerCase() || '');
    const hasFreeGpVisit = subscription?.planId === 'premium' &&
        (subscription?.freeGpVisitsRemaining || 0) > 0 &&
        isGp;

    if (hasFreeGpVisit) {
        return (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <Tag className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <div className="text-sm">
                    <span className="font-medium text-emerald-700">Free GP Visit</span>
                    <span className="text-emerald-600 ml-1">
                        - Included with Premium ({subscription.freeGpVisitsRemaining} remaining this month)
                    </span>
                </div>
            </div>
        );
    }

    const discountedPrice = Math.round(doctorFee * (1 - discountPercent / 100) * 100) / 100;
    const savings = Math.round((doctorFee - discountedPrice) * 100) / 100;

    return (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <Tag className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="text-sm flex items-center gap-2 flex-wrap">
                <span className="line-through text-muted-foreground">${doctorFee.toFixed(2)}</span>
                <span className="font-semibold text-foreground">${discountedPrice.toFixed(2)}</span>
                <Badge className="bg-primary/10 text-primary rounded-lg text-xs">
                    {discountPercent}% off - Save ${savings.toFixed(2)}
                </Badge>
            </div>
        </div>
    );
}
