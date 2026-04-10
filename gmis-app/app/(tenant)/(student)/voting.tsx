// ============================================================
// GMIS — Student Voting / SUG Elections
// Route: /(tenant)/(student)/voting
//
// Tables:
//   elections          — id, title, description, position, scope,
//                        status, nomination_open, start_date,
//                        end_date, department_id
//   election_candidates — id, election_id, full_name, manifesto,
//                         photo_url, nomination_status, student_id
//   election_votes     — id, election_id, student_id, candidate_id
//
// scope values: "all" (school-wide) | "department"
// status values: "draft" | "active" | "closed"
// nomination_status: "pending" | "approved" | "rejected"
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import {
  View, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { useDrawer } from "@/context/DrawerContext";
import { getTenantClient } from "@/lib/supabase";
import { Text, Card, Badge, Button, Spinner, Avatar, EmptyState } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }      from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

const GMIS_LOGO = require("@/assets/gmis_logo.png");

// ── Types ──────────────────────────────────────────────────
interface Election {
  id:              string;
  title:           string;
  description:     string | null;
  position:        string | null;
  scope:           string;           // "all" | "department"
  status:          "draft" | "active" | "closed";
  nomination_open: boolean;
  start_date:      string | null;
  end_date:        string | null;
  department_id:   string | null;
}

interface Candidate {
  id:                string;
  full_name:         string;
  manifesto:         string | null;
  photo_url:         string | null;
  nomination_status: string;
  vote_count?:       number;         // only visible after election closes
}

interface StudentProfile {
  id:            string;
  department_id: string | null;
  first_name:    string;
  last_name:     string;
}

// ── Top bar ────────────────────────────────────────────────
function TopBar({ onMenu, schoolName }: { onMenu: () => void; schoolName: string }) {
  const { colors } = useTheme();
  const insets     = useSafeAreaInsets();

  return (
    <View style={[styles.topBar, {
      backgroundColor:   colors.bg.card,
      borderBottomColor: colors.border.DEFAULT,
      paddingTop:        insets.top + spacing[2],
    }]}>
      <TouchableOpacity onPress={onMenu} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Icon name="ui-menu" size="md" color={colors.text.secondary} />
      </TouchableOpacity>
      <View style={layout.fill}>
        <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text.primary }}>
          Elections
        </Text>
        <Text style={{ fontSize: fontSize.xs, color: colors.text.muted }}>{schoolName}</Text>
      </View>
      <Image source={GMIS_LOGO} style={{ width: 52, height: 20 }} resizeMode="contain" />
    </View>
  );
}

// ── Candidate row ──────────────────────────────────────────
function CandidateRow({
  cand,
  isMyVote,
  isActive,
  hasVoted,
  isVoting,
  onVote,
  showResults,
  totalVotes,
  colors,
}: {
  cand:        Candidate;
  isMyVote:    boolean;
  isActive:    boolean;
  hasVoted:    boolean;
  isVoting:    boolean;
  onVote:      () => void;
  showResults: boolean;
  totalVotes:  number;
  colors:      any;
}) {
  const pct = showResults && totalVotes > 0
    ? Math.round(((cand.vote_count ?? 0) / totalVotes) * 100)
    : 0;

  return (
    <View
      style={[
        styles.candRow,
        {
          borderColor:     isMyVote ? brand.blue : colors.border.DEFAULT,
          backgroundColor: isMyVote ? brand.blueAlpha10 : colors.bg.hover,
        },
      ]}
    >
      <Avatar name={cand.full_name} size="md" role="student" />

      <View style={layout.fill}>
        <View style={[layout.row, { gap: spacing[2], alignItems: "center" }]}>
          <Text variant="label" weight="semibold" color="primary" numberOfLines={1} style={{ flex: 1 }}>
            {cand.full_name}
          </Text>
          {isMyVote && <Badge label="Your vote" variant="blue" size="sm" />}
        </View>

        {cand.manifesto ? (
          <Text variant="caption" color="muted" numberOfLines={2} style={{ marginTop: 2 }}>
            {cand.manifesto}
          </Text>
        ) : null}

        {/* Vote bar — shows after election closes */}
        {showResults && (
          <View style={[styles.voteBar, { marginTop: spacing[2] }]}>
            <View
              style={[
                styles.voteBarFill,
                {
                  backgroundColor: isMyVote ? brand.blue : colors.status.info,
                  width: `${pct}%` as any,
                },
              ]}
            />
            <Text style={{ fontSize: fontSize.xs, color: colors.text.muted, marginTop: 4 }}>
              {cand.vote_count ?? 0} vote{(cand.vote_count ?? 0) !== 1 ? "s" : ""} ({pct}%)
            </Text>
          </View>
        )}
      </View>

      {/* Vote button — only when active and not yet voted */}
      {isActive && !hasVoted && (
        <Button
          label={isVoting ? "..." : "Vote"}
          variant="primary"
          size="sm"
          loading={isVoting}
          onPress={onVote}
        />
      )}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────
export default function Voting() {
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();
  const { openDrawer }     = useDrawer();

  const [profile,    setProfile]    = useState<StudentProfile | null>(null);
  const [elections,  setElections]  = useState<Election[]>([]);
  const [candidates, setCandidates] = useState<Record<string, Candidate[]>>({});
  const [myVotes,    setMyVotes]    = useState<Record<string, string>>({});  // electionId → candidateId
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [voting,     setVoting]     = useState<string | null>(null);         // electionId being voted
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [toast,      setToast]      = useState<{ msg: string; type: "error" | "success" } | null>(null);

  const db = useMemo(() =>
    tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null,
  [tenant, slug]);

  useEffect(() => { if (db && user) load(); }, [db, user]);

  const showToast = (msg: string, type: "error" | "success" = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async (isRefresh = false) => {
    if (!db || !user) return;
    if (!isRefresh) setLoading(true);
    try {
      // ── 1. Get student profile ──────────────────────────
      const { data: s } = await db
        .from("students")
        .select("id, department_id, first_name, last_name")
        .eq("supabase_uid", user.id)
        .maybeSingle();

      if (!s) { setLoading(false); setRefreshing(false); return; }
      setProfile(s as StudentProfile);
      const sid  = (s as any).id;
      const dept = (s as any).department_id as string | null;

      // ── 2. Load elections visible to this student ────────
      //   scope="all"  → visible to everyone
      //   scope="department" AND department_id matches → visible
      let electionsQuery = db
        .from("elections")
        .select("*")
        .in("status", ["active", "closed"])
        .order("created_at", { ascending: false });

      // Build the OR filter
      if (dept) {
        electionsQuery = electionsQuery.or(
          `scope.eq.all,and(scope.eq.department,department_id.eq.${dept})`
        );
      } else {
        // No department — only see school-wide elections
        electionsQuery = electionsQuery.eq("scope", "all");
      }

      const { data: elecs, error: eErr } = await electionsQuery;
      if (eErr) console.warn("Elections query error:", eErr.message);

      const elecList = (elecs || []) as Election[];
      setElections(elecList);

      // ── 3. Load approved candidates + vote counts + my votes ─
      const candMap:  Record<string, Candidate[]> = {};
      const voteMap:  Record<string, string>      = {};

      await Promise.all(elecList.map(async (el) => {
        const [candRes, voteCountRes, myVoteRes] = await Promise.all([
          // Approved candidates
          db.from("election_candidates")
            .select("id, full_name, manifesto, photo_url, nomination_status")
            .eq("election_id", el.id)
            .eq("nomination_status", "approved"),

          // Vote counts (only meaningful when closed)
          el.status === "closed"
            ? db.from("election_votes")
                .select("candidate_id")
                .eq("election_id", el.id)
            : Promise.resolve({ data: [] }),

          // My vote
          db.from("election_votes")
            .select("candidate_id")
            .eq("election_id", el.id)
            .eq("student_id", sid)
            .maybeSingle(),
        ]);

        // Count votes per candidate
        const allVotes = (voteCountRes as any).data || [];
        const voteCountMap: Record<string, number> = {};
        allVotes.forEach((v: any) => {
          voteCountMap[v.candidate_id] = (voteCountMap[v.candidate_id] || 0) + 1;
        });

        candMap[el.id] = ((candRes.data || []) as Candidate[]).map((c) => ({
          ...c,
          vote_count: voteCountMap[c.id] ?? 0,
        }));

        if ((myVoteRes as any).data) {
          voteMap[el.id] = ((myVoteRes as any).data as any).candidate_id;
        }
      }));

      setCandidates(candMap);
      setMyVotes(voteMap);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const castVote = async (electionId: string, candidateId: string) => {
    if (!db || !profile) return;
    if (myVotes[electionId]) {
      showToast("You have already voted in this election.");
      return;
    }
    setVoting(electionId);
    try {
      const { error } = await db.from("election_votes").insert({
        election_id:  electionId,
        student_id:   profile.id,
        candidate_id: candidateId,
      } as any);
      if (error) {
        // Handle unique constraint (double-vote attempt)
        const msg = error.code === "23505"
          ? "You have already voted."
          : `Vote failed: ${error.message}`;
        showToast(msg);
        return;
      }
      setMyVotes((p) => ({ ...p, [electionId]: candidateId }));
      showToast("Vote cast successfully!", "success");
    } finally {
      setVoting(null);
    }
  };

  const shellUser = {
    name: profile ? `${profile.first_name} ${profile.last_name}` : (user?.email?.split("@")[0] || "Student"),
    role: "student" as const,
  };

  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} onLogout={async () => signOut()}>

      {/* Native top bar */}
      <TopBar onMenu={openDrawer} schoolName={tenant?.name || ""} />

      {/* Toast */}
      {toast && (
        <View style={[
          styles.toast,
          {
            backgroundColor: toast.type === "error" ? colors.status.errorBg  : colors.status.successBg,
            borderColor:     toast.type === "error" ? colors.status.errorBorder : colors.status.successBorder,
          },
        ]}>
          <Icon
            name={toast.type === "error" ? "status-error" : "status-success"}
            size="sm"
            color={toast.type === "error" ? colors.status.error : colors.status.success}
          />
          <Text style={{ flex: 1, fontSize: fontSize.sm, color: toast.type === "error" ? colors.status.error : colors.status.success, marginLeft: spacing[2] }}>
            {toast.msg}
          </Text>
        </View>
      )}

      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4], paddingBottom: spacing[12] }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={brand.blue}
          />
        }
      >
        {/* Section header */}
        <View>
          <Text variant="heading" color="primary">Elections & Voting</Text>
          <Text variant="caption" color="muted" style={{ marginTop: spacing[1] }}>
            Vote once per election · Results appear when polls close
          </Text>
        </View>

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}>
            <Spinner size="lg" />
          </View>
        ) : elections.length === 0 ? (
          <EmptyState
            icon="nav-voting"
            title="No active elections"
            description="Elections will appear here when opened by your school admin."
          />
        ) : (
          elections.map((el) => {
            const isActive   = el.status === "active";
            const isClosed   = el.status === "closed";
            const hasVoted   = !!myVotes[el.id];
            const myVoteId   = myVotes[el.id];
            const candList   = candidates[el.id] || [];
            const isExpanded = expanded === el.id;
            const totalVotes = isClosed
              ? candList.reduce((s, c) => s + (c.vote_count ?? 0), 0)
              : 0;

            return (
              <Card key={el.id} variant={isActive && !hasVoted ? "brand" : "default"}>
                {/* Election header — tap to expand */}
                <TouchableOpacity onPress={() => setExpanded(isExpanded ? null : el.id)} activeOpacity={0.75}>
                  <View style={[layout.rowBetween, { marginBottom: spacing[1] }]}>
                    <View style={layout.fill}>
                      <Text variant="subtitle" weight="bold" color="primary">{el.title}</Text>
                      {el.position && (
                        <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
                          Position: {el.position}
                        </Text>
                      )}
                    </View>
                    <View style={[layout.row, { gap: spacing[2] }]}>
                      <Badge
                        label={isActive ? "Active" : "Closed"}
                        variant={isActive ? "green" : "gray"}
                        dot={isActive}
                      />
                      <Icon
                        name={isExpanded ? "ui-up" : "ui-down"}
                        size="sm"
                        color={colors.text.muted}
                      />
                    </View>
                  </View>

                  {el.description ? (
                    <Text variant="caption" color="secondary" style={{ marginBottom: spacing[2] }}>
                      {el.description}
                    </Text>
                  ) : null}

                  {/* Scope + date info */}
                  <View style={[layout.row, { gap: spacing[3], flexWrap: "wrap" }]}>
                    <View style={[layout.row, { gap: spacing[1] }]}>
                      <Icon name="nav-social" size="xs" color={colors.text.muted} />
                      <Text style={{ fontSize: fontSize.xs, color: colors.text.muted }}>
                        {el.scope === "all" ? "School-wide" : "Departmental"}
                      </Text>
                    </View>
                    {el.end_date && (
                      <View style={[layout.row, { gap: spacing[1] }]}>
                        <Icon name="nav-calendar" size="xs" color={colors.text.muted} />
                        <Text style={{ fontSize: fontSize.xs, color: colors.text.muted }}>
                          Ends {new Date(el.end_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </Text>
                      </View>
                    )}
                    {isClosed && totalVotes > 0 && (
                      <Text style={{ fontSize: fontSize.xs, color: colors.text.muted }}>
                        {totalVotes} total vote{totalVotes !== 1 ? "s" : ""}
                      </Text>
                    )}
                  </View>

                  {/* Already voted banner */}
                  {hasVoted && (
                    <View style={[styles.votedBanner, { backgroundColor: colors.status.successBg, borderColor: colors.status.successBorder }]}>
                      <Icon name="status-success" size="sm" color={colors.status.success} filled />
                      <Text style={{ fontSize: fontSize.sm, color: colors.status.success, marginLeft: spacing[2] }}>
                        You voted for{" "}
                        <Text style={{ fontWeight: fontWeight.bold }}>
                          {candList.find((c) => c.id === myVoteId)?.full_name ?? "a candidate"}
                        </Text>
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Expanded: candidate list */}
                {isExpanded && (
                  <View style={{ marginTop: spacing[3], gap: spacing[2] }}>
                    {candList.length === 0 ? (
                      <Text variant="caption" color="muted">No approved candidates yet.</Text>
                    ) : (
                      candList.map((cand) => (
                        <CandidateRow
                          key={cand.id}
                          cand={cand}
                          isMyVote={myVoteId === cand.id}
                          isActive={isActive}
                          hasVoted={hasVoted}
                          isVoting={voting === el.id}
                          onVote={() => castVote(el.id, cand.id)}
                          showResults={isClosed}
                          totalVotes={totalVotes}
                          colors={colors}
                        />
                      ))
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
  topBar: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: spacing[4],
    paddingBottom:     spacing[3],
    borderBottomWidth: 1,
    gap:               spacing[3],
  },
  toast: {
    position:          "absolute",
    top:               spacing[4],
    left:              spacing[4],
    right:             spacing[4],
    zIndex:            100,
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
    borderRadius:      radius.lg,
    borderWidth:       1,
  },
  votedBanner: {
    flexDirection: "row",
    alignItems:    "center",
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[2],
    borderRadius:  radius.lg,
    borderWidth:   1,
    marginTop:     spacing[2],
  },
  candRow: {
    flexDirection: "row",
    alignItems:    "flex-start",
    gap:           spacing[3],
    padding:       spacing[3],
    borderRadius:  radius.lg,
    borderWidth:   1,
  },
  voteBar: {
    height:       6,
    borderRadius: radius.full,
    backgroundColor: "rgba(0,0,0,0.08)",
    overflow:     "hidden",
    marginTop:    spacing[2],
  },
  voteBarFill: {
    position:     "absolute",
    left:         0,
    top:          0,
    height:       6,
    borderRadius: radius.full,
  },
});
