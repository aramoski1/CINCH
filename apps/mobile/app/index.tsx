import { CinchApi } from "@cinch/api-client";
import { color } from "@cinch/ui";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const api = new CinchApi(process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000");

export default function HomeScreen() {
  const [status, setStatus] = useState("checking…");

  async function ping() {
    try {
      const health = await api.health();
      setStatus(health.ok ? `API up · ${health.service}` : "API down");
    } catch {
      setStatus("API unreachable");
    }
  }

  useEffect(() => {
    void ping();
  }, []);

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>CINCH</Text>
      <Text style={styles.title}>What are you committing to?</Text>
      <Text style={styles.status}>{status}</Text>
      <Pressable onPress={() => void ping()} style={styles.btn} accessibilityRole="button">
        <Text style={styles.btnLabel}>Ping API</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: color.ink, padding: 32, justifyContent: "center" },
  kicker: { color: color.paper, letterSpacing: 3, fontSize: 12, marginBottom: 16 },
  title: { color: color.paper, fontSize: 36, fontWeight: "400", marginBottom: 24 },
  status: { color: color.signalAmber, fontSize: 16, fontVariant: ["tabular-nums"] },
  btn: {
    marginTop: 32,
    alignSelf: "flex-start",
    borderColor: color.paper,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  btnLabel: { color: color.paper, letterSpacing: 1 },
});
