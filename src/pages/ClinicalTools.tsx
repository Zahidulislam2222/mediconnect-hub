import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import {
    Pill, Search, Shield, Activity, FileText, Stethoscope,
    AlertTriangle, CheckCircle2, XCircle, Loader2, ChevronRight,
    Beaker, Hash, Building2, ArrowRight, Zap, Database
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { clearAllSensitive } from "@/lib/secure-storage";

// ─── Severity Color Mapping ──────────────────────────────────────────────
const severityConfig = {
    critical: { bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-300", badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle },
    high: { bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300", badge: "bg-orange-100 text-orange-800", icon: AlertTriangle },
    moderate: { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", badge: "bg-amber-100 text-amber-800", icon: AlertTriangle },
    low: { bg: "bg-sky-50 dark:bg-sky-950/30", border: "border-sky-200 dark:border-sky-800", text: "text-sky-700 dark:text-sky-300", badge: "bg-sky-100 text-sky-800", icon: Activity },
};

export default function ClinicalTools() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("interactions");

    return (
        <DashboardLayout
            title="Clinical Tools"
            subtitle="Drug interactions, terminology, provider validation"
            userRole="doctor"
            userName="Doctor"
            onLogout={async () => { await signOut(); clearAllSensitive(); navigate("/auth"); }}
        >
            <div className="space-y-6 animate-fade-in pb-10">
                {/* Hero Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { icon: Pill, label: "RxNorm", desc: "Drug Interactions", color: "from-red-500 to-rose-600" },
                        { icon: Stethoscope, label: "SNOMED CT", desc: "Clinical Terms", color: "from-violet-500 to-purple-600" },
                        { icon: Shield, label: "NPI Registry", desc: "Provider Lookup", color: "from-emerald-500 to-teal-600" },
                        { icon: Beaker, label: "NDC Codes", desc: "Drug Reference", color: "from-blue-500 to-indigo-600" },
                    ].map((item, i) => (
                        <Card key={i} className="group relative overflow-hidden border-0 shadow-card hover:shadow-elevated transition-all duration-300 cursor-pointer"
                            onClick={() => setActiveTab(["interactions", "snomed", "npi", "ndc"][i])}>
                            <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-[0.03] group-hover:opacity-[0.07] transition-opacity`} />
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-sm`}>
                                    <item.icon className="h-5 w-5 text-white" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-display font-semibold text-sm text-foreground">{item.label}</p>
                                    <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Main Tool Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <TabsList className="bg-card border border-border p-1 h-auto flex-wrap gap-1">
                        <TabsTrigger value="interactions" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Pill className="h-3.5 w-3.5" /> Drug Interactions
                        </TabsTrigger>
                        <TabsTrigger value="snomed" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Stethoscope className="h-3.5 w-3.5" /> SNOMED CT
                        </TabsTrigger>
                        <TabsTrigger value="npi" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Shield className="h-3.5 w-3.5" /> NPI Validation
                        </TabsTrigger>
                        <TabsTrigger value="ndc" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Beaker className="h-3.5 w-3.5" /> NDC Lookup
                        </TabsTrigger>
                    </TabsList>

                    {/* ─── TAB 1: Drug Interactions ─── */}
                    <TabsContent value="interactions"><InteractionChecker /></TabsContent>

                    {/* ─── TAB 2: SNOMED CT ─── */}
                    <TabsContent value="snomed"><SNOMEDSearch /></TabsContent>

                    {/* ─── TAB 3: NPI ─── */}
                    <TabsContent value="npi"><NPIValidator /></TabsContent>

                    {/* ─── TAB 4: NDC ─── */}
                    <TabsContent value="ndc"><NDCLookup /></TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// DRUG INTERACTION CHECKER
// ═══════════════════════════════════════════════════════════════════════════

function InteractionChecker() {
    const [drugSearch, setDrugSearch] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedDrugs, setSelectedDrugs] = useState<any[]>([]);
    const [interactions, setInteractions] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const { toast } = useToast();

    const searchDrugs = useCallback(async () => {
        if (drugSearch.length < 2) return;
        setIsSearching(true);
        try {
            const data: any = await api.get(`/drugs/rxnorm/search?name=${encodeURIComponent(drugSearch)}`);
            setSearchResults(data.drugs || []);
        } catch {
            toast({ variant: "destructive", title: "Search failed", description: "RxNorm API unavailable" });
        } finally {
            setIsSearching(false);
        }
    }, [drugSearch]);

    const addDrug = (drug: any) => {
        if (selectedDrugs.find(d => d.rxcui === drug.rxcui)) return;
        setSelectedDrugs([...selectedDrugs, drug]);
        setSearchResults([]);
        setDrugSearch("");
        setInteractions(null);
    };

    const removeDrug = (rxcui: string) => {
        setSelectedDrugs(selectedDrugs.filter(d => d.rxcui !== rxcui));
        setInteractions(null);
    };

    const checkInteractions = async () => {
        if (selectedDrugs.length < 1) return;
        setIsChecking(true);
        try {
            const data: any = await api.post("/prescriptions/check-interactions", {
                medications: selectedDrugs.map(d => ({ rxcui: d.rxcui, name: d.name }))
            });
            setInteractions(data);
        } catch {
            toast({ variant: "destructive", title: "Check failed" });
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card className="border-border/60 shadow-card">
                <CardHeader className="pb-3">
                    <CardTitle className="font-display text-lg flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center">
                            <Pill className="h-4 w-4 text-white" />
                        </div>
                        Drug Interaction Checker
                    </CardTitle>
                    <CardDescription>Search and add medications, then check for pairwise interactions via NLM RxNorm API</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Drug Search */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search drug name (e.g. aspirin, metformin)..."
                                className="pl-9"
                                value={drugSearch}
                                onChange={e => setDrugSearch(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && searchDrugs()}
                            />
                        </div>
                        <Button onClick={searchDrugs} disabled={isSearching || drugSearch.length < 2} variant="secondary">
                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                        </Button>
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                        <div className="border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-border">
                            {searchResults.slice(0, 8).map((drug: any) => (
                                <button
                                    key={drug.rxcui}
                                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                                    onClick={() => addDrug(drug)}
                                >
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{drug.name}</p>
                                        <p className="text-xs text-muted-foreground">RxCUI: {drug.rxcui} &middot; {drug.tty || "Drug"}</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Selected Drugs */}
                    {selectedDrugs.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Selected Medications ({selectedDrugs.length})</p>
                            <div className="flex flex-wrap gap-2">
                                {selectedDrugs.map(drug => (
                                    <Badge key={drug.rxcui} variant="secondary" className="py-1.5 px-3 gap-1.5 text-sm">
                                        <Pill className="h-3 w-3" />
                                        {drug.name}
                                        <button onClick={() => removeDrug(drug.rxcui)} className="ml-1 hover:text-destructive">
                                            <XCircle className="h-3.5 w-3.5" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Check Button */}
                    <Button
                        onClick={checkInteractions}
                        disabled={selectedDrugs.length < 1 || isChecking}
                        className="w-full bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-md"
                    >
                        {isChecking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                        Check Interactions ({selectedDrugs.length} drug{selectedDrugs.length !== 1 ? "s" : ""})
                    </Button>
                </CardContent>
            </Card>

            {/* Results */}
            {interactions && (
                <Card className={`border-2 shadow-elevated ${interactions.blocked ? "border-red-300 dark:border-red-700" : interactions.hasHigh ? "border-orange-300 dark:border-orange-700" : "border-emerald-300 dark:border-emerald-700"}`}>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="font-display text-lg flex items-center gap-2">
                                {interactions.blocked ? (
                                    <><XCircle className="h-5 w-5 text-red-500" /> Critical Interactions Found</>
                                ) : interactions.hasHigh ? (
                                    <><AlertTriangle className="h-5 w-5 text-orange-500" /> Interactions Found</>
                                ) : (
                                    <><CheckCircle2 className="h-5 w-5 text-emerald-500" /> No Significant Interactions</>
                                )}
                            </CardTitle>
                            {interactions.blocked && (
                                <Badge className="bg-red-100 text-red-800 border-red-200 animate-pulse">BLOCKED</Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {/* Summary Chips */}
                        <div className="flex flex-wrap gap-2">
                            {interactions.summary?.critical > 0 && <Badge className="bg-red-100 text-red-800">{interactions.summary.critical} Critical</Badge>}
                            {interactions.summary?.high > 0 && <Badge className="bg-orange-100 text-orange-800">{interactions.summary.high} High</Badge>}
                            {interactions.summary?.moderate > 0 && <Badge className="bg-amber-100 text-amber-800">{interactions.summary.moderate} Moderate</Badge>}
                            {interactions.summary?.low > 0 && <Badge className="bg-sky-100 text-sky-800">{interactions.summary.low} Low</Badge>}
                        </div>

                        {/* Interaction List */}
                        {(interactions.interactions || []).slice(0, 10).map((ix: any, i: number) => {
                            const sev = severityConfig[ix.severity as keyof typeof severityConfig] || severityConfig.low;
                            const Icon = sev.icon;
                            return (
                                <div key={i} className={`rounded-xl border ${sev.border} ${sev.bg} p-4 space-y-1`}>
                                    <div className="flex items-start gap-2">
                                        <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${sev.text}`} />
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <Badge className={`text-[10px] ${sev.badge}`}>{ix.severity?.toUpperCase()}</Badge>
                                                <span className="text-xs text-muted-foreground">{ix.source}</span>
                                            </div>
                                            <p className="text-sm mt-1 text-foreground leading-relaxed">{ix.description}</p>
                                            {ix.drugs?.length > 0 && (
                                                <div className="flex gap-1.5 mt-2">
                                                    {ix.drugs.map((d: any, j: number) => (
                                                        <Badge key={j} variant="outline" className="text-[10px]">{d.name}</Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// SNOMED CT SEARCH
// ═══════════════════════════════════════════════════════════════════════════

function SNOMEDSearch() {
    const [term, setTerm] = useState("");
    const [semantic, setSemantic] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [selectedConcept, setSelectedConcept] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);
    const { toast } = useToast();

    const search = async () => {
        if (term.length < 2) return;
        setIsSearching(true);
        try {
            const params = `term=${encodeURIComponent(term)}${semantic ? `&semantic=${encodeURIComponent(semantic)}` : ""}&limit=20`;
            const data: any = await api.get(`/terminology/snomed/search?${params}`);
            setResults(data.concepts || []);
        } catch {
            toast({ variant: "destructive", title: "SNOMED search failed" });
        } finally {
            setIsSearching(false);
        }
    };

    const viewConcept = async (conceptId: string) => {
        try {
            const data: any = await api.get(`/terminology/snomed/${conceptId}`);
            setSelectedConcept(data);
        } catch {
            toast({ variant: "destructive", title: "Failed to load concept" });
        }
    };

    const semanticTags = ["disorder", "finding", "procedure", "body structure", "substance", "observable entity", "situation"];

    return (
        <div className="space-y-4">
            <Card className="border-border/60 shadow-card">
                <CardHeader className="pb-3">
                    <CardTitle className="font-display text-lg flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <Stethoscope className="h-4 w-4 text-white" />
                        </div>
                        SNOMED CT Clinical Terminology
                    </CardTitle>
                    <CardDescription>Search 360,000+ clinical concepts from the SNOMED CT International Edition</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search clinical terms (e.g. diabetes mellitus, hypertension)..."
                                className="pl-9"
                                value={term}
                                onChange={e => setTerm(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && search()}
                            />
                        </div>
                        <Button onClick={search} disabled={isSearching || term.length < 2} variant="secondary">
                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                        </Button>
                    </div>

                    {/* Semantic Filters */}
                    <div className="flex flex-wrap gap-1.5">
                        <Badge
                            variant={semantic === "" ? "default" : "outline"}
                            className="cursor-pointer text-xs"
                            onClick={() => setSemantic("")}
                        >All</Badge>
                        {semanticTags.map(tag => (
                            <Badge
                                key={tag}
                                variant={semantic === tag ? "default" : "outline"}
                                className="cursor-pointer text-xs capitalize"
                                onClick={() => setSemantic(tag)}
                            >{tag}</Badge>
                        ))}
                    </div>

                    {/* Results */}
                    {results.length > 0 && (
                        <div className="border border-border rounded-xl overflow-hidden max-h-[400px] overflow-y-auto divide-y divide-border">
                            {results.map((concept: any) => (
                                <button
                                    key={concept.conceptId}
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left group"
                                    onClick={() => viewConcept(concept.conceptId)}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{concept.term}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-muted-foreground font-mono">{concept.conceptId}</span>
                                            {concept.semanticTag && (
                                                <Badge variant="outline" className="text-[10px] capitalize">{concept.semanticTag}</Badge>
                                            )}
                                        </div>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
                                </button>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Concept Detail */}
            {selectedConcept && (
                <Card className="border-violet-200 dark:border-violet-800 shadow-elevated">
                    <CardHeader className="pb-3">
                        <CardTitle className="font-display text-lg">{selectedConcept.term}</CardTitle>
                        <CardDescription className="font-mono text-xs">
                            SCTID: {selectedConcept.conceptId} &middot; {selectedConcept.semanticTag}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="p-3 bg-muted/50 rounded-lg">
                                <p className="text-xs text-muted-foreground mb-1">FSN</p>
                                <p className="font-medium">{selectedConcept.fsn}</p>
                            </div>
                            <div className="p-3 bg-muted/50 rounded-lg">
                                <p className="text-xs text-muted-foreground mb-1">Status</p>
                                <Badge variant={selectedConcept.active ? "default" : "destructive"}>
                                    {selectedConcept.active ? "Active" : "Inactive"}
                                </Badge>
                            </div>
                        </div>
                        {/* FHIR Coding */}
                        <div className="p-3 bg-muted/30 rounded-lg border border-border">
                            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Database className="h-3 w-3" /> FHIR Coding</p>
                            <pre className="text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
{JSON.stringify(selectedConcept.coding, null, 2)}
                            </pre>
                        </div>
                        {/* Children */}
                        {selectedConcept.children?.length > 0 && (
                            <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">Child Concepts ({selectedConcept.children.length})</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {selectedConcept.children.slice(0, 12).map((child: any) => (
                                        <Badge
                                            key={child.conceptId}
                                            variant="outline"
                                            className="text-xs cursor-pointer hover:bg-muted"
                                            onClick={() => viewConcept(child.conceptId)}
                                        >{child.term}</Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// NPI VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

function NPIValidator() {
    const [npi, setNpi] = useState("");
    const [lookupName, setLookupName] = useState("");
    const [lookupState, setLookupState] = useState("");
    const [result, setResult] = useState<any>(null);
    const [lookupResults, setLookupResults] = useState<any[]>([]);
    const [isValidating, setIsValidating] = useState(false);
    const [isLooking, setIsLooking] = useState(false);
    const [mode, setMode] = useState<"validate" | "lookup">("validate");
    const { toast } = useToast();

    const validateNPI = async () => {
        if (!npi || npi.length !== 10) {
            toast({ variant: "destructive", title: "Invalid format", description: "NPI must be exactly 10 digits" });
            return;
        }
        setIsValidating(true);
        setResult(null);
        try {
            const data: any = await api.get(`/doctors/npi/validate/${npi}`);
            setResult(data);
        } catch {
            toast({ variant: "destructive", title: "Validation failed" });
        } finally {
            setIsValidating(false);
        }
    };

    const lookupNPI = async () => {
        if (!lookupName) return;
        setIsLooking(true);
        setLookupResults([]);
        try {
            const params = `name=${encodeURIComponent(lookupName)}${lookupState ? `&state=${lookupState}` : ""}`;
            const data: any = await api.get(`/doctors/npi/lookup?${params}`);
            setLookupResults(data.providers || []);
        } catch {
            toast({ variant: "destructive", title: "Lookup failed" });
        } finally {
            setIsLooking(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card className="border-border/60 shadow-card">
                <CardHeader className="pb-3">
                    <CardTitle className="font-display text-lg flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                            <Shield className="h-4 w-4 text-white" />
                        </div>
                        NPI Registry (NPPES)
                    </CardTitle>
                    <CardDescription>Validate National Provider Identifiers or search the NPPES registry by name</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Mode Toggle */}
                    <div className="flex gap-2">
                        <Button size="sm" variant={mode === "validate" ? "default" : "outline"} onClick={() => setMode("validate")}>
                            <Hash className="h-3.5 w-3.5 mr-1" /> Validate NPI
                        </Button>
                        <Button size="sm" variant={mode === "lookup" ? "default" : "outline"} onClick={() => setMode("lookup")}>
                            <Search className="h-3.5 w-3.5 mr-1" /> Provider Lookup
                        </Button>
                    </div>

                    {mode === "validate" ? (
                        <div className="flex gap-2">
                            <Input
                                placeholder="Enter 10-digit NPI number..."
                                value={npi}
                                onChange={e => setNpi(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                onKeyDown={e => e.key === "Enter" && validateNPI()}
                                maxLength={10}
                                className="font-mono text-lg tracking-widest"
                            />
                            <Button onClick={validateNPI} disabled={isValidating || npi.length !== 10}>
                                {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validate"}
                            </Button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <Input placeholder="Provider name..." value={lookupName} onChange={e => setLookupName(e.target.value)} className="flex-1"
                                onKeyDown={e => e.key === "Enter" && lookupNPI()} />
                            <Input placeholder="State" value={lookupState} onChange={e => setLookupState(e.target.value.toUpperCase())} className="w-20" maxLength={2} />
                            <Button onClick={lookupNPI} disabled={isLooking || !lookupName}>
                                {isLooking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Validation Result */}
            {result && (
                <Card className={`border-2 shadow-elevated ${result.valid ? "border-emerald-300 dark:border-emerald-700" : "border-red-300 dark:border-red-700"}`}>
                    <CardContent className="p-5">
                        <div className="flex items-center gap-3 mb-4">
                            {result.valid ? (
                                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                            ) : (
                                <XCircle className="h-8 w-8 text-red-500" />
                            )}
                            <div>
                                <h3 className="font-display font-bold text-lg">{result.valid ? "Valid NPI" : "Invalid NPI"}</h3>
                                <p className="text-sm text-muted-foreground font-mono">{result.npi}</p>
                            </div>
                        </div>
                        {result.provider && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="p-3 bg-muted/50 rounded-lg">
                                    <p className="text-xs text-muted-foreground">Provider Name</p>
                                    <p className="font-semibold mt-0.5">{result.provider.name}</p>
                                </div>
                                <div className="p-3 bg-muted/50 rounded-lg">
                                    <p className="text-xs text-muted-foreground">Type</p>
                                    <p className="font-semibold mt-0.5">{result.provider.enumeration_type}</p>
                                </div>
                                <div className="p-3 bg-muted/50 rounded-lg">
                                    <p className="text-xs text-muted-foreground">Credential</p>
                                    <p className="font-semibold mt-0.5">{result.provider.credential || "N/A"}</p>
                                </div>
                                <div className="p-3 bg-muted/50 rounded-lg">
                                    <p className="text-xs text-muted-foreground">Location</p>
                                    <p className="font-semibold mt-0.5">
                                        {result.provider.address?.city}, {result.provider.address?.state} {result.provider.address?.postalCode}
                                    </p>
                                </div>
                                {result.provider.taxonomies?.length > 0 && (
                                    <div className="p-3 bg-muted/50 rounded-lg md:col-span-2">
                                        <p className="text-xs text-muted-foreground mb-1.5">Specialties</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {result.provider.taxonomies.map((t: any, i: number) => (
                                                <Badge key={i} variant={t.primary ? "default" : "outline"} className="text-xs">{t.description}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {!result.valid && result.reason && (
                            <p className="text-sm text-red-600 dark:text-red-400 mt-2">{result.reason}</p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Lookup Results */}
            {lookupResults.length > 0 && (
                <Card className="border-border/60 shadow-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{lookupResults.length} Providers Found</CardTitle>
                    </CardHeader>
                    <CardContent className="divide-y divide-border -mt-2">
                        {lookupResults.slice(0, 10).map((p: any, i: number) => (
                            <div key={i} className="py-3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">{p.name}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                        <span className="font-mono">NPI: {p.npi}</span>
                                        <span>&middot;</span>
                                        <span>{p.address?.city}, {p.address?.state}</span>
                                    </div>
                                    {p.taxonomies?.[0] && (
                                        <Badge variant="outline" className="text-[10px] mt-1">{p.taxonomies[0].description}</Badge>
                                    )}
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => { setNpi(p.npi); setMode("validate"); validateNPI(); }}
                                >
                                    <Shield className="h-3.5 w-3.5 mr-1" /> Validate
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// NDC DRUG LOOKUP
// ═══════════════════════════════════════════════════════════════════════════

function NDCLookup() {
    const [ndcCode, setNdcCode] = useState("");
    const [searchName, setSearchName] = useState("");
    const [result, setResult] = useState<any>(null);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<"code" | "name">("name");
    const { toast } = useToast();

    const lookupNDC = async () => {
        if (!ndcCode) return;
        setIsLoading(true);
        setResult(null);
        try {
            const data: any = await api.get(`/drugs/ndc/lookup/${encodeURIComponent(ndcCode)}`);
            setResult(data);
        } catch {
            toast({ variant: "destructive", title: "NDC not found" });
        } finally {
            setIsLoading(false);
        }
    };

    const searchNDC = async () => {
        if (searchName.length < 2) return;
        setIsLoading(true);
        setSearchResults([]);
        try {
            const data: any = await api.get(`/drugs/ndc/search?name=${encodeURIComponent(searchName)}&limit=15`);
            setSearchResults(data.drugs || []);
        } catch {
            toast({ variant: "destructive", title: "Search failed" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card className="border-border/60 shadow-card">
                <CardHeader className="pb-3">
                    <CardTitle className="font-display text-lg flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <Beaker className="h-4 w-4 text-white" />
                        </div>
                        NDC Drug Database (openFDA)
                    </CardTitle>
                    <CardDescription>Look up National Drug Codes for drug identification and cross-reference with RxNorm</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Button size="sm" variant={mode === "name" ? "default" : "outline"} onClick={() => setMode("name")}>
                            <Search className="h-3.5 w-3.5 mr-1" /> By Name
                        </Button>
                        <Button size="sm" variant={mode === "code" ? "default" : "outline"} onClick={() => setMode("code")}>
                            <Hash className="h-3.5 w-3.5 mr-1" /> By NDC Code
                        </Button>
                    </div>

                    {mode === "name" ? (
                        <div className="flex gap-2">
                            <Input placeholder="Drug name (e.g. lisinopril)..." value={searchName} onChange={e => setSearchName(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && searchNDC()} className="flex-1" />
                            <Button onClick={searchNDC} disabled={isLoading || searchName.length < 2}>
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                            </Button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <Input placeholder="NDC code (e.g. 0069-0150-01)..." value={ndcCode} onChange={e => setNdcCode(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && lookupNDC()} className="flex-1 font-mono" />
                            <Button onClick={lookupNDC} disabled={isLoading || !ndcCode}>
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lookup"}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Search Results */}
            {searchResults.length > 0 && (
                <Card className="border-border/60 shadow-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{searchResults.length} Drugs Found</CardTitle>
                    </CardHeader>
                    <CardContent className="divide-y divide-border -mt-2">
                        {searchResults.map((drug: any, i: number) => (
                            <div key={i} className="py-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm font-medium">{drug.brandName || drug.genericName}</p>
                                        {drug.brandName && drug.genericName && (
                                            <p className="text-xs text-muted-foreground">{drug.genericName}</p>
                                        )}
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <Badge variant="outline" className="text-[10px] font-mono">NDC: {drug.ndc}</Badge>
                                            {drug.dosageForm && <Badge variant="outline" className="text-[10px]">{drug.dosageForm}</Badge>}
                                            {drug.deaSchedule && <Badge className="text-[10px] bg-orange-100 text-orange-800">DEA: {drug.deaSchedule}</Badge>}
                                        </div>
                                    </div>
                                    <Button size="sm" variant="ghost" onClick={() => { setNdcCode(drug.ndc); setMode("code"); lookupNDC(); }}>
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Detail Result */}
            {result && (
                <Card className="border-blue-200 dark:border-blue-800 shadow-elevated">
                    <CardHeader className="pb-3">
                        <CardTitle className="font-display text-lg">{result.brandName || result.genericName}</CardTitle>
                        <CardDescription className="font-mono text-xs">NDC: {result.ndc} {result.rxcui ? `| RxCUI: ${result.rxcui}` : ""}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                            {[
                                { label: "Generic Name", value: result.genericName },
                                { label: "Brand Name", value: result.brandName },
                                { label: "Manufacturer", value: result.manufacturer },
                                { label: "Dosage Form", value: result.dosageForm },
                                { label: "Route", value: result.route?.join(", ") },
                                { label: "Product Type", value: result.productType },
                                { label: "DEA Schedule", value: result.deaSchedule || "Not Scheduled" },
                                { label: "Marketing", value: result.marketingCategory },
                            ].filter(x => x.value).map((item, i) => (
                                <div key={i} className="p-2.5 bg-muted/50 rounded-lg">
                                    <p className="text-xs text-muted-foreground">{item.label}</p>
                                    <p className="font-medium mt-0.5 text-sm">{item.value}</p>
                                </div>
                            ))}
                        </div>
                        {result.activeIngredients?.length > 0 && (
                            <div className="p-3 bg-muted/30 rounded-lg border border-border">
                                <p className="text-xs font-medium text-muted-foreground mb-2">Active Ingredients</p>
                                <div className="space-y-1">
                                    {result.activeIngredients.map((ing: any, i: number) => (
                                        <div key={i} className="flex justify-between text-sm">
                                            <span>{ing.name}</span>
                                            <span className="font-mono text-muted-foreground">{ing.strength}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
