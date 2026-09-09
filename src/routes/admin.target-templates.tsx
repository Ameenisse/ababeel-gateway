import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { RoleShell } from "@/components/role-shell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Copy,
  Layers,
  Sparkles,
  BookOpen,
  FolderPlus,
  UserCheck,
} from "lucide-react";
import {
  createTemplate,
  duplicateTemplate,
  upsertSection,
  deleteSection,
  upsertTemplateItem,
  deleteTemplateItem,
  applyTemplateToStudents,
} from "@/lib/targets.functions";

export const Route = createFileRoute("/admin/target-templates")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Target Templates & Sections — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
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

type Template = {
  id: string;
  class_level: string;
  term_id: string;
  name: string;
  template_name?: string;
  class_id?: string | null;
  academic_year_id?: string | null;
  description?: string | null;
  version_number?: number;
};

type Section = {
  id: string;
  target_template_id: string;
  section_name: string;
  section_name_dhivehi: string | null;
  display_order: number;
};

type Item = {
  id: string;
  template_id: string;
  section_id: string | null;
  title_dv: string;
  title_en: string | null;
  target_title?: string | null;
  target_title_dhivehi?: string | null;
  arabic_text: string | null;
  description: string | null;
  instructions: string | null;
  star_group: string | null;
  is_required: boolean;
  default_points: number;
  sort_order: number;
  is_active: boolean;
};

type Term = { id: string; term_name: string; academic_year_id?: string };
type ClassItem = { id: string; class_name: string; class_level: string };

function Page() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // Create Template modal
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLevel, setNewLevel] = useState<string>("baby");
  const [newTerm, setNewTerm] = useState<string>("");
  const [newClassId, setNewClassId] = useState<string>("all");
  const [newDesc, setNewDesc] = useState("");

  // Duplicate Template modal
  const [dupOpen, setDupOpen] = useState(false);
  const [dupName, setDupName] = useState("");
  const [dupTermId, setDupTermId] = useState("");

  // Section Modal
  const [sectionOpen, setSectionOpen] = useState(false);
  const [secName, setSecName] = useState("");
  const [secNameDv, setSecNameDv] = useState("");

  // Target Item Modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [itemSectionId, setItemSectionId] = useState<string>("");
  const [itemDv, setItemDv] = useState("");
  const [itemEn, setItemEn] = useState("");
  const [itemArabic, setItemArabic] = useState("");
  const [itemInstructions, setItemInstructions] = useState("");
  const [itemRequired, setItemRequired] = useState(true);

  // Assign Modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTargetClass, setAssignTargetClass] = useState<string>("all");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: c }] = await Promise.all([
        supabase
          .from("academic_terms")
          .select("id, term_name, academic_year_id")
          .order("created_at"),
        supabase.from("classes").select("id, class_name, class_level").order("class_name"),
      ]);
      setTerms(t ?? []);
      setClasses((c ?? []) as ClassItem[]);
      await refreshTemplates();
    })();
  }, []);

  async function refreshTemplates() {
    const { data } = await supabase.from("target_templates").select("*").order("class_level");
    setTemplates((data ?? []) as Template[]);
  }

  const loadTemplateDetails = useCallback(async (tpl: Template) => {
    setSelected(tpl);
    const [{ data: secData }, { data: itmData }] = await Promise.all([
      supabase
        .from("target_template_sections")
        .select("*")
        .eq("target_template_id", tpl.id)
        .order("display_order"),
      supabase
        .from("target_template_items")
        .select("*")
        .eq("template_id", tpl.id)
        .order("sort_order"),
    ]);
    setSections((secData ?? []) as Section[]);
    setItems((itmData ?? []) as Item[]);
  }, []);

  async function handleCreateTemplate() {
    if (!newName || !newTerm) {
      toast.error("Template name and term are required");
      return;
    }
    try {
      const created = await createTemplate({
        data: {
          class_level: newLevel,
          term_id: newTerm,
          name: newName,
          class_id: newClassId !== "all" ? newClassId : null,
          description: newDesc || null,
        },
      });
      toast.success("Target template created");
      setNewOpen(false);
      setNewName("");
      setNewDesc("");
      await refreshTemplates();
      if (created) await loadTemplateDetails(created as Template);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create");
    }
  }

  async function handleDuplicateTemplate() {
    if (!selected || !dupName) return;
    try {
      const res = await duplicateTemplate({
        data: {
          template_id: selected.id,
          new_name: dupName,
          target_term_id: dupTermId || null,
        },
      });
      toast.success("Template duplicated successfully!");
      setDupOpen(false);
      setDupName("");
      await refreshTemplates();
      const { data: newTpl } = await supabase
        .from("target_templates")
        .select("*")
        .eq("id", res.id)
        .single();
      if (newTpl) loadTemplateDetails(newTpl as Template);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to duplicate");
    }
  }

  async function handleSaveSection() {
    if (!selected || !secName.trim()) {
      toast.error("Section name is required");
      return;
    }
    try {
      await upsertSection({
        data: {
          target_template_id: selected.id,
          section_name: secName.trim(),
          section_name_dhivehi: secNameDv.trim() || null,
          display_order: sections.length,
        },
      });
      toast.success("Section added");
      setSectionOpen(false);
      setSecName("");
      setSecNameDv("");
      await loadTemplateDetails(selected);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add section");
    }
  }

  async function handleDeleteSection(secId: string) {
    if (!selected) return;
    if (
      !confirm("Are you sure you want to delete this section? Items in it will become unassigned.")
    )
      return;
    try {
      await deleteSection({ data: { id: secId } });
      toast.success("Section deleted");
      await loadTemplateDetails(selected);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete section");
    }
  }

  function openAddItemModal(sectionId?: string) {
    setEditItemId(null);
    setItemSectionId(sectionId || "");
    setItemDv("");
    setItemEn("");
    setItemArabic("");
    setItemInstructions("");
    setItemRequired(true);
    setItemModalOpen(true);
  }

  function openEditItemModal(it: Item) {
    setEditItemId(it.id);
    setItemSectionId(it.section_id || "");
    setItemDv(it.target_title_dhivehi || it.title_dv || "");
    setItemEn(it.target_title || it.title_en || "");
    setItemArabic(it.arabic_text || "");
    setItemInstructions(it.instructions || "");
    setItemRequired(it.is_required ?? true);
    setItemModalOpen(true);
  }

  async function handleSaveItem() {
    if (!selected || !itemDv.trim()) {
      toast.error("Dhivehi title is required");
      return;
    }
    try {
      await upsertTemplateItem({
        data: {
          id: editItemId || undefined,
          template_id: selected.id,
          section_id: itemSectionId || null,
          target_title_dhivehi: itemDv.trim(),
          target_title: itemEn.trim() || null,
          arabic_text: itemArabic.trim() || null,
          instructions: itemInstructions.trim() || null,
          is_required: itemRequired,
          display_order: items.length,
          sort_order: items.length,
        },
      });
      toast.success(editItemId ? "Target updated" : "Target added");
      setItemModalOpen(false);
      await loadTemplateDetails(selected);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save item");
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!selected) return;
    if (!confirm("Are you sure you want to delete this target?")) return;
    try {
      await deleteTemplateItem({ data: { id: itemId } });
      toast.success("Target deleted");
      await loadTemplateDetails(selected);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete item");
    }
  }

  async function handleApplyToStudents() {
    if (!selected) return;
    setAssigning(true);
    try {
      const res = await applyTemplateToStudents({
        data: {
          template_id: selected.id,
          target_class_id: assignTargetClass !== "all" ? assignTargetClass : null,
        },
      });
      toast.success(`Successfully assigned ${res.assigned} target records to students!`);
      setAssignOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to assign template");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <RoleShell role="admin" title="Target Templates & Categories">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left: Templates Sidebar */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Templates
            </CardTitle>
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            {templates.map((t) => {
              const term = terms.find((x) => x.id === t.term_id);
              const isSelected = selected?.id === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => loadTemplateDetails(t)}
                  className={`w-full rounded-lg border p-3 text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                      : "border-border/60 hover:bg-slate-50"
                  }`}
                >
                  <div className="font-semibold text-slate-900 text-sm">{t.name}</div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase">
                      {t.class_level}
                    </Badge>
                    <span>· {term?.term_name ?? "—"}</span>
                  </div>
                </button>
              );
            })}
            {templates.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No templates configured yet. Click "New" to create your first target template.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Template Builder */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                {selected ? selected.name : "Select a Template"}
              </CardTitle>
              {selected && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  Level: <strong className="uppercase">{selected.class_level}</strong> · Total
                  targets: <strong>{items.length}</strong>
                </div>
              )}
            </div>

            {selected && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDupName(`${selected.name} (Copy)`);
                    setDupTermId(selected.term_id);
                    setDupOpen(true);
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Duplicate
                </Button>

                <Button size="sm" variant="outline" onClick={() => setSectionOpen(true)}>
                  <FolderPlus className="h-3.5 w-3.5 mr-1" />
                  Add Section
                </Button>

                <Button
                  size="sm"
                  onClick={() => openAddItemModal()}
                  className="bg-sky-600 hover:bg-sky-700 text-white"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Target
                </Button>

                <Button
                  size="sm"
                  onClick={() => setAssignOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <UserCheck className="h-3.5 w-3.5 mr-1" />
                  Assign to Students
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent className="p-6">
            {!selected ? (
              <div className="p-16 text-center text-sm text-muted-foreground space-y-2">
                <Layers className="h-10 w-10 mx-auto text-slate-300 stroke-1" />
                <div className="font-medium text-slate-700">No template selected</div>
                <p className="text-xs max-w-sm mx-auto">
                  Select an existing template from the left or create a new template to organize
                  curriculum targets.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Sections & Items Breakdown */}
                {sections.map((sec) => {
                  const secItems = items.filter((it) => it.section_id === sec.id);
                  return (
                    <div
                      key={sec.id}
                      className="rounded-xl border border-border/80 overflow-hidden shadow-xs"
                    >
                      {/* Section Header */}
                      <div className="bg-slate-50/80 px-4 py-2.5 border-b flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-900 text-sm">
                            {sec.section_name}
                          </span>
                          {sec.section_name_dhivehi && (
                            <span className="font-dhivehi text-sm text-sky-800" dir="rtl">
                              {sec.section_name_dhivehi}
                            </span>
                          )}
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {secItems.length} targets
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-sky-700 hover:text-sky-900"
                            onClick={() => openAddItemModal(sec.id)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add in section
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-rose-600 hover:text-rose-800"
                            onClick={() => handleDeleteSection(sec.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Items List inside Section */}
                      <div className="divide-y divide-border/40">
                        {secItems.map((it, idx) => (
                          <div
                            key={it.id}
                            className="p-3 hover:bg-slate-50/50 flex items-start justify-between gap-4 transition-colors"
                          >
                            <div className="flex items-start gap-3 flex-1">
                              <span className="text-xs font-mono text-muted-foreground w-5 mt-1">
                                {idx + 1}.
                              </span>
                              <div className="space-y-1 flex-1">
                                {it.arabic_text && (
                                  <div
                                    className="text-right font-arabic font-bold text-lg text-sky-950 leading-relaxed"
                                    dir="rtl"
                                  >
                                    {it.arabic_text}
                                  </div>
                                )}
                                <div
                                  className="text-right font-dhivehi font-semibold text-slate-900 text-base"
                                  dir="rtl"
                                >
                                  {it.target_title_dhivehi || it.title_dv}
                                </div>
                                {(it.target_title || it.title_en) && (
                                  <div className="text-xs text-slate-600">
                                    {it.target_title || it.title_en}
                                  </div>
                                )}
                                {it.instructions && (
                                  <div className="text-xs text-muted-foreground italic">
                                    Guide: {it.instructions}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs"
                                onClick={() => openEditItemModal(it)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs text-rose-600"
                                onClick={() => handleDeleteItem(it.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}

                        {secItems.length === 0 && (
                          <div className="p-4 text-center text-xs text-muted-foreground italic">
                            No targets added in this section yet.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Unsectioned items if any */}
                {items.some((it) => !it.section_id) && (
                  <div className="rounded-xl border border-border/80 overflow-hidden">
                    <div className="bg-slate-50/80 px-4 py-2.5 border-b font-bold text-slate-700 text-sm">
                      General / Uncategorized Targets
                    </div>
                    <div className="divide-y divide-border/40">
                      {items
                        .filter((it) => !it.section_id)
                        .map((it, idx) => (
                          <div
                            key={it.id}
                            className="p-3 hover:bg-slate-50/50 flex items-start justify-between gap-4"
                          >
                            <div className="flex items-start gap-3 flex-1">
                              <span className="text-xs font-mono text-muted-foreground w-5 mt-1">
                                {idx + 1}.
                              </span>
                              <div className="space-y-1 flex-1">
                                <div
                                  className="text-right font-dhivehi font-semibold text-slate-900"
                                  dir="rtl"
                                >
                                  {it.target_title_dhivehi || it.title_dv}
                                </div>
                                {(it.target_title || it.title_en) && (
                                  <div className="text-xs text-slate-600">
                                    {it.target_title || it.title_en}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs"
                                onClick={() => openEditItemModal(it)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs text-rose-600"
                                onClick={() => handleDeleteItem(it.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Template Modal */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Target Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <Label>Template Name</Label>
              <Input
                placeholder="e.g. LKG Term 1 Core Targets"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Class Level</Label>
                <select
                  value={newLevel}
                  onChange={(e) => setNewLevel(e.target.value)}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {LEVELS.map((l) => (
                    <option key={l.v} value={l.v}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Academic Term</Label>
                <select
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Choose term --</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.term_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>Description / Syllabus Note (optional)</Label>
              <Textarea
                rows={2}
                placeholder="Brief guidelines about this target curriculum..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="mt-1 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTemplate}>Create Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Template Modal */}
      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicate Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <Label>New Template Name</Label>
              <Input
                value={dupName}
                onChange={(e) => setDupName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Assign to Term (optional)</Label>
              <select
                value={dupTermId}
                onChange={(e) => setDupTermId(e.target.value)}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.term_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDupOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDuplicateTemplate}>Duplicate Now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Section Modal */}
      <Dialog open={sectionOpen} onOpenChange={setSectionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Curriculum Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <Label>Section Name (English)</Label>
              <Input
                placeholder="e.g. Surah Memorization, Du'a & Adhkar"
                value={secName}
                onChange={(e) => setSecName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Section Name (Dhivehi)</Label>
              <Input
                placeholder="e.g. ސޫރަތްތައް ހިތުދަސްކުރުން"
                value={secNameDv}
                onChange={(e) => setSecNameDv(e.target.value)}
                className="mt-1 text-right font-dhivehi"
                dir="rtl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSection}>Add Section</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Target Item Modal */}
      <Dialog open={itemModalOpen} onOpenChange={setItemModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItemId ? "Edit Target Item" : "Add Target Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <Label>Curriculum Section</Label>
              <select
                value={itemSectionId}
                onChange={(e) => setItemSectionId(e.target.value)}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">-- General / No Section --</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.section_name} {s.section_name_dhivehi ? `(${s.section_name_dhivehi})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Dhivehi Target Title *</Label>
              <Input
                placeholder="e.g. ސޫރަތުލް ފާތިޙާ ހިތުދަސްކުރުން"
                value={itemDv}
                onChange={(e) => setItemDv(e.target.value)}
                className="mt-1 text-right font-dhivehi text-base"
                dir="rtl"
              />
            </div>

            <div>
              <Label>Arabic Recitation Text (with diacritics / harakaat)</Label>
              <Textarea
                rows={2}
                placeholder="e.g. بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"
                value={itemArabic}
                onChange={(e) => setItemArabic(e.target.value)}
                className="mt-1 text-right font-arabic text-xl leading-relaxed"
                dir="rtl"
              />
            </div>

            <div>
              <Label>English Subtitle / Translation (optional)</Label>
              <Input
                placeholder="e.g. Surah Al-Fatihah Memorization"
                value={itemEn}
                onChange={(e) => setItemEn(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Guide / Teacher Instructions (optional)</Label>
              <Textarea
                rows={2}
                placeholder="Special pronunciation tips or test guidelines..."
                value={itemInstructions}
                onChange={(e) => setItemInstructions(e.target.value)}
                className="mt-1 text-sm"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                id="req-chk"
                type="checkbox"
                checked={itemRequired}
                onChange={(e) => setItemRequired(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="req-chk" className="cursor-pointer text-xs font-medium">
                Mandatory target for term completion
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveItem}>Save Target</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign to Students Modal */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Template to Students</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-xs text-muted-foreground">
              This will create target assignments for all active students in the selected class or
              level. Existing assignments will not be duplicated.
            </p>

            <div>
              <Label>Target Class</Label>
              <select
                value={assignTargetClass}
                onChange={(e) => setAssignTargetClass(e.target.value)}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">
                  All active classes for level ({selected?.class_level.toUpperCase()})
                </option>
                {classes
                  .filter((c) => !selected || c.class_level === selected.class_level)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.class_name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApplyToStudents}
              disabled={assigning}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {assigning ? "Assigning..." : "Confirm & Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RoleShell>
  );
}
