import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const auth = Object.values(config).every(Boolean)
  ? getAuth(initializeApp(config))
  : null;
export async function googleSignIn() {
  if (!auth)
    throw new Error(
      "Googleログインは準備中です。公開単語帳はログインせずに閲覧・学習できます。",
    );
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(auth, provider);
}
