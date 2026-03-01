"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface University {
  id: string;
  institutionName: string;
  tier: string;
  disciplineNotes: string | null;
  versionTag: string;
}

interface Employer {
  id: string;
  employerFamily: string;
  tier: string;
  versionTag: string;
}

interface Division {
  id: string;
  employerFamily: string;
  category: string;
  keywords: string[];
  selectivityMultiplier: number;
  notes: string | null;
  versionTag: string;
}

export default function TaxonomiesPage() {
  const [activeTab, setActiveTab] = useState<"universities" | "employers" | "divisions">("universities");
  const [universities, setUniversities] = useState<University[]>([]);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUni, setEditingUni] = useState<Partial<University> | null>(null);
  const [editingEmp, setEditingEmp] = useState<Partial<Employer> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin?type=universities").then((r) => r.json()),
      fetch("/api/admin?type=employers").then((r) => r.json()),
      fetch("/api/admin?type=divisions").then((r) => r.json()),
    ]).then(([uniData, empData, divData]) => {
      setUniversities(uniData.universities || []);
      setEmployers(empData.employers || []);
      setDivisions(divData.divisions || []);
      setLoading(false);
    });
  }, []);

  const saveTaxonomy = async (type: string, data: any) => {
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data }),
    });
    // Refresh
    const res = await fetch(`/api/admin?type=${type === "university" ? "universities" : type === "employer" ? "employers" : "divisions"}`);
    const json = await res.json();
    if (type === "university") setUniversities(json.universities || []);
    if (type === "employer") setEmployers(json.employers || []);
  };

  const tabs = [
    { key: "universities" as const, label: "Universities", count: universities.length },
    { key: "employers" as const, label: "Employer Families", count: employers.length },
    { key: "divisions" as const, label: "Division Rules", count: divisions.length },
  ];

  const tierColors: Record<string, string> = {
    PRIORITY_1: "bg-violet-50 text-violet-700 border-violet-200",
    TIER_1: "bg-blue-50 text-blue-700 border-blue-200",
    TIER_2: "bg-sky-50 text-sky-700 border-sky-200",
    OTHER: "bg-gray-50 text-gray-600 border-gray-200",
    ELITE: "bg-amber-50 text-amber-700 border-amber-200",
    SELECTIVE: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[32px] font-semibold tracking-tight">Taxonomies</h1>
        <p className="text-[15px] text-muted-foreground mt-1">
          Manage university tiers, employer families, and division selectivity mappings
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/80 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "px-4 py-2 rounded-lg text-[13px] font-medium transition-smooth",
              activeTab === t.key
                ? "bg-white shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            <span className="ml-1.5 text-[11px] opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="apple-card p-12 text-center text-[13px] text-muted-foreground">Loading taxonomies...</div>
      ) : (
        <>
          {/* Universities */}
          {activeTab === "universities" && (
            <div className="apple-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold">University Tier List</h3>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    UK institutions ranked by selectivity
                  </p>
                </div>
                <button
                  onClick={() => setEditingUni({ tier: "OTHER" })}
                  className="text-[13px] font-medium text-primary hover:text-primary/80 transition-smooth"
                >
                  + Add University
                </button>
              </div>

              {editingUni && (
                <div className="px-6 py-4 bg-primary/[0.02] border-b border-border/30 flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Institution Name</label>
                    <input
                      type="text"
                      value={editingUni.institutionName || ""}
                      onChange={(e) => setEditingUni({ ...editingUni, institutionName: e.target.value })}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-border text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="University of..."
                    />
                  </div>
                  <div className="w-40">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tier</label>
                    <select
                      value={editingUni.tier || "OTHER"}
                      onChange={(e) => setEditingUni({ ...editingUni, tier: e.target.value })}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-border text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="PRIORITY_1">Priority Tier 1</option>
                      <option value="TIER_1">Tier 1</option>
                      <option value="TIER_2">Tier 2</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      if (editingUni.institutionName) {
                        saveTaxonomy("university", editingUni);
                        setEditingUni(null);
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-primary text-white text-[13px] font-medium hover:bg-primary/90 transition-smooth"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingUni(null)}
                    className="px-4 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground transition-smooth"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <div className="divide-y divide-border/30">
                {universities.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-6 py-3 hover:bg-secondary/30 transition-smooth">
                    <div>
                      <p className="text-[13px] font-medium">{u.institutionName}</p>
                      {u.disciplineNotes && (
                        <p className="text-[11px] text-muted-foreground">{u.disciplineNotes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[11px] font-medium px-2.5 py-0.5 rounded-full border",
                        tierColors[u.tier] || tierColors.OTHER
                      )}>
                        {u.tier.replace("_", " ")}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{u.versionTag}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Employers */}
          {activeTab === "employers" && (
            <div className="apple-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border/30">
                <h3 className="text-[15px] font-semibold">Employer Families</h3>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Employer brands and their selectivity tiers
                </p>
              </div>
              <div className="divide-y divide-border/30">
                {employers.map((e) => (
                  <div key={e.id} className="flex items-center justify-between px-6 py-3 hover:bg-secondary/30 transition-smooth">
                    <p className="text-[13px] font-medium">{e.employerFamily}</p>
                    <span className={cn(
                      "text-[11px] font-medium px-2.5 py-0.5 rounded-full border",
                      tierColors[e.tier] || tierColors.OTHER
                    )}>
                      {e.tier}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Divisions */}
          {activeTab === "divisions" && (
            <div className="apple-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border/30">
                <h3 className="text-[15px] font-semibold">Division / Role Selectivity</h3>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Division-level selectivity multipliers by employer family
                </p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30 bg-secondary/30">
                    <th className="text-left px-6 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Employer</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Category</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Keywords</th>
                    <th className="text-right px-6 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Multiplier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {divisions.map((d) => (
                    <tr key={d.id} className="hover:bg-secondary/30 transition-smooth">
                      <td className="px-6 py-3 text-[13px] font-medium">{d.employerFamily}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-[11px] font-medium px-2 py-0.5 rounded-full",
                          d.category === "STRATEGY" || d.category === "IB" || d.category === "DEALS"
                            ? "bg-emerald-50 text-emerald-700"
                            : d.category === "AUDIT" || d.category === "COMPLIANCE"
                            ? "bg-red-50 text-red-600"
                            : "bg-gray-100 text-gray-600"
                        )}>
                          {d.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">
                        {(d.keywords as string[]).join(", ")}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className={cn(
                          "text-[13px] font-mono font-medium",
                          d.selectivityMultiplier >= 0.8 ? "text-emerald-600" :
                          d.selectivityMultiplier >= 0.5 ? "text-amber-600" : "text-red-500"
                        )}>
                          {d.selectivityMultiplier.toFixed(1)}x
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
