import { color } from "@cinch/ui";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function ProfileTab() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.score}>500</Text>
      <Text style={styles.label}>Accountability score</Text>
      <Link href="/(auth)/email" style={styles.link}>
        <Text style={styles.linkText}>Sign in</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: color.ink, padding: 24, justifyContent: "center" },
  score: { color: color.paper, fontSize: 64, fontVariant: ["tabular-nums"] },
  label: { color: color.paper, marginBottom: 24 },
  link: { borderColor: color.paper, borderWidth: 1, padding: 12, alignSelf: "flex-start" },
  linkText: { color: color.paper },
});
