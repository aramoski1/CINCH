import { color } from "@cinch/ui";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const api = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export default function CreateTab() {
  const [utterance, setUtterance] = useState("");
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [title, setTitle] = useState("");

  async function parse() {
    const res = await fetch(`${api}/v1/commitments/parse`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ utterance }),
    });
    if (!res.ok) return;
    const body = (await res.json()) as { rendered?: string; assumptions?: string[]; message?: string };
    setTitle(body.rendered ?? body.message ?? "");
    setAssumptions(body.assumptions ?? []);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Say it once.</Text>
      <TextInput
        multiline
        placeholder="Gym by 6:30 tomorrow or I owe Ryan 2500 points"
        placeholderTextColor="#8a877c"
        style={styles.input}
        value={utterance}
        onChangeText={setUtterance}
      />
      <Pressable onPress={() => void parse()} style={styles.btn}>
        <Text style={styles.btnLabel}>Parse</Text>
      </Pressable>
      {title ? <Text style={styles.out}>{title}</Text> : null}
      {assumptions.map((a) => (
        <Text key={a} style={styles.assume}>
          I assumed: {a}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: color.ink, padding: 20 },
  title: { color: color.paper, fontSize: 28, marginBottom: 16 },
  input: { minHeight: 120, color: color.paper, borderColor: color.paper, borderWidth: 1, padding: 12, fontSize: 18 },
  btn: { marginTop: 16, borderColor: color.paper, borderWidth: 1, padding: 12, alignSelf: "flex-start" },
  btnLabel: { color: color.paper },
  out: { color: color.paper, marginTop: 24, fontSize: 18 },
  assume: { color: color.signalAmber, marginTop: 8 },
});
