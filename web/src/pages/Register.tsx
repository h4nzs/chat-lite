import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import '../styles/AuthForm.css'; // Import the new CSS
import { FiUser, FiMail, FiLock, FiUserCheck } from 'react-icons/fi';
import RecoveryPhraseModal from "@components/RecoveryPhraseModal";

export default function Register() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'verify'
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const navigate = useNavigate();
  const registerAndGeneratePhrase = useAuthStore((s) => s.registerAndGeneratePhrase);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    // --- Existing comprehensive validation logic ---
    if (!name) { setError("Name is required"); setLoading(false); return; }
    if (name.length > 80) { setError("Name must be less than 80 characters"); setLoading(false); return; }
    if (!username) { setError("Username is required"); setLoading(false); return; }
    if (username.length < 3) { setError("Username must be at least 3 characters"); setLoading(false); return; }
    if (username.length > 32) { setError("Username must be less than 32 characters"); setLoading(false); return; }
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) { setError("Username can only contain letters, numbers, and underscores"); setLoading(false); return; }
    if (!email) { setError("Email is required"); setLoading(false); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setError("Please enter a valid email address"); setLoading(false); return; }
    if (email.length > 200) { setError("Email must be less than 200 characters"); setLoading(false); return; }
    if (!password) { setError("Password is required"); setLoading(false); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); setLoading(false); return; }
    if (password.length > 128) { setError("Password must be less than 128 characters"); setLoading(false); return; }
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[@$!%*?&]/.test(password);
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) { setError("Password must contain at least one uppercase, lowercase, number, and special character"); setLoading(false); return; }
    // --- End of validation logic ---

    try {
      const phrase = await registerAndGeneratePhrase({ name, username, email, password });
      setRecoveryPhrase(phrase);
      setStep('verify');
    } catch (err: any) {
      setError(err.message || "Registration failed. Please check your information and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === 'verify') {
    return <RecoveryPhraseModal phrase={recoveryPhrase} onClose={() => navigate('/')} />
  }

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="form_main">
        <h1 className="text-3xl font-bold text-foreground mb-8">Sign Up</h1>
        {error && <p className="text-red-500 text-sm mb-4 -mt-4 text-center">{error}</p>}
        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
          <div className="inputContainer">
            <FiUserCheck className="inputIcon" />
            <input 
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="inputField"
              disabled={loading}
              required
            />
          </div>
          <div className="inputContainer">
            <FiUser className="inputIcon" />
            <input 
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="inputField"
              disabled={loading}
              required
            />
          </div>
          <div className="inputContainer">
            <FiMail className="inputIcon" />
            <input 
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="inputField"
              disabled={loading}
              required
            />
          </div>
          <div className="inputContainer">
            <FiLock className="inputIcon" />
            <input 
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="inputField"
              disabled={loading}
              required
            />
          </div>
          <button id="button" type="submit" disabled={loading}>
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>
        <div className="signupContainer">
          <p>Already have an account?</p>
          <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
}