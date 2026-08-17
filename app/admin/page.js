"use client";

import { useState } from "react";
import LoginForm from "./login-form";
import AdminDashboard from "./admin-dashboard";

// The admin page always starts at the sign-in stage. Because the
// "authenticated" flag lives only in React state (not in a persisted
// session check), a full refresh or a browser-back navigation re-mounts
// this component and returns the user to sign-in.
export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [authed, setAuthed] = useState(false);

  if (!authed) {
    return (
      <LoginForm
        onSuccess={(userEmail) => {
          setEmail(userEmail);
          setAuthed(true);
        }}
      />
    );
  }

  return <AdminDashboard email={email} onSignOut={() => setAuthed(false)} />;
}
