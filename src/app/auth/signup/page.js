// Invite-Only Signup Page
// Users can only create an account with a valid invitation token
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [tokenError, setTokenError] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Validate token on load
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setTokenError('No invitation token provided. You need a valid invitation link to create an account.');
        setLoading(false);
        return;
      }

      try {
        const inviteDoc = await getDoc(doc(db, 'invitations', token));

        if (!inviteDoc.exists()) {
          setTokenError('Invalid invitation link. Please contact your administrator for a new invitation.');
          setLoading(false);
          return;
        }

        const inviteData = inviteDoc.data();

        // Check if already accepted
        if (inviteData.status === 'accepted') {
          setTokenError('This invitation has already been used. If you already have an account, please sign in.');
          setLoading(false);
          return;
        }

        // Check expiration
        const expiresAt = inviteData.expiresAt?.seconds
          ? new Date(inviteData.expiresAt.seconds * 1000)
          : inviteData.expiresAt ? new Date(inviteData.expiresAt) : null;

        if (expiresAt && expiresAt < new Date()) {
          setTokenError('This invitation has expired. Please contact your administrator for a new invitation.');
          // Update status to expired
          try {
            await updateDoc(doc(db, 'invitations', token), { status: 'expired' });
          } catch (e) { /* best effort */ }
          setLoading(false);
          return;
        }

        setInvite({ id: inviteDoc.id, ...inviteData });
      } catch (err) {
        console.error('Error validating token:', err);
        setTokenError('Could not validate invitation. Please try again or contact your administrator.');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!displayName.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, invite.email, password);
      const user = userCredential.user;

      // 2. Update display name
      await updateProfile(user, { displayName: displayName.trim() });

      // 3. Create Firestore user document
      await setDoc(doc(db, 'users', user.uid), {
        email: invite.email,
        displayName: displayName.trim(),
        role: invite.role || 'specialist',
        organizationId: invite.organizationId,
        status: 'active',
        phone: '',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        invitedBy: invite.invitedBy || '',
        inviteAcceptedAt: serverTimestamp(),
      });

      // 4. Mark invitation as accepted
      await updateDoc(doc(db, 'invitations', token), {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
        acceptedByUid: user.uid,
      });

      // 5. Redirect to dashboard
      router.push('/');
    } catch (err) {
      console.error('Signup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please sign in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please choose a stronger password.');
      } else {
        setError('Could not create account. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-3" style={{ borderColor: '#1d398f' }}></div>
          <p className="text-sm text-gray-500">Validating your invitation...</p>
        </div>
      </div>
    );
  }

  // Token error state
  if (tokenError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#fef2f2' }}>
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Invitation Issue</h1>
            <p className="text-sm text-gray-600 leading-relaxed">{tokenError}</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <Link
              href="/auth/signin"
              className="inline-block px-6 py-2.5 text-white rounded-lg font-medium text-sm"
              style={{ backgroundColor: '#1d398f' }}
            >
              Go to Sign In
            </Link>
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">Powered by Pronoia Solutions</p>
        </div>
      </div>
    );
  }

  // Valid invite — show signup form
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#1d398f' }}>
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Join {invite.organizationName || 'Your Team'}</h1>
          <p className="text-sm text-gray-500 mt-1">You&apos;ve been invited to the Reserve Studies platform</p>
        </div>

        {/* Invite details card */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#1d398f' }}>
              <span className="text-white text-xs font-bold">{(invite.email || '?')[0].toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{invite.email}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Role: <strong className="text-gray-700 capitalize">{invite.role || 'Specialist'}</strong></span>
                <span>•</span>
                <span>{invite.organizationName || 'Organization'}</span>
              </div>
            </div>
          </div>
          {invite.customMessage && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <p className="text-xs text-gray-600 italic">&quot;{invite.customMessage}&quot;</p>
            </div>
          )}
        </div>

        {/* Signup form */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Create Your Account</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email (read-only) */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
              <input
                type="email"
                value={invite.email}
                disabled
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 cursor-not-allowed"
              />
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="John Smith"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                autoFocus
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                minLength={6}
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2.5 text-white rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#1d398f' }}
            >
              {submitting ? 'Creating Account...' : 'Create Account & Get Started'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4">
            Already have an account?{' '}
            <Link href="/auth/signin" className="text-blue-600 hover:text-blue-800 font-medium">Sign in</Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">© 2026 Pronoia Solutions. All rights reserved.</p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-3" style={{ borderColor: '#1d398f' }}></div>
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
