import { color } from "@cinch/ui";
import { StyleSheet, Text, View } from "react-native";

export default function FeedTab() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.empty}>When a friend locks something, it lands here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: color.ink, padding: 24, justifyContent: "center" },
  empty: { color: color.paper, fontSize: 20 },
});
