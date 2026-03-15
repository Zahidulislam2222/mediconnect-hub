export const getInitials = (name: string) => {
    if (!name) return "PT";
    const cleanName = name.trim();
    const parts = cleanName.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return cleanName.substring(0, 2).toUpperCase();
};

// 🟢 FHIR HELPER: Safely extract the standardized time
export const getAptTime = (apt: any) => apt.resource?.start || apt.timeSlot;