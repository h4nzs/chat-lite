import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import '../styles/AuthForm.css'; // Import the new CSS
import { FiUser, FiLock } from 'react-icons/fi';
import { IoFingerPrint } from "react-icons/io5";

export default function Login() {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isBiometricsAvailable, setIsBiometricsAvailable] = useState(false);
  const navigate = useNavigate();
  const { login, loginWithBiometrics } = useAuthStore(s => ({ login: s.login, loginWithBiometrics: s.loginWithBiometrics }));

  useEffect(() => {
    if (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(setIsBiometricsAvailable);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!emailOrUsername || !password) {
      setError("Both fields are required.");
      return;
    }
    
    setLoading(true);
    try {
      await login(emailOrUsername, password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometricLogin() {
    setError("");
    if (!emailOrUsername) {
      setError("Please enter your username or email first to use biometrics.");
      return;
    }
    setLoading(true);
    try {
      await loginWithBiometrics(emailOrUsername);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Biometric login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="form_main">
        <p className="heading">Login</p>
        {error && <p className="text-red-500 text-sm mb-4 -mt-4 text-center">{error}</p>}
        <form onSubmit={handleSubmit} className="w-full flex flex-col items-center">
          <div className="inputContainer">
            <FiUser className="inputIcon" />
            <input 
              type="text"
              placeholder="Email or Username"
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
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
            {loading ? "Logging in..." : "Login"}
          </button>
          {isBiometricsAvailable && (
            <button 
              type="button"
              onClick={handleBiometricLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 mt-4 p-2.5 rounded-full bg-secondary text-text-primary hover:bg-secondary/80 transition-colors disabled:opacity-50"
            >
              <IoFingerPrint />
              <span>Login with Biometrics</span>
            </button>
          )}
        </form>
        <div className="signupContainer">
          <p>Don't have an account?</p>
          <Link to="/register">Sign up</Link>
        </div>
        <div className="text-center mt-4">
          <Link to="/restore" className="text-sm text-accent-color hover:underline">Restore from phrase</Link>
        </div>
      </div>
    </div>
  );
}