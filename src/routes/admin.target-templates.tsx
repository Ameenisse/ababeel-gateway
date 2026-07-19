import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RoleShell } from "@/components/role-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { createTemplate, upsertTemplateItem, applyTemplateToStudents } from "@/lib/targets.functions";

export const Route = createFileRoute("/admin/target-templates")({
  ssr: false,
  head: () => ({ meta: [{ title: "Target Templates — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

const LEVELS = [
  { v: "baby", label: "Baby" },
  { v: "nursery", label: "Nursery" },
  { v: "lkg", label: "LKG" },
  { v: "ukg", label: "UKG" },
  { v: "ks1", label: "KS1" },
  { v: "ks2_3", label: "KS2-3" },
] as const;

type Template = { id: string; class_level: string; term_id: string; name: string };
type Item = { id: string; template_id: string; title_dv: string; title_en: string | null; star_group: string | null; sort_order: number; is_active: boolean };
type Term = { id: string; term_name: string; academic_year_id: string };

function Page() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLevel, setNewLevel] = useState<string>("baby");
  const [newTerm, setNewTerm] = useState<string>("");
  const [itemDv, setItemDv] = useState("");
  const [itemEn, setItemEn] = useState("");
  const [itemGroup, setItemGroup] = useState("");

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.from("academic_terms").select("id, term_name, academic_year_id").order("created_at");
      setTerms(t ?? []);
      await refresh();
    })();
  }, []);

  async function refresh() {
    const { data } = await supabase.from("target_templates").select("*").order("class_level");
    setTemplates((data ?? []) as Template[]);
  }
  async function loadItems(tpl: Template) {
    setSelected(tpl);
    const { data } = await supabase.from("target_template_items").select("*").eq("template_id", tpl.id).order("sort_order");
    setItems((data ?? []) as Item[]);
  }

  async function handleCreate() {
    if (!newName || !newTerm) { toast.error("Fill name and term"); return; }
    try {
      await createTemplate({ data: { class_level: newLevel as never, term_id: newTerm, name: newName } });
      toast.success("Template created");
      setNewOpen(false); setNewName(""); setNewTerm("");
      await refresh();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleAddItem() {
    if (!selected || !itemDv) return;
    try {
      await upsertTemplateItem({ data: {
        template_id: selected.id, title_dv: itemDv, title_en: itemEn || null,
        star_group: itemGroup || null, sort_order: items.length, is_active: true,
      }});
      setItemDv(""); setItemEn(""); setItemGroup("");
      await loadItems(selected);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function deleteItem(id: string) {
    await supabase.from("target_template_items").delete().eq("id", id);
    if (selected) await loadItems(selected);
  }
  async function apply() {
    if (!selected) return;
    try {
      const res = await applyTemplateToStudents({ data: { template_id: selected.id } });
      toast.success(`Assigned ${res.assigned} target rows`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <RoleShell role="admin" title="Target Templates">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Templates</CardTitle>
            <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {templates.map((t) => {
              const term = terms.find((x) => x.id === t.term_id);
              return (
                <button key={t.id} onClick={() => loadItems(t)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-accent ${selected?.id === t.id ? "border-primary bg-accent" : "border-border/60"}`}>
                  <div className="font-medium">{t.term_name}</div>
                  <div className="text-xs text-muted-foreground">{t.class_level.toUpperCase()} · {term?.term_name ?? "—"}</div>
                </button>
              );
            })}
            {templates.length === 0 && <div className="text-sm text-muted-foreground">No templates yet.</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{selected ? `Items — ${selected.name}` : "Select a template"}</CardTitle>
            {selected && <Button size="sm" variant="outline" onClick={apply}><Wand2 className="h-4 w-4 mr-1" />Assign to students</Button>}
          </CardHeader>
          <CardContent>
            {selected ? (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_140px_auto]">
                  <Input placeholder="Title (Dhivehi)" value={itemDv} onChange={(e) => setItemDv(e.target.value)} dir="rtl" />
                  <Input placeholder="Title (English, optional)" value={itemEn} onChange={(e) => setItemEn(e.target.value)} />
                  <Input placeholder="Group (e.g. Surahs)" value={itemGroup} onChange={(e) => setItemGroup(e.target.value)} />
                  <Button onClick={handleAddItem}><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="divide-y rounded-md border">
                  {items.map((it, idx) => (
                    <div key={it.id} className="flex items-center gap-3 p-2">
                      <span className="w-6 text-xs text-muted-foreground">{idx + 1}</span>
                      <div className="flex-1">
                        <div className="font-medium" dir="rtl">{it.title_dv}</div>
                        <div className="text-xs text-muted-foreground">{[it.title_en, it.star_group].filter(Boolean).join(" · ")}</div>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => deleteItem(it.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  {items.length === 0 && <div className="p-4 text-sm text-muted-foreground">No items yet.</div>}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Pick a template from the left, or create one.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
            <div>
              <Label>Class level</Label>
              <Select value={newLevel} onValueChange={setNewLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEVELS.map((l) => <SelectItem key={l.v} value={l.v}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Term</Label>
              <Select value={newTerm} onValueChange={setNewTerm}>
                <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                <SelectContent>{terms.map((t) => <SelectItem key={t.id} value={t.id}>{t.term_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleShell>
  );
}
