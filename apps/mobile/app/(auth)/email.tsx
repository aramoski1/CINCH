import { color } from "@cinch/ui";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

const api = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export default function EmailScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    const res = await fetch(`${api}/v1/auth/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      setErr("Could not send the code.");
      return;
    }
    router.push({ pathname: "/(auth)/otp", params: { email } });
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>SIGN IN</Text>
      <Text style={styles.title}>Your email. A six-digit code. That’s it.</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@email.com"
        placeholderTextColor="#8a877c"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <Pressable onPress={() => void submit()} style={styles.btn}>
        <Text style={styles.btnLabel}>Send the code</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: color.ink, padding: 28, justifyContent: "center" },
  kicker: { color: color.paper, letterSpacing: 3, fontSize: 12 },
  title: { color: color.paper, fontSize: 32, marginVertical: 20 },
  input: { borderBottomColor: color.paper, borderBottomWidth: 1, color: color.paper, fontSize: 20, paddingVertical: 12 },
  err: { color: color.sealRed, marginTop: 12 },
  btn: { marginTop: 32, borderColor: color.paper, borderWidth: 1, padding: 14, alignSelf: "flex-start" },
  btnLabel: { color: color.paper },
});
