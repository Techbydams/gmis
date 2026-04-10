/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useRef } from "react";
import {
  View, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter }  from "expo-router";
import { useAuth }    from "@/context/AuthContext";
import { useTenant }  from "@/context/TenantContext";
import { Text }       from "@/components/ui/Text";
import { Icon }       from "@/components/ui/Icon";
import { AppShell }   from "@/components/layout";
import { useTheme }   from "@/context/ThemeContext";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }     from "@/styles/shared";

interface Message { id: string; role: "user" | "assistant"; content: string; }

const SUGGESTIONS = [
  "How do I calculate my CGPA?",
  "What documents do I need for clearance?",
  "When is the course registration deadline?",
  "How do I dispute a result?",
];

export default function AIAssistant() {
  const router            = useRouter();
  const { user, signOut } = useAuth();
  const { tenant }        = useTenant();
  const { colors }        = useTheme();

  const [messages, setMessages] = useState<Message[]>([
    { id: "0", role: "assistant", content: `Hello! I'm your GMIS AI Assistant. Ask me anything about ${tenant?.name || "your institution"} — results, payments, clearance, or any academic question.` },
  ]);
  const [input,   setInput]   = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const shellUser = { name: user?.email || "Student", role: "student" as const };

  const send = async (text = input.trim()) => {
    if (!text || sending) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    // Simulated assistant response (replace with real AI call when integrated)
    await new Promise((r) => setTimeout(r, 800));
    const reply: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "I'm currently in preview mode. Full AI capabilities will be enabled soon. In the meantime, visit your Admin office or check the relevant portal section for assistance.",
    };
    setMessages((m) => [...m, reply]);
    setSending(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <AppShell
      role="student"
      user={shellUser}
      schoolName={tenant?.name || ""}
      pageTitle="AI Assistant"
      onLogout={async () => { await signOut(); router.replace("/login"); }}
    >
      <KeyboardAvoidingView
        style={layout.fill}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Chat messages */}
        <ScrollView
          ref={scrollRef}
          style={[layout.fill, { backgroundColor: colors.bg.primary }]}
          contentContainerStyle={{ padding: spacing[5], paddingBottom: spacing[4], gap: spacing[3] }}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.bubble,
                msg.role === "user"
                  ? [styles.userBubble, { backgroundColor: brand.blue }]
                  : [styles.aiBubble, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }],
              ]}
            >
              {msg.role === "assistant" && (
                <View style={[styles.aiAvatar, { backgroundColor: brand.blueAlpha15 }]}>
                  <Icon name="nav-ai" size="sm" color={brand.blue} />
                </View>
              )}
              <Text
                variant="body"
                style={{
                  color:   msg.role === "user" ? "#ffffff" : colors.text.primary,
                  flex: 1,
                }}
              >
                {msg.content}
              </Text>
            </View>
          ))}

          {sending && (
            <View style={[styles.bubble, styles.aiBubble, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}>
              <View style={[styles.aiAvatar, { backgroundColor: brand.blueAlpha15 }]}>
                <Icon name="nav-ai" size="sm" color={brand.blue} />
              </View>
              <Text variant="caption" color="muted">Thinking...</Text>
            </View>
          )}

          {/* Suggestions */}
          {messages.length === 1 && (
            <View style={{ gap: spacing[2], marginTop: spacing[2] }}>
              <Text variant="caption" color="muted" style={{ marginBottom: spacing[1] }}>Try asking:</Text>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => send(s)}
                  activeOpacity={0.75}
                  style={[styles.suggestion, { backgroundColor: colors.bg.card, borderColor: colors.border.brand }]}
                >
                  <Text variant="caption" color="link">{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Input row */}
        <View style={[styles.inputRow, { backgroundColor: colors.bg.card, borderTopColor: colors.border.DEFAULT }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
            placeholder="Ask anything…"
            placeholderTextColor={colors.text.muted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => send()}
            returnKeyType="send"
            multiline
          />
          <TouchableOpacity
            onPress={() => send()}
            activeOpacity={0.8}
            disabled={!input.trim() || sending}
            style={[styles.sendBtn, { backgroundColor: input.trim() ? brand.blue : colors.bg.hover }]}
          >
            <Icon name="ui-forward" size="md" color={input.trim() ? "#fff" : colors.text.muted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: "row", alignItems: "flex-start",
    gap: spacing[3], padding: spacing[4],
    borderRadius: radius.xl, maxWidth: "90%",
  },
  userBubble: { alignSelf: "flex-end", borderRadius: radius.xl },
  aiBubble:   { alignSelf: "flex-start", borderWidth: 1 },
  aiAvatar: {
    width: spacing[8], height: spacing[8],
    borderRadius: radius.full, alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  suggestion: {
    padding: spacing[3], borderRadius: radius.lg, borderWidth: 1,
  },
  inputRow: {
    flexDirection: "row", alignItems: "flex-end",
    gap: spacing[2], padding: spacing[3],
    borderTopWidth: 1,
  },
  input: {
    flex: 1, paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderRadius: radius.xl, borderWidth: 1,
    fontSize: fontSize.md, maxHeight: 100,
  },
  sendBtn: {
    width: spacing[10], height: spacing[10],
    borderRadius: radius.full, alignItems: "center", justifyContent: "center",
  },
});
