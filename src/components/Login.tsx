import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Mail, Lock, AlertCircle, Loader2, UserPlus, Eye, MapPin, User, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const Login: React.FC = () => {
  const { setViewerMode } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [managingLocation, setManagingLocation] = useState('');
  const [locations, setLocations] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    const defaultLocs = ["Alijis"];
    const unsub = onSnapshot(collection(db, "stations"), (snapshot) => {
      const locs = snapshot.docs.map(doc => doc.data().name);
      if (locs.length > 0) {
        setLocations(locs);
        if (!managingLocation) setManagingLocation(locs[0]);
      } else {
        setLocations(defaultLocs);
        if (!managingLocation) setManagingLocation(defaultLocs[0]);
      }
    }, (err) => {
      console.error("Failed to fetch locations from Firestore:", err);
      setLocations(defaultLocs);
      setManagingLocation(defaultLocs[0]);
    });

    return () => unsub();
  }, [managingLocation]);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Google Auth error:', err);
      setError(err.message || 'Google Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
      setError('Password reset email sent! Please check your inbox.');
    } catch (err: any) {
      console.error('Reset error:', err);
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else if (authMode === 'signup') {
        // Sign Up
        if (password.length < 6) {
          throw { code: 'auth/weak-password', message: 'Password should be at least 6 characters.' };
        }
        
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = userCredential.user;

        // Create admin profile in Firestore
        await setDoc(doc(db, 'admins', user.uid), {
          uid: user.uid,
          email: user.email,
          name: name.trim(),
          role: user.email === 'trishiagayem18@gmail.com' ? 'main' : 'admin',
          status: user.email === 'trishiagayem18@gmail.com' ? 'approved' : 'pending',
          managingLocation: managingLocation,
          createdAt: new Date().toISOString()
        });

        if (user.email === 'trishiagayem18@gmail.com') {
          setError('Main Admin account created! You are now being logged in...');
        } else {
          setError('Account created! Please wait for the Main Admin to approve your access.');
          setAuthMode('login');
        }
      }
    } catch (err: any) {
      console.error('Auth error details:', err);
      let message = '';
      
      // Handle Firebase error codes
      const errorCode = err.code || (err.message?.includes('auth/') ? err.message.match(/auth\/[a-z-]+/)?.[0] : null);
      
      switch (errorCode) {
        case 'auth/invalid-credential':
          message = 'Incorrect email or password. If you haven\'t signed up yet, please click "New Admin? Sign Up" below.';
          break;
        case 'auth/user-not-found':
          message = 'No account found with this email. Please sign up first.';
          break;
        case 'auth/wrong-password':
          message = 'Incorrect password. Please try again.';
          break;
        case 'auth/email-already-in-use':
          message = 'This email is already registered. Please try logging in instead.';
          break;
        case 'auth/weak-password':
          message = 'Password is too weak. It must be at least 6 characters.';
          break;
        case 'auth/invalid-email':
          message = 'The email address is not valid.';
          break;
        case 'auth/too-many-requests':
          message = 'Too many failed attempts. Please try again later or reset your password.';
          break;
        case 'auth/network-request-failed':
          message = 'Network error. Please check your internet connection.';
          break;
        default:
          message = err.message || 'Authentication failed. Please try again.';
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F7FF] p-4 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#6A59CC]/5 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#6A59CC]/5 rounded-full blur-3xl" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-8 rounded-[2.5rem] shadow-2xl border border-[#EEEEEE] relative z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex p-4 bg-[#6A59CC] rounded-3xl mb-4 shadow-lg shadow-[#6A59CC]/20">
            {authMode === 'login' ? <LogIn className="text-white w-8 h-8" /> : 
             authMode === 'signup' ? <UserPlus className="text-white w-8 h-8" /> :
             <KeyRound className="text-white w-8 h-8" />}
          </div>
          <h2 className="text-3xl font-black text-[#6A59CC]">
            {authMode === 'login' ? 'Admin Access' : 
             authMode === 'signup' ? 'Admin Registration' :
             'Reset Password'}
          </h2>
          <p className="text-sm text-[#7F8C8D] font-bold mt-2">
            {authMode === 'login' ? 'Sign in to manage PawFeeds' : 
             authMode === 'signup' ? 'Apply for an admin account' :
             'Recover your admin access'}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`mb-6 p-4 rounded-2xl flex items-start gap-3 text-sm font-medium ${
                error.includes('created') || error.includes('sent') ? 'bg-emerald-50 border border-emerald-100 text-emerald-600' : 'bg-rose-50 border border-rose-100 text-rose-600'
              }`}
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={authMode === 'forgot' ? handleResetPassword : handleSubmit} className="space-y-4">
          {authMode === 'signup' && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-black text-[#7F8C8D] uppercase tracking-widest ml-1">Full Name</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7F8C8D] group-focus-within:text-[#6A59CC] transition-colors" />
                  <input 
                    type="text" 
                    required
                    placeholder="John Doe"
                    className="w-full pl-12 pr-6 py-4 rounded-2xl border border-[#EEEEEE] outline-none focus:ring-2 focus:ring-[#6A59CC]/20 focus:border-[#6A59CC] transition-all bg-[#F8F7FF]"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-[#7F8C8D] uppercase tracking-widest ml-1">Assigned Location</label>
                <div className="relative group">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7F8C8D] group-focus-within:text-[#6A59CC] transition-colors" />
                  <select 
                    required
                    className="w-full pl-12 pr-6 py-4 rounded-2xl border border-[#EEEEEE] outline-none focus:ring-2 focus:ring-[#6A59CC]/20 focus:border-[#6A59CC] transition-all bg-[#F8F7FF] appearance-none"
                    value={managingLocation}
                    onChange={(e) => setManagingLocation(e.target.value)}
                  >
                    {locations.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <label className="text-xs font-black text-[#7F8C8D] uppercase tracking-widest ml-1">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7F8C8D] group-focus-within:text-[#6A59CC] transition-colors" />
              <input 
                type="email" 
                required
                placeholder="admin@pawfeeds.com"
                className="w-full pl-12 pr-6 py-4 rounded-2xl border border-[#EEEEEE] outline-none focus:ring-2 focus:ring-[#6A59CC]/20 focus:border-[#6A59CC] transition-all bg-[#F8F7FF]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {authMode !== 'forgot' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-black text-[#7F8C8D] uppercase tracking-widest">Password</label>
                {authMode === 'login' && (
                  <button 
                    type="button"
                    onClick={() => setAuthMode('forgot')}
                    className="text-[10px] font-black text-[#6A59CC] uppercase tracking-wider hover:underline"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7F8C8D] group-focus-within:text-[#6A59CC] transition-colors" />
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  className="w-full pl-12 pr-6 py-4 rounded-2xl border border-[#EEEEEE] outline-none focus:ring-2 focus:ring-[#6A59CC]/20 focus:border-[#6A59CC] transition-all bg-[#F8F7FF]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#6A59CC] text-white rounded-2xl font-bold shadow-lg shadow-[#6A59CC]/30 hover:bg-[#5A4BB8] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {authMode === 'login' ? 'Signing in...' : authMode === 'signup' ? 'Registering...' : 'Sending...'}
              </>
            ) : (
              authMode === 'login' ? 'Sign In' : authMode === 'signup' ? 'Create Account' : 'Send Reset Link'
            )}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3">
          {authMode === 'login' && (
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-4 bg-white text-[#2D3436] border border-[#EEEEEE] rounded-2xl font-bold hover:bg-[#F8F7FF] transition-all flex items-center justify-center gap-2"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              Sign in with Google
            </button>
          )}

          <button 
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'signup' : 'login');
              setError('');
            }}
            className="text-sm font-bold text-[#6A59CC] hover:underline"
          >
            {authMode === 'login' ? 'New Admin? Sign Up' : 'Already have an account? Login'}
          </button>
          
          {authMode === 'forgot' && (
            <button 
              onClick={() => {
                setAuthMode('login');
                setError('');
              }}
              className="text-sm font-bold text-[#7F8C8D] hover:underline"
            >
              Back to Login
            </button>
          )}

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#EEEEEE]"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-[#7F8C8D] font-black">Or</span></div>
          </div>

          <button 
            onClick={() => setViewerMode(true)}
            className="w-full py-4 bg-white text-[#2D3436] border border-[#EEEEEE] rounded-2xl font-bold hover:bg-[#F8F7FF] transition-all flex items-center justify-center gap-2"
          >
            <Eye className="w-5 h-5" />
            Enter as Public Viewer
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
