import { useState, useEffect } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { SEO } from '@/components/SEO';
import { Calendar, Loader2, ArrowLeft } from 'lucide-react';

type AuthView = 'main' | 'forgot-password' | 'reset-password';

export default function Auth() {
  const { user, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [view, setView] = useState<AuthView>('main');
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Check for password recovery event
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('reset-password');
      }
    });

    // Also check URL param for reset flow
    if (searchParams.get('reset') === 'true') {
      setView('reset-password');
    }

    return () => subscription.unsubscribe();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Don't redirect if we're in reset-password mode
  if (user && view !== 'reset-password') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <SEO
        title="Sign In"
        description="Sign in to iCal Tester Pro to manage your mock calendars and test iCal sync integrations. Free account for developers."
        canonical="/auth"
      />
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">iCal Mock Server</CardTitle>
          <CardDescription>
            {view === 'forgot-password' && 'Reset your password'}
            {view === 'reset-password' && 'Set a new password'}
            {view === 'main' && 'Test your 2-way iCal sync integrations'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {view === 'forgot-password' && (
            <ForgotPasswordForm 
              isSubmitting={isSubmitting} 
              setIsSubmitting={setIsSubmitting} 
              toast={toast}
              onBack={() => setView('main')}
            />
          )}
          {view === 'reset-password' && (
            <ResetPasswordForm 
              isSubmitting={isSubmitting} 
              setIsSubmitting={setIsSubmitting} 
              toast={toast}
            />
          )}
          {view === 'main' && (
            <>
              <GoogleSignInButton />
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
                </div>
              </div>
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Sign Up</TabsTrigger>
                </TabsList>
                <TabsContent value="signin">
                  <SignInForm 
                    isSubmitting={isSubmitting} 
                    setIsSubmitting={setIsSubmitting} 
                    toast={toast}
                    onForgotPassword={() => setView('forgot-password')}
                  />
                </TabsContent>
                <TabsContent value="signup">
                  <SignUpForm isSubmitting={isSubmitting} setIsSubmitting={setIsSubmitting} toast={toast} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
}

function ForgotPasswordForm({ isSubmitting, setIsSubmitting, toast, onBack }: { 
  isSubmitting: boolean; 
  setIsSubmitting: (v: boolean) => void;
  toast: ReturnType<typeof useToast>['toast'];
  onBack: () => void;
}) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: 'Error', description: 'Please enter your email', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    const { error } = await resetPassword(email);
    setIsSubmitting(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setSent(true);
      toast({ title: 'Check your email', description: 'We sent you a password reset link.' });
    }
  };

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground">
          We've sent a password reset link to <strong>{email}</strong>. Check your inbox and click the link to reset your password.
        </p>
        <Button variant="outline" className="w-full" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isSubmitting}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Send Reset Link
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to sign in
      </Button>
    </form>
  );
}

function ResetPasswordForm({ isSubmitting, setIsSubmitting, toast }: { 
  isSubmitting: boolean; 
  setIsSubmitting: (v: boolean) => void;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    const { error } = await updatePassword(password);
    setIsSubmitting(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setDone(true);
      toast({ title: 'Success', description: 'Your password has been updated!' });
    }
  };

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground">
          Your password has been successfully updated. You can now use your new password to sign in.
        </p>
        <Button className="w-full" asChild>
          <Link to="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-password">New Password</Label>
        <Input
          id="new-password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-new-password">Confirm New Password</Label>
        <Input
          id="confirm-new-password"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isSubmitting}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Update Password
      </Button>
    </form>
  );
}

function SignInForm({ isSubmitting, setIsSubmitting, toast, onForgotPassword }: { 
  isSubmitting: boolean; 
  setIsSubmitting: (v: boolean) => void;
  toast: ReturnType<typeof useToast>['toast'];
  onForgotPassword: () => void;
}) {
  const { signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    const { error } = await signInWithPassword(email, password);
    setIsSubmitting(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isSubmitting}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-password">Password</Label>
        <Input
          id="signin-password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Sign In
      </Button>
      <div className="flex justify-between pt-2 text-sm text-muted-foreground">
        <button
          type="button"
          onClick={onForgotPassword}
          className="underline underline-offset-4 hover:text-foreground"
        >
          Forgot password?
        </button>
        <Link to="/" className="underline underline-offset-4 hover:text-foreground">
          Back to home
        </Link>
      </div>
    </form>
  );
}

function GoogleSignInButton() {
  const { signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setIsLoading(false);
    }
    // Don't reset loading on success - user will be redirected
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={handleGoogleSignIn}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      )}
      Continue with Google
    </Button>
  );
}

function SignUpForm({ isSubmitting, setIsSubmitting, toast }: { 
  isSubmitting: boolean; 
  setIsSubmitting: (v: boolean) => void;
  toast: ReturnType<typeof useToast>['toast'];
}) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    const { error } = await signUp(email, password);
    setIsSubmitting(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({ title: 'Error', description: 'This email is already registered. Please sign in instead.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    } else {
      toast({ title: 'Success', description: 'Account created. You can sign in immediately.' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isSubmitting}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-confirm">Confirm Password</Label>
        <Input
          id="signup-confirm"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isSubmitting}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Create Account
      </Button>
    </form>
  );
}
