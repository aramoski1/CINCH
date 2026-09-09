import { color } from "@cinch/ui";
import { StyleSheet, Text, View } from "react-native";

export default function CapturePlace() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Capture current location</Text>
      <Text style={styles.body}>
        Dev only. Foreground GPS, no Google Places. Walk to the door, stamp the pin, it becomes a seeded place.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: color.ink, padding: 24, justifyContent: "center" },
  title: { color: color.paper, fontSize: 28, marginBottom: 12 },
  body: { color: color.paper, fontSize: 16, lineHeight: 22 },
});
