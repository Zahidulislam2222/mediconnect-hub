/**
 * DoctorEarnings — Shows doctor tier, earnings, and rate management
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, DollarSign, Star, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doctorSubscriptionApi, DoctorTierInfo, PayoutRecord } from '@/lib/subscription';

const TIER_LABELS: Record<string, { label: string; color: string }> = {
    new: { label: 'New', color: 'bg-muted text-muted-foreground' },
    established: { label: 'Established', color: 'bg-primary/10 text-primary' },
    top: { label: 'Top Doctor', color: 'bg-amber-100 text-amber-800' },
};

export function DoctorEarnings() {
    const { toast } = useToast();
    const [tierInfo, setTierInfo] = useState<DoctorTierInfo | null>(null);
    const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [newRate, setNewRate] = useState('');
    const [rateLoading, setRateLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [tier, earnings] = await Promise.all([
                doctorSubscriptionApi.getTier(),
                doctorSubscriptionApi.getEarnings(),
            ]);
            setTierInfo(tier);
            setPayouts(earnings.payouts);
            setSummary(earnings.summary);
            setNewRate(String(tier.consultationFee));
        } catch (err: any) {
            toast({ title: 'Failed to load earnings', description: err.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleRateUpdate = async () => {
        const rate = parseFloat(newRate);
        if (isNaN(rate) || rate <= 0) {
            toast({ title: 'Invalid rate', variant: 'destructive' });
            return;
        }

        setRateLoading(true);
        try {
            await doctorSubscriptionApi.updateRate(rate);
            toast({ title: 'Rate Updated', description: `Your consultation fee is now $${rate}` });
            await loadData();
        } catch (err: any) {
            toast({ title: 'Rate Update Failed', description: err.message, variant: 'destructive' });
        } finally {
            setRateLoading(false);
        }
    };

    if (loading) {
        return (
            <Card className="rounded-2xl">
                <CardContent className="p-6 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </CardContent>
            </Card>
        );
    }

    if (!tierInfo) return null;

    const tierStyle = TIER_LABELS[tierInfo.tier] || TIER_LABELS.new;

    return (
        <div className="space-y-4">
            {/* Tier & Rate Card */}
            <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                    <CardTitle className="font-display text-lg flex items-center gap-2">
                        <Star className="h-5 w-5 text-primary" />
                        Your Tier & Rate
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <Badge className={`${tierStyle.color} rounded-lg`}>{tierStyle.label}</Badge>
                            <p className="text-sm text-muted-foreground mt-1">
                                You keep {tierInfo.doctorPercentage}% of each visit
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-display font-bold">${tierInfo.consultationFee}</p>
                            <p className="text-xs text-muted-foreground">per visit</p>
                        </div>
                    </div>

                    {tierInfo.upgradeEligibleTo && (
                        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm">
                            <TrendingUp className="h-4 w-4 text-primary inline mr-1.5" />
                            You're eligible for <strong>{tierInfo.upgradeEligibleTo}</strong> tier upgrade!
                            Contact admin to apply.
                        </div>
                    )}

                    {/* Rate update */}
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <label className="text-xs text-muted-foreground mb-1 block">Update Rate</label>
                            <Input
                                type="number"
                                value={newRate}
                                onChange={(e) => setNewRate(e.target.value)}
                                className="rounded-xl"
                                min="1"
                                max="10000"
                            />
                        </div>
                        <Button
                            onClick={handleRateUpdate}
                            disabled={rateLoading || newRate === String(tierInfo.consultationFee)}
                            className="rounded-xl"
                            size="sm"
                        >
                            {rateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Max 10% increase per quarter. Rate changes require review.
                    </p>
                </CardContent>
            </Card>

            {/* Earnings Summary */}
            {summary && (
                <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="font-display text-lg flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-primary" />
                            Earnings Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-2xl font-display font-bold text-foreground">
                                    ${summary.totalEarnings?.toFixed(2)}
                                </p>
                                <p className="text-xs text-muted-foreground">Total Earnings</p>
                            </div>
                            <div>
                                <p className="text-2xl font-display font-bold text-foreground">
                                    {summary.totalVisits}
                                </p>
                                <p className="text-xs text-muted-foreground">Total Visits</p>
                            </div>
                            <div>
                                <p className="text-2xl font-display font-bold text-foreground">
                                    {summary.periodsCovered}
                                </p>
                                <p className="text-xs text-muted-foreground">Pay Periods</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Recent Payouts */}
            {payouts.length > 0 && (
                <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="font-display text-base">Recent Payouts</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {payouts.slice(0, 6).map((payout, i) => (
                            <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-muted/50 text-sm">
                                <div>
                                    <p className="font-medium">{payout.periodStart} - {payout.periodEnd}</p>
                                    <p className="text-xs text-muted-foreground">{payout.totalVisits} visits</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold">${payout.netPayout.toFixed(2)}</p>
                                    <Badge className={`text-xs rounded-lg ${
                                        payout.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                        payout.status === 'failed' ? 'bg-red-100 text-red-700' :
                                        'bg-amber-100 text-amber-700'
                                    }`}>
                                        {payout.status}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
