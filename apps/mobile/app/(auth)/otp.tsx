import { color } from "@cinch/ui";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const api = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export default function OtpScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  async function submit() {
    const res = await fetch(`${api}/v1/auth/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code, displayName: name || undefined }),
    });
    if (res.ok) router.replace("/");
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Six digits.</Text>
      <TextInput
        keyboardType="number-pad"
        maxLength={6}
        style={styles.input}
        value={code}
        onChangeText={setCode}
      />
      <TextInput
        placeholder="What should we call you?"
        placeholderTextColor="#8a877c"
        style={styles.input}
        value={name}
        onChangeText={setName}
      />
      <Pressable onPress={() => void submit()} style={styles.btn}>
        <Text style={styles.btnLabel}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: color.ink, padding: 28, justifyContent: "center" },
  title: { color: color.paper, fontSize: 32, marginBottom: 24 },
  input: { borderBottomColor: color.paper, borderBottomWidth: 1, color: color.paper, fontSize: 22, marginBottom: 20 },
  btn: { borderColor: color.paper, borderWidth: 1, padding: 14, alignSelf: "flex-start" },
  btnLabel: { color: color.paper },
});
