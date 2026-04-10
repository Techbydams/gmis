// ============================================================
// GMIS — Student Voting / SUG Elections
// Route: /(tenant)/(student)/voting
// Tables: elections, election_candidates, election_votes
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { Text, Card, Badge, Button, Spinner, Avatar, EmptyState } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }    from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

interface Election {
  id: string; title: string; description: string | null; position: string | null;
  scope: string; status: "draft"|"active"|"closed"; nomination_open: boolean;
  start_date: string | null; end_date: string | null; department_id: string | null;
}
interface Candidate {
  id: string; full_name: string; manifesto: string | null;
  photo_url: string | null; nomination_status: string;
}

export default function Voting() {
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();

  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [elections,     setElections]       = useState<Election[]>([]);
  const [candidates,    setCandidates]      = useState<Record<string, Candidate[]>>({});
  const [myVotes,       setMyVotes]         = useState<Record<string, string>>({}); // electionId → candidateId
  const [loading,       setLoading]         = useState(true);
  const [refreshing,    setRefreshing]      = useState(false);
  const [voting,        setVoting]          = useState<string | null>(null);
  const [expanded,      setExpanded]        = useState<string | null>(null);
  const [toast,         setToast]           = useState<{ msg: string; type: "error"|"success" } | null>(null);

  const db = useMemo(() => tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null, [tenant, slug]);

  useEffect(() => { if (db && user) load(); }, [db, user]);

  const showToast = (msg: string, type: "error"|"success" = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async (isRefresh = false) => {
    if (!db || !user) return;
    if (!isRefresh) setLoading(true);
    try {
      const { data: s } = await db.from("students").select("id, department_id").eq("supabase_uid", user.id).maybeSingle();
      if (!s) { setLoading(false); return; }
      setStudentProfile(s);

      // Load active elections (SUG = all students, departmental = student's dept)
      const { data: elecs } = await db
        .from("elections")
        .select("*")
        .in("status", ["active", "closed"])
        .or(`scope.eq.all,and(scope.eq.department,department_id.eq.${(s as any).department_id})`)
        .order("created_at", { ascending: false });

      const elecList = (elecs || []) as Election[];
      setElections(elecList);

      // Load candidates + my votes for each election
      const candMap: Record<string, Candidate[]> = {};
      const voteMap: Record<string, string> = {};

      await Promise.all(elecList.map(async (el) => {
        const [candRes, voteRes] = await Promise.all([
          db.from("election_candidates").select("id, full_name, manifesto, photo_url, nomination_status").eq("election_id", el.id).eq("nomination_status", "approved"),
          db.from("election_votes").select("candidate_id").eq("election_id", el.id).eq("student_id", (s as any).id).maybeSingle(),
        ]);
        candMap[el.id] = (candRes.data || []) as Candidate[];
        if (voteRes.data) voteMap[el.id] = (voteRes.data as any).candidate_id;
      }));

      setCandidates(candMap);
      setMyVotes(voteMap);
    } finally { setLoading(false); setRefreshing(false); }
  };

  const castVote = async (electionId: string, candidateId: string) => {
    if (!db || !studentProfile) return;
    if (myVotes[electionId]) { showToast("You have already voted in this election."); return; }
    setVoting(electionId);
    try {
      const { error } = await db.from("election_votes").insert({ election_id: electionId, student_id: studentProfile.id, candidate_id: candidateId } as any);
      if (error) { showToast("Vote failed. Please try again."); return; }
      setMyVotes((p) => ({ ...p, [electionId]: candidateId }));
      showToast("Vote cast successfully!", "success");
    } finally { setVoting(null); }
  };

  const shellUser = { name: user?.email?.split("@")[0] || "Student", role: "student" as const };

  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Elections" onLogout={async () => signOut()}>
      {/* Toast */}
      {toast && (
        <View style={[styles.toast, { backgroundColor: toast.type === "error" ? colors.status.errorBg : colors.status.successBg, borderColor: toast.type === "error" ? colors.status.errorBorder : colors.status.successBorder }]}>
          <Icon name={toast.type === "error" ? "status-error" : "status-success"} size="sm" color={toast.type === "error" ? colors.status.error : colors.status.success} />
          <Text style={{ flex: 1, fontSize: fontSize.sm, color: toast.type === "error" ? colors.status.error : colors.status.success, marginLeft: spacing[2] }}>{toast.msg}</Text>
        </View>
      )}

      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.blue} />}
      >
        <View>
          <Text variant="heading" color="primary">Elections & Voting</Text>
          <Text variant="caption" color="muted">Vote once per election. Results shown after polls close.</Text>
        </View>

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" /></View>
        ) : elections.length === 0 ? (
          <EmptyState icon="nav-voting" title="No active elections" description="Elections will appear here when they are opened by your school admin." />
        ) : (
          elections.map((el) => {
            const isActive   = el.status === "active";
            const isClosed   = el.status === "closed";
            const hasVoted   = !!myVotes[el.id];
            const myVoteId   = myVotes[el.id];
            const candList   = candidates[el.id] || [];
            const isExpanded = expanded === el.id;

            return (
              <Card key={el.id} variant={isActive && !hasVoted ? "brand" : "default"}>
                <TouchableOpacity onPress={() => setExpanded(isExpanded ? null : el.id)} activeOpacity={0.75}>
                  <View style={[layout.rowBetween, { marginBottom: spacing[2] }]}>
                    <View style={layout.fill}>
                      <Text variant="subtitle" weight="bold" color="primary">{el.title}</Text>
                      {el.position && <Text variant="caption" color="muted">Position: {el.position}</Text>}
                    </View>
                    <View style={[layout.row, { gap: spacing[2] }]}>
                      <Badge label={isActive ? "Active" : "Closed"} variant={isActive ? "green" : "gray"} dot={isActive} />
                      <Icon name={isExpanded ? "ui-up" : "ui-down"} size="sm" color={colors.text.muted} />
                    </View>
                  </View>

                  {el.description && <Text variant="caption" color="secondary" style={{ marginBottom: spacing[2] }}>{el.description}</Text>}

                  {hasVoted && (
                    <View style={[styles.votedBanner, { backgroundColor: colors.status.successBg, borderColor: colors.status.successBorder }]}>
                      <Icon name="status-success" size="sm" color={colors.status.success} filled />
                      <Text style={{ fontSize: fontSize.sm, color: colors.status.success, marginLeft: spacing[2] }}>
                        You voted for {candList.find(c => c.id === myVoteId)?.full_name || "a candidate"}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {isExpanded && (
                  <View style={{ marginTop: spacing[3] }}>
                    {candList.length === 0 ? (
                      <Text variant="caption" color="muted">No approved candidates yet.</Text>
                    ) : (
                      candList.map((cand) => {
                        const isMyVote = myVoteId === cand.id;
                        return (
                          <View key={cand.id} style={[styles.candRow, { borderColor: isMyVote ? brand.blue : colors.border.DEFAULT, backgroundColor: isMyVote ? brand.blueAlpha10 : colors.bg.hover }]}>
                            <Avatar name={cand.full_name} size="md" role="student" />
                            <View style={layout.fill}>
                              <Text variant="label" weight="semibold" color="primary">{cand.full_name}</Text>
                              {cand.manifesto && <Text variant="caption" color="muted" numberOfLines={2}>{cand.manifesto}</Text>}
                            </View>
                            {isActive && !hasVoted && (
                              <Button
                                label={voting === el.id ? "..." : "Vote"}
                                variant="primary"
                                size="sm"
                                loading={voting === el.id}
                                onPress={() => castVote(el.id, cand.id)}
                              />
                            )}
                            {isMyVote && <Badge label="Your vote" variant="blue" size="sm" />}
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  toast:      { position: "absolute", top: spacing[12], left: spacing[4], right: spacing[4], zIndex: 100, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1 },
  votedBanner:{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.lg, borderWidth: 1, marginTop: spacing[2] },
  candRow:    { flexDirection: "row", alignItems: "center", gap: spacing[3], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing[2] },
});
