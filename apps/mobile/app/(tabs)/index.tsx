import { color } from "@cinch/ui";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function HomeTab() {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.name}>You</Text>
        <Text style={styles.score}>500</Text>
        <Text style={styles.streak}>0 day streak</Text>
      </View>
      <Text style={styles.hero}>0 pts at stake today</Text>
      <View style={styles.card}>
        <Text style={styles.cardKicker}>NEXT UP</Text>
        <Text style={styles.cardTitle}>Nothing locked yet.</Text>
        <Text style={styles.count}>—</Text>
        <Text style={styles.assume}>A sealed card will live here.</Text>
      </View>
      <Link href="/(tabs)/create" style={styles.composer}>
        <Text style={styles.composerText}>What are you committing to?</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: color.ink, padding: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  name: { color: color.paper, fontSize: 18 },
  score: { color: color.paper, fontVariant: ["tabular-nums"], fontSize: 18 },
  streak: { color: color.signalAmber },
  hero: { color: color.paper, fontSize: 40, fontVariant: ["tabular-nums"], marginBottom: 24 },
  card: { backgroundColor: color.paper, padding: 20, minHeight: 180 },
  cardKicker: { letterSpacing: 2, fontSize: 11 },
  cardTitle: { fontSize: 24, marginVertical: 8, color: color.ink },
  count: { fontSize: 40, fontVariant: ["tabular-nums"], color: color.ink },
  assume: { color: color.inkMuted, marginTop: 8 },
  composer: { marginTop: 24, borderColor: color.paper, borderWidth: 1, padding: 16 },
  composerText: { color: color.paper, fontSize: 16 },
});
