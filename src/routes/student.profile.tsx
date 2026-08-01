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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

export const Route = createFileRoute("/student/profile")({
  ssr: false,
  head: () => ({
    meta: [{ title: "My Profile — Ababeel Quran Class" }],
  }),
  component: StudentProfilePage,
});

type StudentRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  student_number: string;
  gender: string;
  date_of_birth: string;
  session: string | null;
  status: string;
  guardian_name: string | null;
  guardian_identity_number: string | null;
  mobile: string | null;
  alternative_mobile: string | null;
  address: string | null;
  photo_url: string | null;
  class: { class_name: string } | null;
};

type ProfileRow = {
  id: string;
  user_id: string;
  full_name: string;
  photo_url: string | null;
};

function StudentProfilePage() {
  const qc = useQueryClient();
  const [mobile, setMobile] = useState("");
  const [altMobile, setAltMobile] = useState("");
  const [address, setAddress] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const meQuery = useQuery({
    queryKey: ["me_profile_and_student"],
    queryFn: async () => {
      const { data: sess } = await supabase.auth.getUser();
      if (!sess.user) return null;
      const [studentRes, profileRes] = await Promise.all([
        supabase
          .from("students")
          .select("*, class:classes(class_name)")
          .eq("user_id", sess.user.id)
          .maybeSingle(),
        supabase.from("profiles").select("*").eq("user_id", sess.user.id).maybeSingle(),
      ]);
      if (studentRes.error) throw studentRes.error;
      if (profileRes.error) throw profileRes.error;
      return {
        userId: sess.user.id,
        student: studentRes.data as StudentRow | null,
        profile: profileRes.data as ProfileRow | null,
      };
    },
  });

  useEffect(() => {
    if (meQuery.data?.student) {
      setMobile(meQuery.data.student.mobile ?? "");
      setAltMobile(meQuery.data.student.alternative_mobile ?? "");
      setAddress(meQuery.data.student.address ?? "");
    }
    if (meQuery.data?.profile) {
      setPhotoUrl(meQuery.data.profile.photo_url ?? "");
    }
  }, [meQuery.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const s = meQuery.data?.student;
      const userId = meQuery.data?.userId;
      if (!s || !userId) throw new Error("Profile not found");
      const { error: studentErr } = await supabase
        .from("students")
        .update({
          mobile: mobile || null,
          alternative_mobile: altMobile || null,
          address: address || null,
        })
        .eq("id", s.id);
      if (studentErr) throw studentErr;

      if (meQuery.data?.profile) {
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({ photo_url: photoUrl || null })
          .eq("user_id", userId);
        if (profileErr) throw profileErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me_profile_and_student"] });
      toast.success("Profile updated");
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  const s = meQuery.data?.student;

  if (meQuery.isLoading) {
    return (
      <RoleShell role="student" title="My Profile">
        <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
      </RoleShell>
    );
  }

  if (!s) {
    return (
      <RoleShell role="student" title="My Profile">
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No student record found for your account.
          </CardContent>
        </Card>
      </RoleShell>
    );
  }

  return (
    <RoleShell role="student" title="My Profile">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="text-center">
            <Avatar className="mx-auto h-24 w-24">
              <AvatarImage src={photoUrl || s.photo_url || undefined} />
              <AvatarFallback>{s.full_name?.[0] ?? "S"}</AvatarFallback>
            </Avatar>
            <CardTitle className="mt-3 font-display">{s.full_name}</CardTitle>
            <p className="text-xs text-muted-foreground">{s.student_number}</p>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Class</span>
              <span>{s.class?.class_name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Session</span>
              <span>{s.session ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gender</span>
              <span className="capitalize">{s.gender}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date of birth</span>
              <span>{s.date_of_birth}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="capitalize">{s.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Guardian</span>
              <span>{s.guardian_name ?? "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-base">Editable details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Mobile</Label>
                <Input value={mobile} onChange={(e) => setMobile(e.target.value)} />
              </div>
              <div>
                <Label>Alternative mobile</Label>
                <Input value={altMobile} onChange={(e) => setAltMobile(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Textarea rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div>
              <Label>Photo URL</Label>
              <Input
                placeholder="https://…/photo.jpg"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleShell>
  );
}
