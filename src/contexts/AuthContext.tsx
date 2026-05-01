import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';

interface AdminProfile {
  uid: string;
  email: string;
  name: string;
  bio?: string;
  role: 'admin' | 'main';
  status: 'pending' | 'approved' | 'declined';
  managingLocation: string;
}

interface AuthContextType {
  currentUser: User | null;
  adminProfile: AdminProfile | null;
  loading: boolean;
  isViewer: boolean;
  setViewerMode: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isViewer, setIsViewer] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      
      if (user) {
        setIsViewer(false);
        const userEmail = user.email?.toLowerCase() || '';
        const isOwnerEmail = userEmail === 'trishiagayem18@gmail.com';
        
        console.log(`Auth state changed: user=${userEmail}, isOwner=${isOwnerEmail}`);

        // Listen to the admin profile in Firestore
        unsubscribeProfile = onSnapshot(doc(db, 'admins', user.uid), async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as AdminProfile;
            console.log(`Admin profile found: role=${data.role}, status=${data.status}`);

            // Self-healing: Ensure main admin always has correct role and status
            if (isOwnerEmail && (data.role !== 'main' || data.status !== 'approved')) {
              console.log('Self-healing main admin profile...');
              try {
                await setDoc(doc(db, 'admins', user.uid), {
                  ...data,
                  role: 'main',
                  status: 'approved'
                }, { merge: true });
              } catch (err) {
                console.error('Self-healing failed:', err);
                handleFirestoreError(err, OperationType.WRITE, `admins/${user.uid}`);
              }
            }
            setAdminProfile(data);
          } else {
            console.log('No admin profile found for UID:', user.uid);
            // If it's the owner email, auto-create the main admin profile
            if (isOwnerEmail) {
              console.log('Auto-creating main admin profile...');
              const mainProfile: AdminProfile = {
                uid: user.uid,
                email: user.email!,
                name: 'Main Admin',
                role: 'main',
                status: 'approved',
                managingLocation: 'Over All'
              };
              try {
                await setDoc(doc(db, 'admins', user.uid), mainProfile);
                setAdminProfile(mainProfile);
              } catch (err) {
                console.error('Auto-creation failed:', err);
                handleFirestoreError(err, OperationType.WRITE, `admins/${user.uid}`);
              }
            } else {
              setAdminProfile(null);
            }
          }
          setLoading(false);
        }, (error) => {
          console.error('Admin profile fetch error:', error);
          handleFirestoreError(error, OperationType.GET, `admins/${user.uid}`);
          setLoading(false);
        });
      } else {
        if (unsubscribeProfile) unsubscribeProfile();
        setAdminProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const value = {
    currentUser,
    adminProfile,
    loading,
    isViewer,
    setViewerMode: setIsViewer
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
