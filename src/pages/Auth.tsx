import {ArrowRight,ClipboardCheck,Eye,EyeOff,LockKeyhole,Mail,ScanLine,School,ShieldCheck} from 'lucide-react';
import {useLayoutEffect,useRef,useState,type FormEvent} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {Button} from '../components/ui';
import {IctSupportDialog} from '../components/auth/IctSupportDialog';
import {legalConfig} from '../config/legal';
import {useApp} from '../context/AppContext';

export default function Auth({mode='login'}:{mode?:'login'|'register'|'forgot'|'reset'}){
  const app=useApp(),nl=app.language==='nl',navigate=useNavigate();
  const themeLogo='/aims-logo-blue.png';
  const [done,setDone]=useState(false),[showPassword,setShowPassword]=useState(false),[error,setError]=useState(''),[submitting,setSubmitting]=useState(false);
  const brandContentRef=useRef<HTMLDivElement>(null),authCardRef=useRef<HTMLDivElement>(null);
  const titles={login:nl?'Welkom terug':'Welcome back',register:nl?'Registreren':'Sign up',forgot:nl?'Wachtwoord herstellen':'Reset your password',reset:nl?'Nieuw wachtwoord kiezen':'Choose a new password'};

  useLayoutEffect(()=>{
    if(mode!=='login'||!brandContentRef.current||!authCardRef.current)return;
    const brandContent=brandContentRef.current,authCard=authCardRef.current;
    const matchCardHeight=()=>brandContent.style.setProperty('--auth-brand-height',`${authCard.getBoundingClientRect().height}px`);
    matchCardHeight();
    const observer=new ResizeObserver(matchCardHeight);
    observer.observe(authCard);
    return()=>observer.disconnect();
  },[mode,done]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const data=new FormData(event.currentTarget),email=String(data.get('email')||''),remember=data.get('remember')==='on';
    if(!email.includes('@')){setError(nl?'Voer een geldig e-mailadres in.':'Enter a valid email address.');return}
    setError('');setSubmitting(true);
    await new Promise<void>(resolve=>setTimeout(resolve,120));
    if(mode==='login'){app.login(undefined,remember);navigate('/dashboard')}else{setDone(true);setSubmitting(false)}
  }

  function googleLogin(){
    const remember=(document.querySelector('input[name="remember"]') as HTMLInputElement|null)?.checked??true;
    app.login(undefined,remember);
    navigate('/dashboard');
  }

  return <div className={`auth-page auth-${mode}`} data-auth-theme={app.theme}>
    <section className="auth-brand">
      <div className="auth-brand-content" ref={brandContentRef}>
        <div className="auth-brand-copy"><h1><span>AIMS Asset &amp; Inventory</span><span>Management System</span></h1><p>{nl?'Volledig inzicht, verantwoordelijkheid en levenscyclusbeheer voor schoolmiddelen.':'Complete visibility, accountability, and lifecycle control for school assets.'}</p></div>
        <ul><li><span><ShieldCheck/></span>{nl?'Veilige rolgebaseerde toegang':'Secure role-based access'}</li><li><span><ClipboardCheck/></span>{nl?'Traceerbare voorraadworkflows':'Traceable inventory workflows'}</li><li><span><ScanLine/></span>{nl?'Mobiele controles en scanning':'Mobile-ready audits and scanning'}</li><li><span><School/></span>St. Kangoeroe Community School</li></ul>
      </div>
    </section>
    <main className="auth-panel"><div className="auth-card login-card" ref={authCardRef}>{done?<><span className="auth-success"><Mail/></span><h2>{nl?'Controleer uw e-mail':'Check your email'}</h2><p>{nl?'Als het account bestaat, zijn instructies voorbereid. Deze mockstatus verstuurt geen extern bericht.':'If the account exists, instructions were prepared. This mock state sends no external message.'}</p><Button onClick={()=>navigate('/login')}>{nl?'Terug naar aanmelden':'Return to sign in'}</Button></>:<>
      <div className="auth-logo-lockup"><img className="mobile-auth-logo" src={themeLogo} alt="AIMS logo"/><strong>{mode==='login'?'AIMS':'AIMS Asset & Inventory Management System'}</strong></div>
      {mode!=='login'&&<h2>{titles[mode]}</h2>}
      {mode!=='login'&&<p>{nl?'Deze mockactie demonstreert het formulier en verstuurt niets extern.':'This mock action demonstrates the form and sends nothing externally.'}</p>}
      <form onSubmit={submit} noValidate>
        <label htmlFor="auth-email"><span>{nl?'E-mailadres':'Email address'}</span><div className={error?'invalid':''}><Mail/><input id="auth-email" name="email" type="email" required aria-invalid={!!error} aria-describedby={error?'auth-error':undefined} defaultValue={mode==='login'?'naomi@kcs.edu':''} placeholder="name@school.edu" disabled={submitting}/></div></label>
        {(mode==='login'||mode==='register'||mode==='reset')&&<label htmlFor="auth-password"><span>{nl?'Wachtwoord':'Password'}</span><div><LockKeyhole/><input id="auth-password" name="password" type={showPassword?'text':'password'} required defaultValue={mode==='login'?'inventory':''} disabled={submitting}/><button type="button" className="icon-button" aria-label={nl?'Wachtwoord tonen of verbergen':'Show or hide password'} onClick={()=>setShowPassword(value=>!value)} disabled={submitting}>{showPassword?<EyeOff/>:<Eye/>}</button></div></label>}
        {mode==='login'&&<div className="login-options"><label htmlFor="remember-me"><input id="remember-me" name="remember" type="checkbox" defaultChecked aria-label={nl?'Onthoud mij':'Remember me'}/><span>{nl?'Onthoud mij':'Remember me'}</span></label><Link to="/forgot-password">{nl?'Wachtwoord vergeten?':'Forgot password?'}</Link></div>}
        {error&&<p id="auth-error" className="field-error" role="alert" aria-live="polite">{error}</p>}
        <Button type="submit" className="auth-submit" disabled={submitting} aria-busy={submitting}>{submitting?<><span className="auth-spinner" aria-hidden="true"/>{nl?'Bezig met aanmelden…':'Signing in…'}</>:<>{mode==='login'?(nl?'Aanmelden':'Sign in'):(nl?'Doorgaan':'Continue')}<ArrowRight/></>}</Button>
      </form>
      {mode==='login'&&<><div className="auth-divider"><span>{nl?'of':'or'}</span></div><button type="button" className="google-login" onClick={googleLogin}><svg className="google-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.64-2.42l-3.24-2.54c-.9.6-2.05.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.87A6 6 0 0 1 6.07 12c0-.65.11-1.28.32-1.87V7.51H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.49l3.35-2.62Z"/><path fill="#EA4335" d="M12 6c1.47 0 2.79.51 3.83 1.5l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.51l3.35 2.62C7.18 7.76 9.39 6 12 6Z"/></svg>{nl?'Doorgaan met Google':'Continue with Google'}</button></>}
      <div className="auth-links">{mode==='login'?<span>{nl?'Nog geen account?':'No account yet?'} <Link to="/register">{nl?'Registreren':'Sign up'}</Link></span>:<Link to="/login">{nl?'Terug naar aanmelden':'Back to sign in'}</Link>}</div>
      {mode==='login'&&<IctSupportDialog language={app.language}/>}
      {mode==='login'&&<footer className="login-footer"><nav className="login-public-links" aria-label={nl?'Openbare informatie':'Public information'}><Link to="/terms">{nl?'Algemene voorwaarden':'Terms & Conditions'}</Link><Link to="/privacy">{nl?'Privacyverklaring':'Privacy Notice'}</Link><Link to="/support">{nl?'ICT-ondersteuning':'ICT Support'}</Link></nav><div className="login-footer__credits"><p className="login-copyright">{legalConfig.copyright}</p><p className="login-developer-credit">{legalConfig.developerCredit}</p></div></footer>}
    </>}</div></main>
  </div>;
}
