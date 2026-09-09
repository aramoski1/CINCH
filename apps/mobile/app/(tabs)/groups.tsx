import { color } from "@cinch/ui";
import { StyleSheet, Text, View } from "react-native";

export default function GroupsTab() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.empty}>Groups of 3–8. Forfeits go to charity, never the pot.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: color.ink, padding: 24, justifyContent: "center" },
  empty: { color: color.paper, fontSize: 20 },
});
