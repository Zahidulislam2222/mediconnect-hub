import { Video, MapPin, Clock, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AppointmentCardProps {
  doctor: string;
  specialty: string;
  date: string;
  time: string;
  type: "Video Call" | "In-Person";
  avatar: string;
  status: "upcoming" | "scheduled" | "completed";
  onJoin?: () => void;
}

export function AppointmentCard({
  doctor,
  specialty,
  date,
  time,
  type,
  avatar,
  status,
  onJoin,
}: AppointmentCardProps) {
  const isVideo = type === "Video Call";
  const isUpcoming = status === "upcoming";

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border p-4 transition-all duration-200",
        isUpcoming
          ? "border-primary/30 bg-primary/5 shadow-soft"
          : "border-border bg-card hover:shadow-soft"
      )}
    >
      <Avatar className="h-12 w-12 border-2 border-primary/10">
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {avatar}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h4 className="font-semibold text-foreground truncate">{doctor}</h4>
          {isUpcoming && (
            <Badge className="bg-primary text-primary-foreground text-xs">
              Up Next
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{specialty}</p>
        <div className="flex items-center gap-3 mt-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {date} • {time}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {isVideo ? (
              <Video className="h-3.5 w-3.5 text-primary" />
            ) : (
              <MapPin className="h-3.5 w-3.5" />
            )}
            {type}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isUpcoming && isVideo && (
          <Button
            onClick={onJoin}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Video className="h-4 w-4 mr-2" />
            Join Call
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}
