import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { PlanDisplay } from '@/lib/subscription';

interface PlanCardProps {
    plan: PlanDisplay;
    currentPlanId?: string;
    onSelect: (planId: string) => void;
    isLoading?: boolean;
}

export function PlanCard({ plan, currentPlanId, onSelect, isLoading }: PlanCardProps) {
    const isCurrent = currentPlanId === plan.id;
    const isFree = plan.id === 'free';

    return (
        <Card className={`relative rounded-2xl transition-shadow hover:shadow-elevated ${
            plan.highlighted ? 'border-primary shadow-card ring-2 ring-primary/20' : 'border-border'
        } ${isCurrent ? 'bg-primary/5' : ''}`}>
            {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground rounded-xl px-3 py-1 font-display text-xs">
                        Most Popular
                    </Badge>
                </div>
            )}

            <CardHeader className="text-center pb-2 pt-6">
                <CardTitle className="font-display text-lg">{plan.name}</CardTitle>
                <div className="mt-2">
                    {isFree ? (
                        <span className="text-3xl font-display font-bold text-foreground">Free</span>
                    ) : (
                        <div className="flex items-baseline justify-center gap-1">
                            <span className="text-3xl font-display font-bold text-foreground">${plan.price}</span>
                            <span className="text-muted-foreground text-sm">/month</span>
                        </div>
                    )}
                </div>
                {plan.discountPercent > 0 && (
                    <p className="text-primary font-medium text-sm mt-1">
                        {plan.discountPercent}% off every visit
                    </p>
                )}
            </CardHeader>

            <CardContent className="pt-4 pb-6">
                <ul className="space-y-2.5 mb-6">
                    {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                        </li>
                    ))}
                </ul>

                {isCurrent ? (
                    <Button variant="outline" className="w-full rounded-xl" disabled>
                        Current Plan
                    </Button>
                ) : isFree ? (
                    <Button variant="outline" className="w-full rounded-xl" disabled>
                        Default
                    </Button>
                ) : (
                    <Button
                        className={`w-full rounded-xl ${plan.highlighted ? 'medical-gradient text-white' : ''}`}
                        variant={plan.highlighted ? 'default' : 'outline'}
                        onClick={() => onSelect(plan.id)}
                        disabled={isLoading}
                    >
                        {currentPlanId && currentPlanId !== 'free' ? 'Switch Plan' : 'Subscribe'}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
