import { useState } from "react";

import { Link, useNavigate, useLocation } from "react-router-dom";

import { Eye, EyeOff, LockKeyhole, Mail, ArrowRight, Zap, MapPin, ShieldCheck, Globe2, Plane } from "lucide-react";

import { loginUser } from "../services/aiService";



const features = [

  { icon: Zap, title: "AI-Powered Planning", subtitle: "Personalized itineraries", color: "#ffc65b" },

  { icon: MapPin, title: "Multi-Source Research", subtitle: "Flights, hotels, weather & more", color: "#ff77ad" },

  { icon: ShieldCheck, title: "Budget Control", subtitle: "Plan within your budget", color: "#46e4b2" },

  { icon: Globe2, title: "Interactive Maps", subtitle: "Explore destinations", color: "#4bd7ff" },

];



const STYLES = `

.journey-login-page,.journey-login-page *,.journey-login-page *::before,.journey-login-page *::after{box-sizing:border-box}

.journey-login-page{min-height:100dvh;position:relative;isolation:isolate;background:#091431;color:white;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;overflow-x:hidden}

.journey-login-page::before{content:"";position:absolute;inset:0;z-index:-2;background:linear-gradient(90deg,rgba(7,16,46,.95),rgba(9,19,51,.79) 48%,rgba(9,20,52,.45)),url("https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1800&q=90") center/cover no-repeat}

.journey-login-page::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(ellipse at 0% 0%,rgba(135,65,255,.23),transparent 36%),radial-gradient(ellipse at 100% 95%,rgba(41,169,255,.16),transparent 40%)}

.journey-login-container{width:min(100%,1500px);min-height:100dvh;margin:auto;padding:18px clamp(24px,4vw,70px);display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);align-items:center;gap:clamp(25px,4vw,75px)}

.journey-login-promo{max-width:500px}.journey-login-promo h1{color:#fff;font-size:clamp(38px,3.8vw,59px);line-height:1.12;letter-spacing:-1.7px;margin:0;font-weight:850}

.journey-login-gradient-text{background:linear-gradient(100deg,#38c7ff,#777bff,#d66aff);background-clip:text;-webkit-background-clip:text;color:transparent}

.journey-login-accent{width:70px;height:4px;border-radius:10px;margin:16px 0;background:linear-gradient(90deg,#c15dff,#6b6bff)}

.journey-login-promo>p{color:#d4ddff;font-size:clamp(15px,1.4vw,19px);line-height:1.45;margin:0 0 20px;max-width:410px}

.journey-login-features{display:grid;gap:12px}.journey-login-feature{display:flex;align-items:center;gap:13px}.journey-login-feature-icon{width:44px;height:44px;flex:0 0 44px;display:grid;place-items:center;border-radius:13px;background:rgba(146,160,255,.17);border:1px solid rgba(186,188,255,.15)}

.journey-login-feature strong{display:block;font-size:14px;margin-bottom:2px;color:white}.journey-login-feature small{font-size:12px;color:#c0cbee}

.journey-login-card{width:100%;max-width:625px;justify-self:end;padding:22px clamp(22px,2.5vw,38px);border:1px solid rgba(170,145,255,.62);border-radius:26px;background:linear-gradient(135deg,rgba(24,35,85,.91),rgba(10,26,60,.9));box-shadow:0 20px 65px rgba(0,0,0,.38),0 0 45px rgba(113,78,245,.14);backdrop-filter:blur(18px)}

.journey-login-brand{display:flex;align-items:center;justify-content:center;gap:9px;text-decoration:none;color:#fff;width:fit-content;margin:0 auto 10px}.journey-login-brand img{width:55px;height:52px;object-fit:contain}.journey-login-brand-name{font-size:24px;font-weight:850;line-height:1.06;letter-spacing:-.5px}.journey-login-brand-name span{display:block;color:#c17cff}

.journey-login-card h2{color:white!important;text-align:center;font-size:29px;line-height:1.2;margin:0;font-weight:800}.journey-login-subtitle{text-align:center;color:#c5d1f6;line-height:1.4;font-size:13px;max-width:420px;margin:6px auto 18px}

.journey-login-error{padding:9px 12px;border:1px solid rgba(255,122,146,.5);border-radius:10px;background:rgba(255,66,103,.12);color:#ffc4ce;margin-bottom:10px;font-size:12px}

.journey-login-field{margin-bottom:13px}.journey-login-field label{display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:white}.journey-login-input-wrap{position:relative;display:flex;align-items:center}.journey-login-input-wrap>svg{position:absolute;left:14px;color:#b5c3ec;pointer-events:none}

.journey-login-input{width:100%;height:44px;border:1px solid #6577b1;border-radius:11px;padding:0 15px 0 43px;color:#fff;background:rgba(139,159,214,.12);outline:none;font:inherit;font-size:14px}.journey-login-input::placeholder{color:#9cadd6}.journey-login-input:focus{border-color:#a77cff;box-shadow:0 0 0 3px rgba(163,111,255,.17)}.journey-login-password-input{padding-right:52px}

.journey-login-eye{position:absolute;right:7px;display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:8px;color:#d9e2ff;background:transparent;cursor:pointer}.journey-login-eye:hover{background:rgba(255,255,255,.08)}

.journey-login-options{display:flex;justify-content:flex-end;margin:0 0 13px;font-size:13px}.journey-login-forgot{color:#d08aff;font-weight:700;text-decoration:none}.journey-login-forgot:hover,.journey-login-create:hover{text-decoration:underline}

.journey-login-submit{width:100%;height:46px;border:0;border-radius:12px;background:linear-gradient(100deg,#c04bf5,#8153f4 47%,#1db7f5);color:white;font:inherit;font-size:16px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;box-shadow:0 12px 27px rgba(93,71,220,.24)}.journey-login-submit:disabled{opacity:.65;cursor:wait}

.journey-login-separator{display:flex;align-items:center;gap:12px;margin:14px 0 12px;color:#c6d0ef;font-size:12px;text-align:center}.journey-login-separator::before,.journey-login-separator::after{content:"";height:1px;flex:1;background:rgba(192,199,242,.3)}

.journey-login-create{display:flex;justify-content:center;align-items:center;gap:9px;height:43px;border-radius:11px;border:1px solid #bc68ff;color:#fff;font-size:14px;font-weight:750;text-decoration:none}.journey-login-create:hover{background:rgba(164,104,255,.15)}.journey-login-back{display:block;text-align:center;margin-top:12px;color:#aebce6;font-size:12px;text-decoration:none}.journey-login-back:hover{color:#fff}

@media(min-width:921px) and (max-height:740px){.journey-login-container{padding-top:8px;padding-bottom:8px}.journey-login-card{padding-top:14px;padding-bottom:14px}.journey-login-brand{margin-bottom:6px}.journey-login-brand img{width:45px;height:43px}.journey-login-card h2{font-size:26px}.journey-login-subtitle{margin:4px auto 11px}.journey-login-field{margin-bottom:9px}.journey-login-input{height:40px}.journey-login-options{margin-bottom:10px}.journey-login-separator{margin:10px 0}.journey-login-back{margin-top:8px}.journey-login-promo h1{font-size:clamp(35px,3.3vw,50px)}.journey-login-features{gap:9px}}

@media(max-width:920px){.journey-login-container{grid-template-columns:1fr;max-width:660px;padding:24px 18px;gap:22px}.journey-login-promo{text-align:center;max-width:none}.journey-login-promo>p{margin:0 auto 12px}.journey-login-accent{margin:12px auto}.journey-login-features{display:none}.journey-login-card{justify-self:center}}

@media(max-width:480px){.journey-login-container{padding:16px 12px}.journey-login-card{padding:20px 17px;border-radius:20px}.journey-login-promo h1{font-size:31px}.journey-login-brand-name{font-size:21px}}


/* Light appearance follows the global theme set on Home. */
:root[data-theme="light"] .journey-login-page{background:#f3f5ff;color:#1d2946}
:root[data-theme="light"] .journey-login-page::before{background:linear-gradient(90deg,rgba(246,248,255,.96),rgba(244,247,255,.91) 48%,rgba(233,239,255,.78)),url("https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1800&q=90") center/cover no-repeat}
:root[data-theme="light"] .journey-login-page::after{background:radial-gradient(ellipse at 0% 0%,rgba(135,65,255,.09),transparent 36%),radial-gradient(ellipse at 100% 95%,rgba(41,169,255,.11),transparent 40%)}
:root[data-theme="light"] .journey-login-promo h1,:root[data-theme="light"] .journey-login-feature strong{color:#182545}
:root[data-theme="light"] .journey-login-promo>p{color:#536483}
:root[data-theme="light"] .journey-login-feature small{color:#586887}
:root[data-theme="light"] .journey-login-feature-icon{background:rgba(123,103,228,.10);border-color:rgba(104,94,193,.18)}
:root[data-theme="light"] .journey-login-card{background:linear-gradient(135deg,rgba(255,255,255,.97),rgba(246,248,255,.96));border-color:rgba(128,111,211,.30);box-shadow:0 22px 65px rgba(44,55,102,.15),0 0 40px rgba(113,78,245,.07)}
:root[data-theme="light"] .journey-login-brand{color:#182545}
:root[data-theme="light"] .journey-login-brand-name span{color:#8950dc}
:root[data-theme="light"] .journey-login-card h2{color:#182545!important}
:root[data-theme="light"] .journey-login-subtitle{color:#5c6985}
:root[data-theme="light"] .journey-login-field label{color:#263351}
:root[data-theme="light"] .journey-login-input{background:#f7f8fd;border-color:#cdd6e9;color:#1c2948}
:root[data-theme="light"] .journey-login-input::placeholder{color:#7c89a4}
:root[data-theme="light"] .journey-login-input-wrap>svg{color:#69799b}
:root[data-theme="light"] .journey-login-eye{color:#536485}
:root[data-theme="light"] .journey-login-eye:hover{background:rgba(90,103,151,.10)}
:root[data-theme="light"] .journey-login-forgot{color:#7946c9}
:root[data-theme="light"] .journey-login-separator{color:#69758e}
:root[data-theme="light"] .journey-login-separator::before,:root[data-theme="light"] .journey-login-separator::after{background:rgba(110,123,162,.25)}
:root[data-theme="light"] .journey-login-create{color:#6734b8;border-color:#9b6cdb}
:root[data-theme="light"] .journey-login-create:hover{background:rgba(146,91,226,.08)}
:root[data-theme="light"] .journey-login-back{color:#52617e}
:root[data-theme="light"] .journey-login-back:hover{color:#27385b}
:root[data-theme="light"] .journey-login-error{color:#a4243c;background:#fff0f2;border-color:#e8a9b3}

`;



export default function Login() {

  const navigate = useNavigate();

  const location = useLocation();

  const [formData, setFormData] = useState({ email: "", password: "" });

  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);



  function handleChange(event) {

    const { name, value } = event.target;

    setFormData((previous) => ({ ...previous, [name]: value }));

    if (error) setError("");

  }



  async function handleSubmit(event) {

    event.preventDefault();

    setError("");

    if (!formData.email.trim() || !formData.password) {

      setError("Please enter your email address and password.");

      return;

    }

    try {

      setLoading(true);

      await loginUser({ email: formData.email.trim(), password: formData.password });

      const requestedPath = location.state?.from?.pathname;

      const destination = requestedPath && requestedPath !== "/login" && requestedPath !== "/signup" ? requestedPath : "/dashboard";

      navigate(destination, { replace: true });

    } catch (err) {

      setError(err?.response?.data?.detail || err?.message || "Login failed. Please check your credentials.");

    } finally {

      setLoading(false);

    }

  }



  return (

    <div className="journey-login-page">

      <style>{STYLES}</style>

      <div className="journey-login-container">

        <section className="journey-login-promo" aria-label="Journey Gen AI highlights">

          <h1>Travel Smarter.<br /><span className="journey-login-gradient-text">Explore Further.</span></h1>

          <div className="journey-login-accent" />

          <p>AI-powered travel planning with multiple intelligent agents.</p>

          <div className="journey-login-features">

            {features.map(({ icon: Icon, title, subtitle, color }) => (

              <div className="journey-login-feature" key={title}>

                <span className="journey-login-feature-icon"><Icon size={24} color={color} /></span>

                <span><strong>{title}</strong><small>{subtitle}</small></span>

              </div>

            ))}

          </div>

        </section>

        <section className="journey-login-card" aria-label="Sign in to Journey Gen AI">

          <Link className="journey-login-brand" to="/">

            <img src="/journey-gen-ai-orbit.webp" alt="Journey Gen AI logo" />

            <span className="journey-login-brand-name">Journey<span>Gen AI</span></span>

          </Link>

          <h2>Welcome Back!</h2>

          <p className="journey-login-subtitle">Sign in to continue your journey and plan your next adventure with AI.</p>

          {error && <div className="journey-login-error" role="alert">{error}</div>}

          <form onSubmit={handleSubmit}>

            <div className="journey-login-field">

              <label htmlFor="journey-login-email">Email Address</label>

              <div className="journey-login-input-wrap">

                <Mail size={19} aria-hidden="true" />

                <input id="journey-login-email" className="journey-login-input" type="email" name="email" placeholder="Enter your email address" value={formData.email} onChange={handleChange} autoComplete="email" required />

              </div>

            </div>

            <div className="journey-login-field">

              <label htmlFor="journey-login-password">Password</label>

              <div className="journey-login-input-wrap">

                <LockKeyhole size={19} aria-hidden="true" />

                <input id="journey-login-password" className="journey-login-input journey-login-password-input" type={showPassword ? "text" : "password"} name="password" placeholder="Enter your password" value={formData.password} onChange={handleChange} autoComplete="current-password" required />

                <button className="journey-login-eye" type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((current) => !current)}>

                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}

                </button>

              </div>

            </div>

            <div className="journey-login-options"><Link className="journey-login-forgot" to="/forgot-password">Forgot Password?</Link></div>

            <button className="journey-login-submit" type="submit" disabled={loading}>

              {loading ? "Signing In..." : <><ArrowRight size={21} /> Sign In</>}

            </button>

          </form>

          <div className="journey-login-separator">New to Journey Gen AI?</div>

          <Link className="journey-login-create" to="/signup"><Plane size={18} /> Create Account</Link>

          <Link className="journey-login-back" to="/">Back to Home</Link>

        </section>

      </div>

    </div>

  );

}
