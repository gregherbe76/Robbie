import React from "react";
import { useListSkills } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Cpu, ArrowRight } from "lucide-react";

export function Skills() {
  const { data: skills, isLoading } = useListSkills();

  if (isLoading) {
    return <div className="text-muted-foreground font-mono text-sm animate-pulse">Loading skill graph...</div>;
  }

  // Group by category
  const byCategory = skills?.reduce((acc, skill) => {
    const cat = skill.category || "uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(skill);
    return acc;
  }, {} as Record<string, typeof skills>) || {};

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Skills</h1>
          <p className="text-sm text-muted-foreground">Modular tools executable by agents.</p>
        </div>
        <div className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded">
          {skills?.length || 0} REGISTERED
        </div>
      </div>

      {Object.keys(byCategory).length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-lg">
          <Cpu className="size-8 text-muted-foreground mb-4 opacity-50" />
          <p className="text-muted-foreground text-sm">No skills found.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(byCategory).map(([category, catSkills]) => (
            <div key={category} className="space-y-4">
              <h2 className="text-sm font-mono text-primary uppercase tracking-widest">{category}</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {catSkills.map((skill) => (
                  <Card key={skill.id} className="bg-card/30 border-border/50">
                    <CardContent className="p-5 flex flex-col gap-3">
                      <div>
                        <h3 className="font-medium">{skill.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{skill.description}</p>
                      </div>
                      
                      <div className="mt-2 bg-background/50 rounded p-3 border border-border/50 flex flex-col gap-2">
                        <div className="flex items-center gap-4 text-xs font-mono">
                          <div className="flex-1">
                            <span className="text-muted-foreground">In: </span>
                            <span className="text-blue-400">{skill.inputs.join(', ') || 'void'}</span>
                          </div>
                          <ArrowRight className="size-3 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 text-right">
                            <span className="text-muted-foreground">Out: </span>
                            <span className="text-emerald-400">{skill.outputs.join(', ') || 'void'}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
