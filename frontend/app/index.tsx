import { Redirect } from "expo-router";
import { useAuth } from "../src/auth";

export default function Index() {
  const { user } = useAuth();
  if (user === undefined) return null;
  if (!user) return <Redirect href="/login" />;
  if (user.role === "monteur") return <Redirect href="/monteur" />;
  if (user.role === "customer") return <Redirect href="/kunde" />;
  return <Redirect href="/hub" />;
}
