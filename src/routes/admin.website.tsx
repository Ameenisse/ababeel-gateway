import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/role-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/website")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Website Settings — Admin" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: WebsiteSettingsPage,
});

type WebsiteSettings = {
  id: string;
  website_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  hero_title: string | null;
  hero_description: string | null;
  contact_number: string | null;
  contact_email: string | null;
  address: string | null;
  social_facebook: string | null;
  social_instagram: string | null;
  social_youtube: string | null;
  landing_images: string[] | null;
  about_section: string | null;
  footer_text: string | null;
  theme: string | null;
};

function WebsiteSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<WebsiteSettings> | null>(null);
  const [newImage, setNewImage] = useState("");

  const query = useQuery({
    queryKey: ["website_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_settings")
        .select("*")
        .eq("singleton", true)
        .maybeSingle();
      if (error) throw error;
      return data as WebsiteSettings | null;
    },
  });

  useEffect(() => {
    if (query.data) setForm(query.data);
    else if (query.isFetched && !query.data) setForm({});
  }, [query.data, query.isFetched]);

  const saveMut = useMutation({
    mutationFn: async (v: Partial<WebsiteSettings>) => {
      const payload = {
        website_name: v.website_name ?? null,
        logo_url: v.logo_url ?? null,
        favicon_url: v.favicon_url ?? null,
        hero_title: v.hero_title ?? null,
        hero_description: v.hero_description ?? null,
        contact_number: v.contact_number ?? null,
        contact_email: v.contact_email ?? null,
        address: v.address ?? null,
        social_facebook: v.social_facebook ?? null,
        social_instagram: v.social_instagram ?? null,
        social_youtube: v.social_youtube ?? null,
        landing_images: v.landing_images ?? null,
        about_section: v.about_section ?? null,
        footer_text: v.footer_text ?? null,
        theme: v.theme ?? null,
        singleton: true,
      };
      if (v.id) {
        const { error } = await supabase.from("website_settings").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("website_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["website_settings"] });
      toast.success("Website settings saved");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  if (!form) {
    return (
      <RoleShell role="admin" title="Website Settings">
        <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
      </RoleShell>
    );
  }

  const images = form.landing_images ?? [];

  return (
    <RoleShell role="admin" title="Website Settings">
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">General</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Website name</Label>
              <Input
                value={form.website_name ?? ""}
                onChange={(e) => setForm({ ...form, website_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Theme</Label>
              <Input
                value={form.theme ?? ""}
                onChange={(e) => setForm({ ...form, theme: e.target.value })}
              />
            </div>
            <div>
              <Label>Logo URL</Label>
              <Input
                value={form.logo_url ?? ""}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              />
            </div>
            <div>
              <Label>Favicon URL</Label>
              <Input
                value={form.favicon_url ?? ""}
                onChange={(e) => setForm({ ...form, favicon_url: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Hero & About</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div>
              <Label>Hero title</Label>
              <Input
                value={form.hero_title ?? ""}
                onChange={(e) => setForm({ ...form, hero_title: e.target.value })}
              />
            </div>
            <div>
              <Label>Hero description</Label>
              <Textarea
                rows={3}
                value={form.hero_description ?? ""}
                onChange={(e) => setForm({ ...form, hero_description: e.target.value })}
              />
            </div>
            <div>
              <Label>About section</Label>
              <Textarea
                rows={4}
                value={form.about_section ?? ""}
                onChange={(e) => setForm({ ...form, about_section: e.target.value })}
              />
            </div>
            <div>
              <Label>Footer text</Label>
              <Textarea
                rows={2}
                value={form.footer_text ?? ""}
                onChange={(e) => setForm({ ...form, footer_text: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Contact & Social</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Contact number</Label>
              <Input
                value={form.contact_number ?? ""}
                onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
              />
            </div>
            <div>
              <Label>Contact email</Label>
              <Input
                value={form.contact_email ?? ""}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Textarea
                rows={2}
                value={form.address ?? ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div>
              <Label>Facebook URL</Label>
              <Input
                value={form.social_facebook ?? ""}
                onChange={(e) => setForm({ ...form, social_facebook: e.target.value })}
              />
            </div>
            <div>
              <Label>Instagram URL</Label>
              <Input
                value={form.social_instagram ?? ""}
                onChange={(e) => setForm({ ...form, social_instagram: e.target.value })}
              />
            </div>
            <div>
              <Label>YouTube URL</Label>
              <Input
                value={form.social_youtube ?? ""}
                onChange={(e) => setForm({ ...form, social_youtube: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base">Landing images</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input
                placeholder="https://…/image.jpg"
                value={newImage}
                onChange={(e) => setNewImage(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (!newImage.trim()) return;
                  setForm({ ...form, landing_images: [...images, newImage.trim()] });
                  setNewImage("");
                }}
              >
                <Plus className="mr-1 h-4 w-4" /> Add
              </Button>
            </div>
            {images.length === 0 ? (
              <p className="text-sm text-muted-foreground">No landing images yet.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {images.map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    className="flex items-center gap-2 rounded-md border border-border/60 p-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs">{url}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setForm({ ...form, landing_images: images.filter((_, idx) => idx !== i) })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button disabled={saveMut.isPending} onClick={() => saveMut.mutate(form)}>
            Save changes
          </Button>
        </div>
      </div>
    </RoleShell>
  );
}
