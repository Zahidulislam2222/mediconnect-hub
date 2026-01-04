import { Clock, Heart, Activity } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PatientQueueCardProps {
  name: string;
  age: number;
  condition: string;
  waitTime: string;
  priority: "high" | "medium" | "low";
  avatar: string;
  vitals: { hr: number; bp: string };
  onStartConsultation?: () => void;
}

const priorityStyles = {
  high: "bg-destructive/10 text-destructive border-destructive/30",
  medium: "bg-warning/10 text-warning border-warning/30",
  low: "bg-success/10 text-success border-success/30",
};

export function PatientQueueCard({
  name,
  age,
  condition,
  waitTime,
  priority,
  avatar,
  vitals,
  onStartConsultation,
}: PatientQueueCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-soft hover:shadow-card transition-all duration-200">
      <Avatar className="h-12 w-12 border-2 border-primary/10">
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {avatar}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h4 className="font-semibold text-foreground">{name}</h4>
          <span className="text-sm text-muted-foreground">({age}y)</span>
          <Badge variant="outline" className={cn("text-xs", priorityStyles[priority])}>
            {priority.charAt(0).toUpperCase() + priority.slice(1)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground truncate">{condition}</p>
        <div className="flex items-center gap-4 mt-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Waiting: {waitTime}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Heart className="h-3.5 w-3.5 text-destructive" />
            {vitals.hr} bpm
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-primary" />
            {vitals.bp}
          </span>
        </div>
      </div>

      <Button
        onClick={onStartConsultation}
        className="bg-primary hover:bg-primary/90 text-primary-foreground"
      >
        Start Session
      </Button>
    </div>
  );
}
