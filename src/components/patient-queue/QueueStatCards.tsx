import { Clock, CheckCircle2, History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
    stats: { waiting: number; completed: number; avgWait: string };
    onShowSummary: () => void;
}

export function QueueStatCards({ stats, onShowSummary }: Props) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-blue-600 text-white border-none shadow-md">
                <CardContent className="p-6 flex items-center justify-between">
                    <div>
                        <p className="text-blue-100 font-medium text-sm uppercase tracking-wider">Today's Queue</p>
                        <h3 className="text-3xl font-bold mt-1">{stats.waiting}</h3>
                    </div>
                    <Clock className="h-8 w-8 opacity-20" />
                </CardContent>
            </Card>

            <Card
                className="bg-emerald-600 text-white border-none shadow-md cursor-pointer hover:bg-emerald-700 transition-all active:scale-95"
                onClick={onShowSummary}
                title="Click to view details"
            >
                <CardContent className="p-6 flex items-center justify-between">
                    <div>
                        <p className="text-emerald-100 font-medium text-sm uppercase tracking-wider">Completed</p>
                        <h3 className="text-3xl font-bold mt-1">{stats.completed}</h3>
                    </div>
                    <CheckCircle2 className="h-8 w-8 opacity-20" />
                </CardContent>
            </Card>

            <Card className="bg-white text-foreground border-border shadow-sm">
                <CardContent className="p-6 flex items-center justify-between">
                    <div>
                        <p className="text-muted-foreground font-medium text-sm uppercase tracking-wider">Avg Wait</p>
                        <h3 className="text-3xl font-bold mt-1">{stats.avgWait}</h3>
                    </div>
                    <History className="h-8 w-8 text-muted-foreground opacity-20" />
                </CardContent>
            </Card>
        </div>
    );
}