import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import AuthForm from "../components/AuthForm";
import RecoveryPhraseModal from "@components/RecoveryPhraseModal";

export default function Register() {
  const [error, setError] = useState("");
  const [step, setStep] = useState('form'); // 'form' | 'verify'
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const navigate = useNavigate();
  const registerAndGeneratePhrase = useAuthStore((s) => s.registerAndGeneratePhrase);

  async function handleRegister(data: { name?: string, d?: string, c?: string, b?: string }) {
    const { name, d: username, c: email, b: password } = data;
    setError("");

    // --- Existing comprehensive validation logic ---
    if (!name) { throw new Error("Name is required"); }
    if (name.length > 80) { throw new Error("Name must be less than 80 characters"); }
    if (!username) { throw new Error("Username is required"); }
    if (username.length < 3) { throw new Error("Username must be at least 3 characters"); }
    if (username.length > 32) { throw new Error("Username must be less than 32 characters"); }
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) { throw new Error("Username can only contain letters, numbers, and underscores"); }
    if (!email) { throw new Error("Email is required"); }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { throw new Error("Please enter a valid email address"); }
    if (email.length > 200) { throw new Error("Email must be less than 200 characters"); }
    if (!password) { throw new Error("Password is required"); }
    if (password.length < 8) { throw new Error("Password must be at least 8 characters"); }
    if (password.length > 128) { throw new Error("Password must be less than 128 characters"); }
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[@$!%*?&]/.test(password);
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) { throw new Error("Password must contain at least one uppercase, lowercase, number, and special character"); }
    // --- End of validation logic ---

    const phrase = await registerAndGeneratePhrase({ name, username, email, password });
    setRecoveryPhrase(phrase);
    setStep('verify');
  }

  if (step === 'verify') {
    return <RecoveryPhraseModal phrase={recoveryPhrase} onClose={() => navigate('/')} />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-main p-4">
      <div className="w-full max-w-md bg-bg-surface rounded-xl p-8 shadow-neumorphic-concave">
        <h1 className="text-3xl font-bold text-center text-foreground mb-6">Register</h1>
        <AuthForm 
          onSubmit={handleRegister}
          button="Sign Up"
        />
        <div className="text-center mt-6">
          <p className="text-text-secondary">
            Already have an account? <Link to="/login" className="font-semibold text-accent hover:underline">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}