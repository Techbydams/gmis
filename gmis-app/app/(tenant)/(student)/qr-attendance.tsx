// ============================================================
// GMIS — Student QR Attendance Scanner
// Route: /(tenant)/(student)/qr-attendance
//
// Flow: Student opens camera → scans lecturer-generated QR
//       QR payload: { qr_id, course_id, class_date }
//       Validates: active QR, not expired, not already scanned
//       Device fingerprint prevents same device marking twice
//       Inserts into attendance_records with status="present"
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo, useRef } from "react";
import {
  View, TouchableOpacity, StyleSheet, Vibration, Platform, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
// expo-camera crashes on web — guard with Platform check before importing
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { Text, Spinner, Input, Button } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme } from "@/context/ThemeContext";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

// Lazy-load expo-camera only on native (crashes on web)
let CameraView: any = null;
let useCameraPermissions: any = null;
if (Platform.OS !== "web") {
  const cam = require("expo-camera");
  CameraView          = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
}

// ── Device fingerprint ────────────────────────────────────
// A UUID stored in AsyncStorage — unique per device install.
// Prevents the same device from scanning attendance for multiple
// student accounts on the same course + date.
const DEVICE_KEY = "gmis:device_fingerprint";

async function getDeviceFingerprint(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  // Generate a UUID v4
  const uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
  await AsyncStorage.setItem(DEVICE_KEY, uuid);
  return uuid;
}

type ScanState = "idle" | "scanning" | "loading" | "success" | "error";

// ── Top bar ─────────────────────────────────────────────────
function TopBar({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const insets     = useSafeAreaInsets();
  return (
    <View style={[styles.topBar, {
      backgroundColor: colors.bg.card,
      borderBottomColor: colors.border.DEFAULT,
      paddingTop: insets.top + spacing[2],
    }]}>
      <TouchableOpacity onPress={onBack} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Icon name="ui-back" size="md" color={colors.text.secondary} />
      </TouchableOpacity>
      <View style={layout.fill}>
        <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text.primary }}>
          QR Attendance
        </Text>
        <Text style={{ fontSize: fontSize.xs, color: colors.text.muted }}>
          Scan the lecturer's QR code
        </Text>
      </View>
    </View>
  );
}

// ── Scan result overlay ──────────────────────────────────────
function ResultOverlay({
  state, message, courseName, onScanAgain,
}: { state: ScanState; message: string; courseName?: string; onScanAgain: () => void }) {
  if (state === "idle" || state === "scanning") return null;
  if (state === "loading") {
    return (
      <View style={styles.resultOverlay}>
        <Spinner size="lg" color="#fff" />
        <Text style={{ color: "#fff", fontSize: fontSize.md, marginTop: spacing[3] }}>Marking attendance…</Text>
      </View>
    );
  }

  const isSuccess = state === "success";
  return (
    <View style={[styles.resultOverlay, { backgroundColor: isSuccess ? "#10b98180" : "#ef444480" }]}>
      <View style={[styles.resultIcon, { backgroundColor: isSuccess ? "#10b981" : "#ef4444" }]}>
        <Icon name={isSuccess ? "ui-check" : "status-warning"} size="2xl" color="#fff" />
      </View>
      <Text style={{ color: "#fff", fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginTop: spacing[3], textAlign: "center" }}>
        {isSuccess ? "Attendance Marked!" : "Scan Failed"}
      </Text>
      {courseName && (
        <Text style={{ color: "#ffffffcc", fontSize: fontSize.sm, marginTop: spacing[1], textAlign: "center" }}>
          {courseName}
        </Text>
      )}
      <Text style={{ color: "#ffffffcc", fontSize: fontSize.sm, marginTop: spacing[2], textAlign: "center", paddingHorizontal: spacing[6] }}>
        {message}
      </Text>
      <TouchableOpacity
        onPress={onScanAgain}
        activeOpacity={0.8}
        style={[styles.rescanBtn, { backgroundColor: "#fff" }]}
      >
        <Text style={{ color: isSuccess ? "#10b981" : "#ef4444", fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>
          {isSuccess ? "Done" : "Try Again"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Web fallback ─────────────────────────────────────────────
// On web, expo-camera is unavailable. Students can enter the
// attendance code manually (lecturer reads it out or displays it).
function WebAttendanceFallback({
  onSubmit, loading, onBack,
}: { onSubmit: (code: string) => void; loading: boolean; onBack: () => void }) {
  const { colors } = useTheme();
  const [code, setCode] = useState("");
  const [err,  setErr]  = useState("");

  const handleSubmit = () => {
    const v = code.trim();
    if (!v) { setErr("Enter the attendance code provided by your lecturer."); return; }
    setErr("");
    onSubmit(v);
  };

  return (
    <View style={[layout.fill, { backgroundColor: colors.bg.primary, padding: spacing[6] }]}>
      <View style={[styles.webIconCircle, { backgroundColor: brand.blueAlpha10 }]}>
        <Icon name="content-qr" size="3xl" color={brand.blue} />
      </View>
      <Text style={{ fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text.primary, textAlign: "center", marginTop: spacing[4] }}>
        Attendance Code Entry
      </Text>
      <Text style={{ fontSize: fontSize.sm, color: colors.text.muted, textAlign: "center", marginTop: spacing[2], marginBottom: spacing[6], lineHeight: 22 }}>
        QR scanning is available on the GMIS mobile app.{"\n"}
        Enter the code your lecturer provides, or use the mobile app to scan.
      </Text>

      <View style={[styles.webInfoBanner, { backgroundColor: colors.status.infoBg, borderColor: colors.status.infoBorder }]}>
        <Icon name="status-info" size="sm" color={colors.status.info} />
        <Text style={{ flex: 1, fontSize: fontSize.xs, color: colors.status.info, marginLeft: spacing[2], lineHeight: 18 }}>
          Ask your lecturer for the 6-digit or text attendance code if they have one.
        </Text>
      </View>

      <View style={{ marginTop: spacing[5] }}>
        <Input
          label="Attendance code"
          value={code}
          onChangeText={(v) => { setCode(v); setErr(""); }}
          onSubmitEditing={handleSubmit}
          placeholder="Enter code from lecturer"
          autoCapitalize="none"
          iconLeft="content-qr"
          error={err}
        />
      </View>

      <Button
        label={loading ? "Marking attendance..." : "Submit code"}
        variant="primary"
        size="lg"
        full
        loading={loading}
        onPress={handleSubmit}
        style={{ marginTop: spacing[2] }}
      />

      <TouchableOpacity onPress={onBack} style={{ marginTop: spacing[4], alignItems: "center" }} activeOpacity={0.7}>
        <Text style={{ fontSize: fontSize.sm, color: colors.text.secondary }}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────
export default function QRAttendance() {
  const router           = useRouter();
  const { user }         = useAuth();
  const { tenant, slug } = useTenant();
  const { colors }       = useTheme();

  // On web, useCameraPermissions is null — we skip camera entirely
  const permHook = useCameraPermissions ? useCameraPermissions() : [null, null];
  const [permission, requestPermission] = permHook as any;

  const [studentId,  setStudentId]      = useState<string | null>(null);
  const [deviceId,   setDeviceId]       = useState<string>("");
  const [scanState,  setScanState]      = useState<ScanState>("idle");
  const [resultMsg,  setResultMsg]      = useState("");
  const [courseName, setCourseName]     = useState("");
  const [webLoading, setWebLoading]     = useState(false);
  const [webResult,  setWebResult]      = useState<{ ok: boolean; msg: string } | null>(null);

  const scanLockRef = useRef(false);

  const db = useMemo(() =>
    tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null,
  [tenant, slug]);

  useEffect(() => {
    // On web, still load studentId so we can process manual codes
    if (db && user) init();
  }, [db, user]);

  const init = async () => {
    if (!db || !user) return;
    const [{ data }, fp] = await Promise.all([
      db.from("students").select("id").eq("supabase_uid", user.id).maybeSingle(),
      getDeviceFingerprint(),
    ]);
    setStudentId((data as any)?.id ?? null);
    setDeviceId(fp);
    setScanState("scanning");
  };

  const handleQRScanned = async ({ data }: { data: string }) => {
    if (scanLockRef.current || scanState !== "scanning") return;
    scanLockRef.current = true;
    setScanState("loading");

    try {
      let payload: { qr_id?: string; course_id?: string; class_date?: string };
      try { payload = JSON.parse(data); } catch {
        setResultMsg("Invalid QR code. Please scan the QR generated by your lecturer.");
        setScanState("error"); return;
      }

      if (!payload.qr_id || !payload.course_id || !payload.class_date) {
        setResultMsg("QR code is not a valid GMIS attendance code.");
        setScanState("error"); return;
      }

      if (!db || !studentId || !deviceId) {
        setResultMsg("Student record not found. Please log out and log in again.");
        setScanState("error"); return;
      }

      // ── 1. Validate QR in database ───────────────────────
      const { data: qr } = await db
        .from("qr_codes")
        .select("id, course_id, class_date, expires_at, is_active, used_count, courses(course_code, course_name)")
        .eq("id", payload.qr_id)
        .eq("is_active", true)
        .maybeSingle();

      if (!qr) {
        setResultMsg("QR code not found or has been deactivated by your lecturer.");
        setScanState("error"); return;
      }

      const qrAny = qr as any;

      if (qrAny.expires_at && new Date(qrAny.expires_at) < new Date()) {
        setResultMsg("This QR code has expired. Ask your lecturer to generate a new one.");
        setScanState("error"); return;
      }

      if (qrAny.class_date !== payload.class_date) {
        setResultMsg("QR code date mismatch. Please scan the correct code for today.");
        setScanState("error"); return;
      }

      const cname = qrAny.courses?.course_name
        ? `${qrAny.courses.course_code} — ${qrAny.courses.course_name}`
        : qrAny.courses?.course_code || "";
      setCourseName(cname);

      const today = payload.class_date;

      // ── 2. Device-based duplicate check ─────────────────
      // Prevent the same physical device from marking attendance
      // for more than one student account per course per day.
      const { data: deviceCheck } = await db
        .from("attendance_records")
        .select("id, student_id")
        .eq("device_id", deviceId)
        .eq("course_id", payload.course_id)
        .eq("class_date", today)
        .maybeSingle();

      if (deviceCheck) {
        const dcAny = deviceCheck as any;
        if (dcAny.student_id !== studentId) {
          // A DIFFERENT account already used this device for this class
          setResultMsg("This device has already been used to mark attendance for this class today. Each device can only register one student per class.");
          setScanState("error"); return;
        }
        // Same student already marked — treat as success
        setResultMsg("Your attendance was already marked for this class today.");
        setScanState("success");
        Vibration.vibrate(200);
        return;
      }

      // ── 3. Student-based duplicate check ────────────────
      const { data: existing } = await db
        .from("attendance_records")
        .select("id, status")
        .eq("student_id", studentId)
        .eq("course_id", payload.course_id)
        .eq("class_date", today)
        .maybeSingle();

      if (existing) {
        const exAny = existing as any;
        if (exAny.status === "present") {
          setResultMsg("Your attendance was already marked for this class today.");
          setScanState("success");
          Vibration.vibrate(200); return;
        }
        // Update to present + set device_id
        await db.from("attendance_records")
          .update({ status: "present", device_id: deviceId } as any)
          .eq("id", exAny.id);
      } else {
        // ── 4. Insert new record ─────────────────────────
        const { error: insErr } = await db
          .from("attendance_records")
          .insert({
            student_id: studentId,
            course_id:  payload.course_id,
            class_date: today,
            status:     "present",
            device_id:  deviceId,
          } as any);

        if (insErr) {
          setResultMsg(`Failed to mark attendance: ${insErr.message}`);
          setScanState("error"); return;
        }
      }

      // ── 5. Increment used_count ──────────────────────────
      await db.from("qr_codes")
        .update({ used_count: (qrAny.used_count || 0) + 1 } as any)
        .eq("id", payload.qr_id);

      setResultMsg("Your attendance has been successfully recorded.");
      setScanState("success");
      Vibration.vibrate([0, 100, 50, 100]);
    } catch (e: any) {
      setResultMsg(e?.message || "An unexpected error occurred. Please try again.");
      setScanState("error");
    }
  };

  const resetScan = () => {
    if (scanState === "success") { router.back(); return; }
    scanLockRef.current = false;
    setResultMsg(""); setCourseName("");
    setScanState("scanning");
  };

  // Web: handle manually typed attendance code
  const handleWebCode = async (code: string) => {
    setWebLoading(true); setWebResult(null);
    try {
      await handleQRScanned({ data: code });
      // scanState will be set by handleQRScanned — mirror into webResult
      // Give a brief moment for state to settle
      await new Promise((r) => setTimeout(r, 200));
      setWebResult({ ok: scanState === "success", msg: resultMsg || (scanState === "success" ? "Attendance marked!" : "Failed. Check the code and try again.") });
    } catch (e: any) {
      setWebResult({ ok: false, msg: e?.message || "Unexpected error." });
    } finally {
      setWebLoading(false);
    }
  };

  const shellUser = { name: user?.email?.split("@")[0] || "Student", role: "student" as const };

  // ── Web: no camera API — show manual code entry ──────────
  if (Platform.OS === "web") {
    return (
      <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""}>
        <TopBar onBack={() => router.back()} />
        {webResult ? (
          <View style={[layout.fill, layout.centred, { padding: spacing[6] }]}>
            <View style={[styles.resultIcon, { backgroundColor: webResult.ok ? "#10b981" : "#ef4444" }]}>
              <Icon name={webResult.ok ? "ui-check" : "status-warning"} size="2xl" color="#fff" />
            </View>
            <Text style={{ fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text.primary, textAlign: "center", marginTop: spacing[4] }}>
              {webResult.ok ? "Attendance Marked!" : "Failed"}
            </Text>
            <Text style={{ fontSize: fontSize.sm, color: colors.text.secondary, textAlign: "center", marginTop: spacing[2], marginBottom: spacing[6] }}>
              {webResult.msg}
            </Text>
            <TouchableOpacity onPress={() => router.back()} style={[styles.permBtn, { backgroundColor: webResult.ok ? "#10b981" : brand.blue }]} activeOpacity={0.8}>
              <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebAttendanceFallback
            loading={webLoading}
            onSubmit={handleWebCode}
            onBack={() => router.back()}
          />
        )}
      </AppShell>
    );
  }

  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""}>
      <TopBar onBack={() => router.back()} />

      <View style={[layout.fill, { backgroundColor: "#000" }]}>
        {!permission ? (
          <View style={[layout.fill, layout.centred]}><Spinner size="lg" color="#fff" /></View>
        ) : !permission.granted ? (
          <View style={[layout.fill, layout.centred, { padding: spacing[6] }]}>
            <Icon name="action-camera" size="3xl" color="#fff" />
            <Text style={{ color: "#fff", fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: "center", marginTop: spacing[4] }}>
              Camera Access Required
            </Text>
            <Text style={{ color: "#ffffff99", fontSize: fontSize.sm, textAlign: "center", marginTop: spacing[2], marginBottom: spacing[6] }}>
              GMIS needs camera access to scan attendance QR codes.
            </Text>
            <TouchableOpacity onPress={requestPermission} activeOpacity={0.8}
              style={[styles.permBtn, { backgroundColor: brand.blue }]}>
              <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>Allow Camera Access</Text>
            </TouchableOpacity>
          </View>
        ) : scanState === "idle" ? (
          <View style={[layout.fill, layout.centred]}>
            <Spinner size="lg" color="#fff" />
            <Text style={{ color: "#fff", marginTop: spacing[3] }}>Loading your profile…</Text>
          </View>
        ) : (
          <>
            <CameraView
              style={layout.fill}
              facing="back"
              onBarcodeScanned={scanState === "scanning" ? handleQRScanned : undefined}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            >
              <View style={styles.viewfinderContainer}>
                <View style={styles.viewfinder}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <Text style={styles.scanHint}>
                  {scanState === "scanning" ? "Point at the lecturer's QR code" : ""}
                </Text>
              </View>
            </CameraView>

            <ResultOverlay
              state={scanState}
              message={resultMsg}
              courseName={courseName}
              onScanAgain={resetScan}
            />
          </>
        )}
      </View>
    </AppShell>
  );
}

const CORNER = 28;
const BORDER = 4;
const FINDER = 220;

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing[4], paddingBottom: spacing[3],
    borderBottomWidth: 1, gap: spacing[3],
  },
  viewfinderContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  viewfinder: { width: FINDER, height: FINDER, position: "relative" },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: brand.blue, borderWidth: BORDER },
  cornerTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: radius.md },
  cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: radius.md },
  cornerBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: radius.md },
  cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: radius.md },
  scanHint: { color: "#ffffffcc", fontSize: fontSize.sm, textAlign: "center", marginTop: spacing[6] },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "#00000099",
    alignItems: "center", justifyContent: "center", padding: spacing[6],
  },
  resultIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  rescanBtn: { marginTop: spacing[6], paddingHorizontal: spacing[8], paddingVertical: spacing[3], borderRadius: radius.full },
  permBtn: { paddingHorizontal: spacing[8], paddingVertical: spacing[4], borderRadius: radius.full },
  webIconCircle: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  webInfoBanner: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: spacing[3], paddingVertical: spacing[2] + spacing[1], borderRadius: radius.lg, borderWidth: 1 },
});
