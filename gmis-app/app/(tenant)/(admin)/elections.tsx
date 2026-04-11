// ============================================================
// GMIS — Admin Elections Management
// Route: /(tenant)/(admin)/elections
// Tables: elections, election_candidates, election_votes, departments
// All confirmed from schema.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import {
  View, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, Alert, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { formatDate }      from "@/lib/helpers";
import { Text, Card, Badge, Button, Spinner } from "@/components/ui";
import { SelectModal, type SelectOption } from "@/components/ui/SelectModal";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }      from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

// ── Types — confirmed from schema ─────────────────────────
interface Election {
  id: string; title: string; description: string | null;
  position: string | null; scope: string;
  department_id: string | null;
  start_date: string | null; end_date: string | null;
  status: string; nomination_open: boolean; created_at: string;
}

interface Candidate {
  id: string; election_id: string; full_name: string;
  manifesto: string | null; photo_url: string | null;
  nomination_status: string; student_id: string | null;
  vote_count?: number;
}

interface Dept { id: string; name: string }

const STATUS_COLORS: Record<string, "green" | "amber" | "gray" | "red"> = {
  active: "green", draft: "amber", closed: "gray",
};

const fmtDateTime = (s: string | null) => {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

export default function AdminElections() {
  const router           = useRouter();
  const { tenant, slug } = useTenant();
  const { colors }       = useTheme();
  const { pagePadding }  = useResponsive();

  const [elections,   setElections]   = useState<Election[]>([]);
  const [depts,       setDepts]       = useState<Dept[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [view,        setView]        = useState<"list" | "detail">("list");
  const [activeElect, setActiveElect] = useState<Election | null>(null);
  const [candidates,  setCandidates]  = useState<Candidate[]>([]);
  const [voteCounts,  setVoteCounts]  = useState<Record<string, number>>({});
  const [totalVotes,  setTotalVotes]  = useState(0);

  // Election form
  const [showEForm, setShowEForm] = useState(false);
  const [editEId,   setEditEId]   = useState<string | null>(null);
  const [eForm, setEForm] = useState({
    title: "", description: "", position: "", scope: "sug",
    department_id: "", start_date: "", end_date: "",
    status: "draft", nomination_open: false,
  });
  const setEF = (k: string, v: any) => setEForm((p) => ({ ...p, [k]: v }));

  // Candidate form
  const [showCForm, setShowCForm] = useState(false);
  const [editCId,   setEditCId]   = useState<string | null>(null);
  const [cForm, setCForm] = useState({ full_name: "", manifesto: "", photo_url: "" });
  const setCF = (k: string, v: string) => setCForm((p) => ({ ...p, [k]: v }));

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db) loadAll(); }, [db]);

  const loadAll = async (isRefresh = false) => {
    if (!db) return;
    if (!isRefresh) setLoading(true);
    const [eRes, dRes] = await Promise.allSettled([
      db.from("elections").select("*").order("created_at", { ascending: false }),
      db.from("departments").select("id, name").eq("is_active", true).order("name"),
    ]);
    if (eRes.status  === "fulfilled" && eRes.value.data)  setElections(eRes.value.data as Election[]);
    if (dRes.status  === "fulfilled" && dRes.value.data)  setDepts(dRes.value.data as Dept[]);
    setLoading(false);
    setRefreshing(false);
  };

  const openElection = async (e: Election) => {
    setActiveElect(e);
    setView("detail");
    loadCandidates(e.id, e.status === "closed");
  };

  const loadCandidates = async (electionId: string, loadCounts = false) => {
    if (!db) return;
    const { data } = await db
      .from("election_candidates")
      .select("id, election_id, full_name, manifesto, photo_url, nomination_status, student_id")
      .eq("election_id", electionId)
      .order("full_name");

    const cands = (data || []) as Candidate[];
    if (loadCounts && cands.length > 0) {
      const { data: votes } = await db
        .from("election_votes")
        .select("candidate_id")
        .eq("election_id", electionId);

      const counts: Record<string, number> = {};
      (votes || []).forEach((v: any) => {
        counts[v.candidate_id] = (counts[v.candidate_id] || 0) + 1;
      });
      setVoteCounts(counts);
      setTotalVotes((votes || []).length);
      setCandidates(cands.map((c) => ({ ...c, vote_count: counts[c.id] || 0 })));
    } else {
      setCandidates(cands);
    }
  };

  // ── Election CRUD ─────────────────────────────────────
  const openEForm = (e?: Election) => {
    setEForm(e ? {
      title: e.title, description: e.description || "", position: e.position || "",
      scope: e.scope, department_id: e.department_id || "",
      start_date: e.start_date?.slice(0, 16) || "", end_date: e.end_date?.slice(0, 16) || "",
      status: e.status, nomination_open: e.nomination_open,
    } : { title: "", description: "", position: "", scope: "sug", department_id: "", start_date: "", end_date: "", status: "draft", nomination_open: false });
    setEditEId(e?.id || null);
    setShowEForm(true);
  };

  const saveElection = async () => {
    if (!eForm.title.trim()) { Alert.alert("Error", "Title is required"); return; }
    setSaving(true);
    const payload = {
      title:           eForm.title.trim(),
      description:     eForm.description || null,
      position:        eForm.position || null,
      scope:           eForm.scope,
      department_id:   eForm.department_id || null,
      start_date:      eForm.start_date || null,
      end_date:        eForm.end_date || null,
      status:          eForm.status,
      nomination_open: eForm.nomination_open,
    };
    const { error } = editEId
      ? await db!.from("elections").update(payload as any).eq("id", editEId)
      : await db!.from("elections").insert(payload as any);
    setSaving(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setShowEForm(false); setEditEId(null);
    loadAll(true);
  };

  const deleteElection = (id: string, title: string) => {
    Alert.alert("Delete Election", `Delete "${title}"? All votes and candidates will also be deleted.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await db!.from("election_votes").delete().eq("election_id", id);
        await db!.from("election_candidates").delete().eq("election_id", id);
        await db!.from("elections").delete().eq("id", id);
        loadAll(true);
      }},
    ]);
  };

  const changeStatus = async (e: Election, status: string) => {
    await db!.from("elections").update({ status } as any).eq("id", e.id);
    setActiveElect((p) => p ? { ...p, status } : null);
    setElections((prev) => prev.map((el) => el.id === e.id ? { ...el, status } : el));
    if (status === "closed") loadCandidates(e.id, true);
  };

  // ── Candidate CRUD ────────────────────────────────────
  const openCForm = (c?: Candidate) => {
    setCForm(c ? { full_name: c.full_name, manifesto: c.manifesto || "", photo_url: c.photo_url || "" } : { full_name: "", manifesto: "", photo_url: "" });
    setEditCId(c?.id || null);
    setShowCForm(true);
  };

  const saveCandidate = async () => {
    if (!cForm.full_name.trim()) { Alert.alert("Error", "Candidate name is required"); return; }
    setSaving(true);
    const payload = { full_name: cForm.full_name.trim(), manifesto: cForm.manifesto || null, photo_url: cForm.photo_url || null, nomination_status: "approved", election_id: activeElect!.id };
    const { error } = editCId
      ? await db!.from("election_candidates").update(payload as any).eq("id", editCId)
      : await db!.from("election_candidates").insert(payload as any);
    setSaving(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setShowCForm(false); setEditCId(null);
    loadCandidates(activeElect!.id, activeElect!.status === "closed");
  };

  const deleteCandidate = (id: string, name: string) => {
    Alert.alert("Remove Candidate", `Remove "${name}" from this election?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        await db!.from("election_candidates").delete().eq("id", id);
        loadCandidates(activeElect!.id);
      }},
    ]);
  };

  const deptOptions: SelectOption[]   = [{ label: "All students (SUG)", value: "" }, ...depts.map((d) => ({ label: d.name, value: d.id }))];
  const statusOptions: SelectOption[] = [{ label: "Draft", value: "draft" }, { label: "Active", value: "active" }, { label: "Closed", value: "closed" }];
  const scopeOptions: SelectOption[]  = [{ label: "All students (SUG)", value: "sug" }, { label: "Department only", value: "departmental" }];

  const shellUser = { name: "Admin", role: "admin" as const };

  if (loading) {
    return (
      <AppShell role="admin" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Elections">
        <View style={[layout.fill, layout.centred]}><Spinner size="lg" /></View>
      </AppShell>
    );
  }

  // ── Detail view ────────────────────────────────────────
  if (view === "detail" && activeElect) {
    const maxVotes = Math.max(...candidates.map((c) => c.vote_count || 0), 1);
    const isClosed = activeElect.status === "closed";
    return (
      <AppShell role="admin" user={shellUser} schoolName={tenant?.name || ""} pageTitle={activeElect.title}
        showBack onBack={() => { setView("list"); setActiveElect(null); setCandidates([]); }}>
        <ScrollView
          style={[layout.fill, { backgroundColor: colors.bg.primary }]}
          contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
          showsVerticalScrollIndicator={false}
        >
          {/* Election header */}
          <Card>
            <View style={[layout.rowBetween, { flexWrap: "wrap", gap: spacing[3] }]}>
              <View style={layout.fill}>
                <Text variant="subtitle" weight="bold" color="primary">{activeElect.title}</Text>
                {activeElect.position && <Text variant="caption" color="muted">Position: {activeElect.position}</Text>}
                {activeElect.description && <Text variant="body" color="secondary" style={{ marginTop: spacing[2] }}>{activeElect.description}</Text>}
              </View>
              <Badge label={activeElect.status} variant={STATUS_COLORS[activeElect.status] || "gray"} size="md" />
            </View>
            <View style={[layout.row, { gap: spacing[3], marginTop: spacing[3], flexWrap: "wrap" }]}>
              <Text variant="micro" color="muted">Start: {fmtDateTime(activeElect.start_date)}</Text>
              <Text variant="micro" color="muted">End: {fmtDateTime(activeElect.end_date)}</Text>
              {isClosed && <Text variant="micro" color="muted">Total votes: {totalVotes}</Text>}
            </View>
            {/* Status controls */}
            <View style={[layout.row, { gap: spacing[2], marginTop: spacing[4], flexWrap: "wrap" }]}>
              {activeElect.status === "draft"  && <Button label="Activate election"  variant="primary"   size="sm" onPress={() => changeStatus(activeElect, "active")} />}
              {activeElect.status === "active" && <Button label="Close election"     variant="secondary" size="sm" onPress={() => changeStatus(activeElect, "closed")} />}
              <Button label="Edit" variant="secondary" size="sm" onPress={() => { openEForm(activeElect); setView("list"); }} />
            </View>
          </Card>

          {/* Add candidate */}
          {!isClosed && (
            <Button label="+ Add candidate" variant="primary" size="md" onPress={() => openCForm()} />
          )}

          {/* Candidate form */}
          {showCForm && (
            <Card variant="brand">
              <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[4] }}>
                {editCId ? "Edit candidate" : "Add candidate"}
              </Text>
              <CFormInput label="Full name *" value={cForm.full_name} onChange={(v) => setCF("full_name", v)} placeholder="Student full name" colors={colors} />
              <CFormInput label="Manifesto" value={cForm.manifesto} onChange={(v) => setCF("manifesto", v)} placeholder="Campaign manifesto (optional)" multiline colors={colors} />
              <CFormInput label="Photo URL" value={cForm.photo_url} onChange={(v) => setCF("photo_url", v)} placeholder="https://... (optional)" colors={colors} />
              <View style={[layout.row, { gap: spacing[3] }]}>
                <Button label={saving ? "Saving..." : editCId ? "Update" : "Add"} variant="primary" size="md" loading={saving} onPress={saveCandidate} />
                <Button label="Cancel" variant="secondary" size="md" onPress={() => { setShowCForm(false); setEditCId(null); }} />
              </View>
            </Card>
          )}

          {/* Candidates list / results */}
          <Text variant="label" weight="bold" color="primary">
            {isClosed ? `Results — ${candidates.length} candidates` : `Candidates — ${candidates.length}`}
          </Text>

          {candidates.length === 0 ? (
            <Card>
              <View style={[layout.centredH, { paddingVertical: spacing[6] }]}>
                <Icon name="user-student" size="2xl" color={colors.text.muted} />
                <Text variant="body" color="muted" style={{ marginTop: spacing[2] }}>No candidates yet.</Text>
              </View>
            </Card>
          ) : (
            candidates
              .sort((a, b) => isClosed ? (b.vote_count || 0) - (a.vote_count || 0) : 0)
              .map((c, i) => {
                const pct = isClosed && totalVotes > 0 ? Math.round(((c.vote_count || 0) / totalVotes) * 100) : 0;
                const isWinner = isClosed && i === 0;
                return (
                  <Card key={c.id} style={{ borderColor: isWinner ? brand.gold : colors.border.DEFAULT, borderWidth: isWinner ? 2 : 1 }}>
                    <View style={[layout.rowBetween, { marginBottom: isClosed ? spacing[3] : 0 }]}>
                      <View style={[layout.row, { gap: spacing[3] }]}>
                        <View style={[styles.avatar, { backgroundColor: isWinner ? brand.goldAlpha20 : brand.blueAlpha15 }]}>
                          <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: isWinner ? brand.gold : brand.blue }}>
                            {c.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                          </Text>
                        </View>
                        <View>
                          <View style={[layout.row, { gap: spacing[2] }]}>
                            <Text variant="label" weight="bold" color="primary">{c.full_name}</Text>
                            {isWinner && <Badge label="Winner 🏆" variant="gold" size="xs" />}
                          </View>
                          {c.manifesto && <Text variant="caption" color="muted" numberOfLines={2} style={{ maxWidth: 260 }}>{c.manifesto}</Text>}
                        </View>
                      </View>
                      {isClosed ? (
                        <Text style={{ fontSize: fontSize.xl, fontWeight: fontWeight.black, color: isWinner ? brand.gold : colors.text.primary }}>
                          {c.vote_count || 0}
                        </Text>
                      ) : !showCForm && (
                        <View style={[layout.row, { gap: spacing[2] }]}>
                          <TouchableOpacity onPress={() => openCForm(c)} activeOpacity={0.7} style={styles.actionBtn}>
                            <Icon name="action-edit" size="sm" color={colors.text.secondary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => deleteCandidate(c.id, c.full_name)} activeOpacity={0.7} style={[styles.actionBtn, { backgroundColor: colors.status.errorBg }]}>
                            <Icon name="action-delete" size="sm" color={colors.status.error} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {/* Vote bar */}
                    {isClosed && (
                      <>
                        <View style={[styles.voteBarBg, { backgroundColor: colors.bg.hover }]}>
                          <View style={[styles.voteBarFill, { width: `${pct}%`, backgroundColor: isWinner ? brand.gold : brand.blue }]} />
                        </View>
                        <Text variant="micro" color="muted">{c.vote_count || 0} votes · {pct}%</Text>
                      </>
                    )}
                  </Card>
                );
              })
          )}

          <View style={{ height: spacing[8] }} />
        </ScrollView>
      </AppShell>
    );
  }

  // ── List view ──────────────────────────────────────────
  return (
    <AppShell role="admin" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Elections"
      showBack onBack={() => router.back()}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(true); }} tintColor={brand.blue} />}
      >
        <Text variant="heading" color="primary">Elections & Voting</Text>
        <Text variant="caption" color="muted">{elections.length} election{elections.length !== 1 ? "s" : ""} total</Text>

        {/* Stats */}
        <View style={[layout.row, { gap: spacing[3] }]}>
          {[
            { label: "Active",  count: elections.filter((e) => e.status === "active").length,  color: "#4ade80" },
            { label: "Draft",   count: elections.filter((e) => e.status === "draft").length,   color: "#fbbf24" },
            { label: "Closed",  count: elections.filter((e) => e.status === "closed").length,  color: colors.text.muted },
          ].map(({ label, count, color }) => (
            <Card key={label} style={[layout.fill, { alignItems: "center", padding: spacing[3] }]}>
              <Text style={{ fontSize: fontSize["2xl"], fontWeight: fontWeight.black, color }}>{count}</Text>
              <Text style={{ fontSize: fontSize.xs, color: colors.text.muted }}>{label}</Text>
            </Card>
          ))}
        </View>

        {!showEForm && (
          <Button label="+ Create election" variant="primary" size="md" onPress={() => openEForm()} />
        )}

        {/* Election form */}
        {showEForm && (
          <Card variant="brand">
            <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[4] }}>
              {editEId ? "Edit election" : "Create election"}
            </Text>
            <CFormInput label="Election title *" value={eForm.title} onChange={(v) => setEF("title", v)} placeholder="e.g. SUG President 2025/2026" colors={colors} />
            <CFormInput label="Position" value={eForm.position} onChange={(v) => setEF("position", v)} placeholder="e.g. President, Vice President" colors={colors} />
            <CFormInput label="Description" value={eForm.description} onChange={(v) => setEF("description", v)} placeholder="Brief description (optional)" multiline colors={colors} />
            <SelectModal label="Scope" placeholder="Select" value={eForm.scope} options={scopeOptions} onChange={(v) => setEF("scope", v)} />
            {eForm.scope === "departmental" && (
              <SelectModal label="Department" placeholder="Select department" value={eForm.department_id} options={deptOptions} onChange={(v) => setEF("department_id", v)} />
            )}
            <SelectModal label="Status" placeholder="Select" value={eForm.status} options={statusOptions} onChange={(v) => setEF("status", v)} />

            <Text variant="caption" color="secondary" weight="medium" style={{ marginBottom: spacing[1] }}>Start date & time</Text>
            <TextInput value={eForm.start_date} onChangeText={(v) => setEF("start_date", v)} placeholder="YYYY-MM-DDTHH:MM" placeholderTextColor={colors.text.muted}
              style={{ backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.border.DEFAULT, borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2], color: colors.text.primary, fontSize: fontSize.md, marginBottom: spacing[3] }} />
            <Text variant="caption" color="secondary" weight="medium" style={{ marginBottom: spacing[1] }}>End date & time</Text>
            <TextInput value={eForm.end_date} onChangeText={(v) => setEF("end_date", v)} placeholder="YYYY-MM-DDTHH:MM" placeholderTextColor={colors.text.muted}
              style={{ backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.border.DEFAULT, borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2], color: colors.text.primary, fontSize: fontSize.md, marginBottom: spacing[3] }} />

            <TouchableOpacity onPress={() => setEF("nomination_open", !eForm.nomination_open)} style={[layout.row, { gap: spacing[2], marginBottom: spacing[4] }]} activeOpacity={0.7}>
              <View style={[{ width: spacing[5], height: spacing[5], borderRadius: radius.sm, borderWidth: 2, alignItems: "center", justifyContent: "center", borderColor: eForm.nomination_open ? brand.blue : colors.border.strong, backgroundColor: eForm.nomination_open ? brand.blue : "transparent" }]}>
                {eForm.nomination_open && <Icon name="ui-check" size="xs" color="#fff" />}
              </View>
              <Text variant="caption" color="secondary">Nominations are open</Text>
            </TouchableOpacity>

            <View style={[layout.row, { gap: spacing[3] }]}>
              <Button label={saving ? "Saving..." : editEId ? "Update" : "Create"} variant="primary" size="md" loading={saving} onPress={saveElection} />
              <Button label="Cancel" variant="secondary" size="md" onPress={() => { setShowEForm(false); setEditEId(null); }} />
            </View>
          </Card>
        )}

        {/* Elections list */}
        {elections.length === 0 ? (
          <Card>
            <View style={[layout.centredH, { paddingVertical: spacing[8] }]}>
              <Icon name="nav-voting" size="3xl" color={colors.text.muted} />
              <Text variant="body" color="muted" align="center" style={{ marginTop: spacing[3] }}>
                No elections yet. Create one above.
              </Text>
            </View>
          </Card>
        ) : (
          elections.map((e) => (
            <TouchableOpacity key={e.id} onPress={() => openElection(e)} activeOpacity={0.85}>
              <Card>
                <View style={[layout.rowBetween, { flexWrap: "wrap", gap: spacing[2] }]}>
                  <View style={layout.fill}>
                    <View style={[layout.row, { gap: spacing[2], marginBottom: spacing[1] }]}>
                      <Text variant="label" weight="bold" color="primary">{e.title}</Text>
                      <Badge label={e.status} variant={STATUS_COLORS[e.status] || "gray"} size="xs" />
                    </View>
                    {e.position && <Text variant="caption" color="muted">Position: {e.position}</Text>}
                    <Text variant="micro" color="muted">
                      {e.scope === "departmental" ? "Departmental" : "SUG — All students"} ·{" "}
                      {fmtDateTime(e.start_date)} – {fmtDateTime(e.end_date)}
                    </Text>
                    {e.nomination_open && <Badge label="Nominations open" variant="blue" size="xs" style={{ marginTop: spacing[1] }} />}
                  </View>
                  <TouchableOpacity
                    onPress={(ev) => { ev.stopPropagation(); deleteElection(e.id, e.title); }}
                    activeOpacity={0.7}
                    style={[styles.actionBtn, { backgroundColor: colors.status.errorBg }]}
                  >
                    <Icon name="action-delete" size="sm" color={colors.status.error} />
                  </TouchableOpacity>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </AppShell>
  );
}

function CFormInput({ label, value, onChange, placeholder, multiline, colors }: any) {
  return (
    <View style={{ marginBottom: spacing[3] }}>
      <Text variant="caption" color="secondary" weight="medium" style={{ marginBottom: spacing[1] }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.text.muted} multiline={multiline}
        style={{ backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.border.DEFAULT, borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2], color: colors.text.primary, fontSize: fontSize.md, minHeight: multiline ? 80 : undefined, textAlignVertical: multiline ? "top" : "center" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar:       { width: spacing[10], height: spacing[10], borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  actionBtn:    { width: spacing[8], height: spacing[8], borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" },
  voteBarBg:    { height: 8, borderRadius: 4, overflow: "hidden", marginBottom: spacing[1] },
  voteBarFill:  { height: "100%", borderRadius: 4 },
});
