import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider, signInWithPopup, signInAnonymously, updateProfile, handleFirestoreError, OperationType } from '../firebase/config';
import { UserProfile, ChatWallpaper } from '../types/telegram';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  wallpaper: ChatWallpaper;
  setWallpaper: (wp: ChatWallpaper) => void;
  fontSize: 'small' | 'medium' | 'large';
  setFontSize: (fs: 'small' | 'medium' | 'large') => void;
  loginWithGoogle: () => Promise<void>;
  loginAsDemoUser: (name: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('tg_theme') as 'dark' | 'light') || 'dark';
  });
  const [wallpaper, setWallpaperState] = useState<ChatWallpaper>(() => {
    return (localStorage.getItem('tg_wallpaper') as ChatWallpaper) || 'classic';
  });
  const [fontSize, setFontSizeState] = useState<'small' | 'medium' | 'large'>(() => {
    return (localStorage.getItem('tg_fontSize') as 'small' | 'medium' | 'large') || 'medium';
  });

  useEffect(() => {
    document.documentElement.classList.remove('theme-light', 'theme-dark');
    if (theme === 'light') {
      document.documentElement.classList.add('theme-light');
      document.body.classList.remove('bg-[#0e1621]', 'text-[#ffffff]');
      document.body.classList.add('bg-[#8ca388]', 'text-[#111827]');
    } else {
      document.documentElement.classList.add('theme-dark');
      document.body.classList.remove('bg-[#8ca388]', 'text-[#111827]');
      document.body.classList.add('bg-[#0e1621]', 'text-[#ffffff]');
    }
    localStorage.setItem('tg_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setWallpaper = (wp: ChatWallpaper) => {
    setWallpaperState(wp);
    localStorage.setItem('tg_wallpaper', wp);
  };

  const setFontSize = (fs: 'small' | 'medium' | 'large') => {
    setFontSizeState(fs);
    localStorage.setItem('tg_fontSize', fs);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const data = userSnap.data() as UserProfile;
            setUserProfile(data);
            // Update online state
            await updateDoc(userRef, {
              isOnline: true,
              lastSeen: new Date().toISOString(),
            }).catch(() => {});
          } else {
            // Create user profile in firestore
            const newProfile: UserProfile = {
              uid: user.uid,
              displayName: user.displayName || 'مستخدم تيليجرام',
              username: user.email ? `@${user.email.split('@')[0]}` : `@user_${user.uid.slice(0, 5)}`,
              photoURL: user.photoURL || '',
              avatarColor: '#2481cc',
              bio: 'مرحباً، أنا أستخدم تيليجرام!',
              phone: user.phoneNumber || '+966 50 123 4567',
              isOnline: true,
              lastSeen: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            };
            await setDoc(userRef, newProfile);
            setUserProfile(newProfile);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google Sign-in failed:', error);
      throw error;
    }
  };

  const loginAsDemoUser = async (name: string, username: string) => {
    try {
      const cred = await signInAnonymously(auth);
      const user = cred.user;
      await updateProfile(user, { displayName: name });
      const userRef = doc(db, 'users', user.uid);
      const newProfile: UserProfile = {
        uid: user.uid,
        displayName: name,
        username: username.startsWith('@') ? username : `@${username}`,
        photoURL: '',
        avatarColor: '#2481cc',
        bio: 'مرحباً، أنا أستخدم تيليجرام!',
        phone: '+966 55 987 6543',
        isOnline: true,
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      await setDoc(userRef, newProfile);
      setUserProfile(newProfile);
    } catch (error) {
      console.error('Demo Login error:', error);
      throw error;
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!currentUser) return;
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, data);
      setUserProfile((prev) => (prev ? { ...prev, ...data } : null));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.uid}`);
    }
  };

  const logout = async () => {
    if (currentUser) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          isOnline: false,
          lastSeen: new Date().toISOString(),
        }).catch(() => {});
      } catch {
        // Ignore on logout
      }
    }
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        theme,
        toggleTheme,
        wallpaper,
        setWallpaper,
        fontSize,
        setFontSize,
        loginWithGoogle,
        loginAsDemoUser,
        logout,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
