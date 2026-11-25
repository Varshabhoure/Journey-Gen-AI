import { useMemo, useState } from "react";

import { Link, useNavigate } from "react-router-dom";

import { Eye, EyeOff, LockKeyhole, Mail, UserRound, UserPlus, Check, Circle, Plane } from "lucide-react";

import { registerUser } from "../services/aiService";



const STYLES = `

.journey-signup-page { min-height:100vh; position:relative; isolation:isolate; overflow:hidden; background:#091431; color:white; font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }

.journey-signup-page *, .journey-signup-page *::before, .journey-signup-page *::after { box-sizing:border-box; }

.journey-signup-page::before { content:""; position:absolute; inset:0; z-index:-2; background:linear-gradient(90deg,rgba(7,16,46,.48),rgba(9,19,51,.72) 45%,rgba(9,20,52,.96) 100%),url("https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1800&q=90") center/cover no-repeat; }

.journey-signup-page::after { content:""; position:absolute; inset:0; z-index:-1; pointer-events:none; background:radial-gradient(ellipse at 100% 0%,rgba(136,67,255,.22),transparent 45%),radial-gradient(ellipse at 0% 100%,rgba(36,155,255,.2),transparent 50%); }

.journey-signup-layout { max-width:1540px; min-height:100vh; margin:auto; padding:20px clamp(20px,4vw,70px); display:grid; grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr); align-items:center; gap:clamp(28px,4vw,70px); }

.journey-signup-promo { max-width:550px; }

.journey-signup-eyebrow { color:#d4b5ff; font-weight:750; letter-spacing:2px; font-size:13px; text-transform:uppercase; }

.journey-signup-page .journey-signup-promo h1 { color:#ffffff; font-size:clamp(40px,4.7vw,73px); letter-spacing:-2px; line-height:1.08; margin:18px 0; font-weight:850; }

.journey-signup-page .journey-signup-gradient { background:linear-gradient(90deg,#36caff,#8179ff,#d46bff); background-clip:text; -webkit-background-clip:text; -webkit-text-fill-color:transparent; color:transparent; }

.journey-signup-promo p { font-size:clamp(16px,1.6vw,21px); line-height:1.65; color:#d3defd; max-width:500px; }

.journey-signup-pills { display:flex; flex-wrap:wrap; gap:12px; margin-top:30px; }

.journey-signup-pills span { padding:11px 15px; border-radius:13px; background:rgba(39,56,111,.64); border:1px solid rgba(167,159,255,.28); color:#e8ebff; font-weight:650; font-size:13px; }

.journey-signup-card { width:100%; max-width:740px; justify-self:end; border-radius:32px; padding:clamp(22px,2.4vw,34px); border:1px solid rgba(162,129,255,.68); background:linear-gradient(145deg,rgba(21,34,77,.94),rgba(15,23,58,.92)); box-shadow:0 25px 85px rgba(0,0,0,.4),0 0 48px rgba(129,82,244,.15); backdrop-filter:blur(18px); }

.journey-signup-brand { display:flex; align-items:center; justify-content:center; gap:12px; text-decoration:none; color:white; width:fit-content; margin:0 auto 9px; }

.journey-signup-brand img { width:62px; height:59px; object-fit:contain; }

.journey-signup-brand strong { font-size:clamp(21px,2vw,29px); letter-spacing:-.6px; }

.journey-signup-brand strong span { color:#c37dff; }

.journey-signup-page .journey-signup-card h2 { color:#ffffff; text-align:center; font-size:clamp(26px,2.7vw,36px); letter-spacing:-.8px; margin:0; font-weight:800; }

.journey-signup-subtitle { text-align:center; font-size:14px; line-height:1.5; color:#c6d1f3; margin:7px 0 17px; }

.journey-signup-names { display:grid; grid-template-columns:1fr 1fr 1fr; gap:13px; }

.journey-signup-field { margin-bottom:12px; min-width:0; }

.journey-signup-field label { display:block; font-size:13px; font-weight:700; margin-bottom:6px; color:#f5f7ff; }

.journey-signup-field label em { font-style:normal; color:#ff9cac; }

.journey-signup-input-wrap { position:relative; display:flex; align-items:center; }

.journey-signup-input-wrap > svg { position:absolute; left:13px; color:#afbee8; pointer-events:none; }

.journey-signup-input { width:100%; height:45px; padding:0 13px 0 40px; border-radius:12px; border:1px solid #5b6d9e; outline:none; background:rgba(120,143,208,.12); color:white; font:inherit; font-size:13px; min-width:0; }

.journey-signup-input::placeholder { color:#9aaad1; }

.journey-signup-input:focus { border-color:#bd81ff; box-shadow:0 0 0 3px rgba(162,105,255,.18); }

.journey-signup-password { padding-right:52px; }

.journey-signup-eye { position:absolute; right:7px; height:36px; width:39px; border:0; border-radius:9px; display:grid; place-items:center; color:#d8e1ff; background:transparent; cursor:pointer; }

.journey-signup-eye:hover { background:rgba(255,255,255,.09); }

.journey-signup-rules { border:1px solid rgba(168,112,255,.65); border-radius:15px; padding:12px 15px; margin:2px 0 15px; background:rgba(105,81,173,.1); }

.journey-signup-rules > strong { display:block; font-size:13px; margin-bottom:11px; }

.journey-signup-rule-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 15px; }

.journey-signup-rule { display:flex; align-items:center; gap:8px; color:#b8c5e7; font-size:12px; }

.journey-signup-rule svg { flex-shrink:0; color:#8d9ac4; }

.journey-signup-rule.valid { color:#80f0c1; }

.journey-signup-rule.valid svg { color:#55e5ab; }

.journey-signup-error { background:rgba(255,71,111,.12); color:#ffc1cd; border:1px solid rgba(255,120,151,.5); border-radius:11px; padding:11px 13px; margin-bottom:14px; font-size:13px; }

.journey-signup-submit { display:flex; align-items:center; justify-content:center; gap:11px; width:100%; height:49px; border:0; border-radius:14px; cursor:pointer; color:white; font-size:17px; font-weight:800; background:linear-gradient(100deg,#c04bf5,#8153f4 48%,#1db7f5); box-shadow:0 12px 27px rgba(93,71,220,.22); }

.journey-signup-submit:disabled { opacity:.65; cursor:wait; }

.journey-signup-switch { text-align:center; font-size:13px; color:#c9d2f2; margin:13px 0 0; }

.journey-signup-switch a { color:#d18aff; font-weight:750; text-decoration:none; }

.journey-signup-back { display:block; margin-top:9px; text-align:center; color:#acbce2; font-size:12px; text-decoration:none; }

/* Compact desktop layout: keep the complete registration form visible without page scrolling at common laptop heights. */

@media (min-width:1001px) and (min-height:620px) and (max-height:900px) {

  .journey-signup-layout { min-height:100dvh; padding-top:10px; padding-bottom:10px; gap:clamp(20px,3vw,48px); align-items:center; }

  .journey-signup-card { padding:16px 24px; border-radius:25px; }

  .journey-signup-brand { margin-bottom:3px; gap:8px; }

  .journey-signup-brand img { width:45px; height:43px; }

  .journey-signup-brand strong { font-size:23px; }

  .journey-signup-page .journey-signup-card h2 { font-size:27px; line-height:1.18; }

  .journey-signup-subtitle { margin:4px 0 11px; font-size:12px; }

  .journey-signup-field { margin-bottom:8px; }

  .journey-signup-field label { margin-bottom:4px; font-size:12px; }

  .journey-signup-names { gap:10px; }

  .journey-signup-input { height:39px; border-radius:10px; font-size:12px; }

  .journey-signup-eye { height:32px; }

  .journey-signup-rules { padding:9px 12px; margin:1px 0 10px; border-radius:12px; }

  .journey-signup-rules > strong { margin-bottom:6px; font-size:12px; }

  .journey-signup-rule-grid { gap:5px 12px; }

  .journey-signup-rule { font-size:11px; gap:6px; }

  .journey-signup-submit { height:43px; border-radius:11px; font-size:15px; }

  .journey-signup-switch { margin-top:8px; font-size:12px; }

  .journey-signup-back { margin-top:5px; font-size:11px; }

  .journey-signup-promo h1 { margin:10px 0; }

  .journey-signup-promo p { line-height:1.45; }

  .journey-signup-pills { margin-top:18px; gap:8px; }

  .journey-signup-pills span { padding:9px 11px; }

}

@media (min-width:1001px) and (max-height:619px) { .journey-signup-layout { align-items:start; } }

@media(max-width:1000px) { .journey-signup-layout { grid-template-columns:1fr; max-width:750px; padding:28px 18px; gap:25px; } .journey-signup-promo { text-align:center; margin:auto; } .journey-signup-promo h1 { font-size:39px; margin:12px 0; } .journey-signup-promo p { margin:0 auto; } .journey-signup-pills { justify-content:center; margin-top:16px; } .journey-signup-card { justify-self:center; } }

@media(max-width:580px) { .journey-signup-card { padding:22px 16px; border-radius:22px; } .journey-signup-names { grid-template-columns:1fr 1fr; } .journey-signup-names .journey-signup-field:last-child { grid-column:1/-1; } .journey-signup-rule-grid { grid-template-columns:1fr; } .journey-signup-promo h1 { font-size:33px; } }



/* Short desktop viewports: keep all controls within the visible page. */

@media (min-width:1001px) and (min-height:580px) and (max-height:850px) {

 .journey-signup-page,.journey-signup-layout { min-height:100dvh; }

 .journey-signup-layout { padding:6px clamp(18px,3vw,48px); gap:24px; }

 .journey-signup-card { padding:11px 20px; border-radius:22px; }

 .journey-signup-brand { margin-bottom:1px; }

 .journey-signup-brand img { width:38px; height:37px; }

 .journey-signup-brand strong { font-size:20px; }

 .journey-signup-page .journey-signup-card h2 { font-size:25px; line-height:1.12; }

 .journey-signup-subtitle { margin:3px 0 7px; font-size:11px; }

 .journey-signup-field { margin-bottom:6px; }

 .journey-signup-field label { margin-bottom:3px; font-size:11px; line-height:1.2; }

 .journey-signup-names { gap:8px; }

 .journey-signup-input { height:34px; font-size:12px; border-radius:9px; }

 .journey-signup-input-wrap > svg { width:16px; height:16px; }

 .journey-signup-eye { height:30px; }

 .journey-signup-rules { padding:7px 10px; margin:0 0 8px; }

 .journey-signup-rules > strong { margin-bottom:4px; font-size:11px; }

 .journey-signup-rule-grid { gap:3px 10px; }

 .journey-signup-rule { font-size:10px; }

 .journey-signup-rule svg { width:12px; height:12px; }

 .journey-signup-submit { height:38px; font-size:14px; }

 .journey-signup-switch { margin-top:5px; font-size:11px; }

 .journey-signup-back { margin-top:3px; font-size:11px; }

 .journey-signup-page .journey-signup-promo h1 { font-size:clamp(36px,3.7vw,55px); margin:8px 0; }

 .journey-signup-promo p { font-size:16px; line-height:1.4; }

 .journey-signup-pills { margin-top:15px; }

 .journey-signup-pills span { padding:7px 9px; font-size:11px; }

}

/* Viewport-aware desktop layout: do not let decorative content push the form below the fold. */

@media (min-width:1001px) {

 .journey-signup-layout { min-height:100dvh; padding-top:8px; padding-bottom:8px; gap:clamp(18px,3vw,48px); }

 .journey-signup-card { padding:12px 22px; border-radius:23px; }

 .journey-signup-brand { margin-bottom:3px; }

 .journey-signup-brand img { width:43px; height:40px; }

 .journey-signup-brand strong { font-size:22px; }

 .journey-signup-page .journey-signup-card h2 { font-size:26px; line-height:1.15; }

 .journey-signup-subtitle { margin:4px 0 10px; font-size:12px; }

 .journey-signup-field { margin-bottom:8px; }

 .journey-signup-field label { margin-bottom:4px; font-size:12px; }

 .journey-signup-input { height:39px; }

 .journey-signup-rules { padding:9px 12px; margin:1px 0 9px; }

 .journey-signup-rules > strong { margin-bottom:6px; }

 .journey-signup-rule-grid { gap:5px 10px; }

 .journey-signup-submit { height:42px; font-size:15px; }

 .journey-signup-switch { margin-top:8px; }

 .journey-signup-back { margin-top:5px; }

}

@media (min-width:1001px) and (max-height:760px) {

 .journey-signup-layout { padding-top:4px; padding-bottom:4px; }

 .journey-signup-card { padding:9px 20px; }

 .journey-signup-brand img { width:36px; height:35px; }

 .journey-signup-brand strong { font-size:20px; }

 .journey-signup-page .journey-signup-card h2 { font-size:23px; }

 .journey-signup-subtitle { margin:2px 0 7px; font-size:11px; }

 .journey-signup-field { margin-bottom:6px; }

 .journey-signup-field label { margin-bottom:3px; }

 .journey-signup-input { height:34px; }

 .journey-signup-rules { padding:6px 10px; margin:0 0 7px; }

 .journey-signup-rules > strong { margin-bottom:4px; }

 .journey-signup-rule-grid { gap:3px 10px; }

 .journey-signup-rule { font-size:10px; }

 .journey-signup-submit { height:37px; }

 .journey-signup-switch { margin-top:5px; }

 .journey-signup-back { margin-top:3px; }

 .journey-signup-page .journey-signup-promo h1 { font-size:clamp(34px,3.4vw,52px); }

 .journey-signup-promo p { font-size:15px; line-height:1.4; }

}

@media(prefers-reduced-motion:reduce) { .journey-signup-page * { transition:none !important; } }


/* Global theme support: Home controls data-theme on the document root. */
:root[data-theme="light"] .journey-signup-page {
  background:#f5f7ff;
  color:#17264a;
}
:root[data-theme="light"] .journey-signup-page::before {
  background:linear-gradient(90deg,rgba(246,249,255,.82),rgba(244,247,255,.91) 46%,rgba(240,245,255,.78) 100%),url("https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1800&q=90") center/cover no-repeat;
}
:root[data-theme="light"] .journey-signup-page::after {
  background:radial-gradient(ellipse at 100% 0%,rgba(146,111,255,.11),transparent 48%),radial-gradient(ellipse at 0% 100%,rgba(41,162,246,.1),transparent 55%);
}
:root[data-theme="light"] .journey-signup-eyebrow { color:#7c49da; }
:root[data-theme="light"] .journey-signup-page .journey-signup-promo h1 { color:#17264a; }
:root[data-theme="light"] .journey-signup-promo p { color:#52678c; }
:root[data-theme="light"] .journey-signup-pills span {
  background:rgba(255,255,255,.78);
  border-color:#d9dff7;
  color:#344a73;
}
:root[data-theme="light"] .journey-signup-card {
  background:linear-gradient(145deg,rgba(255,255,255,.97),rgba(247,249,255,.96));
  border-color:#d7d6f6;
  box-shadow:0 24px 70px rgba(35,50,106,.13),0 0 30px rgba(129,82,244,.06);
}
:root[data-theme="light"] .journey-signup-brand { color:#18264a; }
:root[data-theme="light"] .journey-signup-brand strong span { color:#8a4edb; }
:root[data-theme="light"] .journey-signup-page .journey-signup-card h2 { color:#17264a; }
:root[data-theme="light"] .journey-signup-subtitle { color:#596c8c; }
:root[data-theme="light"] .journey-signup-field label { color:#203253; }
:root[data-theme="light"] .journey-signup-field label em { color:#c43667; }
:root[data-theme="light"] .journey-signup-input {
  background:#f6f8ff;
  border-color:#d0daf2;
  color:#1c2c4f;
}
:root[data-theme="light"] .journey-signup-input::placeholder { color:#7b8aa9; }
:root[data-theme="light"] .journey-signup-input-wrap > svg { color:#687da4; }
:root[data-theme="light"] .journey-signup-input:focus { border-color:#9661ed; box-shadow:0 0 0 3px rgba(150,97,237,.14); }
:root[data-theme="light"] .journey-signup-eye { color:#546b95; }
:root[data-theme="light"] .journey-signup-eye:hover { background:rgba(110,84,207,.09); }
:root[data-theme="light"] .journey-signup-rules {
  background:#f7f4ff;
  border-color:#d9c7fa;
  color:#25365a;
}
:root[data-theme="light"] .journey-signup-rule { color:#61708e; }
:root[data-theme="light"] .journey-signup-rule svg { color:#8693b0; }
:root[data-theme="light"] .journey-signup-rule.valid,
:root[data-theme="light"] .journey-signup-rule.valid svg { color:#087a59; }
:root[data-theme="light"] .journey-signup-error {
  background:#fff0f4;
  border-color:#f1b5c6;
  color:#a91f4b;
}
:root[data-theme="light"] .journey-signup-switch { color:#64738e; }
:root[data-theme="light"] .journey-signup-switch a { color:#7139d3; }
:root[data-theme="light"] .journey-signup-back { color:#54698e; }
:root[data-theme="light"] .journey-signup-submit { color:#fff; }

`;



const passwordRules = [

  { label: "At least 8 characters", test: (value) => value.length >= 8 },

  { label: "One uppercase letter (A–Z)", test: (value) => /[A-Z]/.test(value) },

  { label: "One lowercase letter (a–z)", test: (value) => /[a-z]/.test(value) },

  { label: "One number (0–9)", test: (value) => /\d/.test(value) },

  { label: "One special character (!@#...)", test: (value) => /[^A-Za-z0-9\s]/.test(value) },

];



export default function Signup() {

  const navigate = useNavigate();

  const [formData, setFormData] = useState({ first_name: "", middle_name: "", last_name: "", email: "", password: "", confirmPassword: "" });

  const [showPassword, setShowPassword] = useState(false);

  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const rules = useMemo(() => passwordRules.map((rule) => ({ ...rule, valid: rule.test(formData.password) })), [formData.password]);



  function handleChange(event) {

    const { name, value } = event.target;

    setFormData((previous) => ({ ...previous, [name]: value }));

    if (error) setError("");

  }



  async function handleSubmit(event) {

    event.preventDefault();

    setError("");

    if (!formData.first_name.trim() || !formData.last_name.trim()) {

      setError("Please enter your first and last name.");

      return;

    }

    if (!rules.every((rule) => rule.valid)) {

      setError("Please meet all password requirements.");

      return;

    }

    if (formData.password !== formData.confirmPassword) {

      setError("Passwords do not match.");

      return;

    }

    try {

      setLoading(true);

      await registerUser({

        first_name: formData.first_name.trim(),

        middle_name: formData.middle_name.trim(),

        last_name: formData.last_name.trim(),

        full_name: [formData.first_name, formData.middle_name, formData.last_name].map((part) => part.trim()).filter(Boolean).join(" "),

        email: formData.email.trim(),

        password: formData.password,

      });

      navigate("/dashboard", { replace: true });

    } catch (err) {

      setError(err?.message || "Unable to create your account. Please try again.");

    } finally {

      setLoading(false);

    }

  }



  return (

    <div className="journey-signup-page">

      <style>{STYLES}</style>

      <div className="journey-signup-layout">

        <section className="journey-signup-promo" aria-label="Travel planning introduction">

          <div className="journey-signup-eyebrow">Plan · Explore · Travel</div>

          <h1>Your AI Travel<br /><span className="journey-signup-gradient">Companion</span></h1>

          <p>Create personalized itineraries, discover amazing destinations, and experience smarter travel with multi-agent AI.</p>

          <div className="journey-signup-pills"><span>✦ AI Planning</span><span>⌖ Smart Research</span><span>✈ Complete Trips</span></div>

        </section>

        <section className="journey-signup-card" aria-label="Create your account">

          <Link to="/" className="journey-signup-brand"><img src="/journey-gen-ai-orbit.webp" alt="Journey Gen AI logo" /><strong>Journey <span>Gen AI</span></strong></Link>

          <h2>Create Your Account</h2>

          <p className="journey-signup-subtitle">Join Journey Gen AI and start planning your next adventure.</p>

          {error && <div className="journey-signup-error" role="alert">{error}</div>}

          <form onSubmit={handleSubmit}>

            <div className="journey-signup-names">

              {[

                { name: "first_name", label: "First Name", placeholder: "First name", required: true, autocomplete: "given-name" },

                { name: "middle_name", label: "Middle Name", placeholder: "Optional", required: false, autocomplete: "additional-name" },

                { name: "last_name", label: "Last Name", placeholder: "Last name", required: true, autocomplete: "family-name" },

              ].map((field) => (

                <div className="journey-signup-field" key={field.name}>

                  <label htmlFor={field.name}>{field.label} {field.required && <em>*</em>}</label>

                  <div className="journey-signup-input-wrap"><UserRound size={17} aria-hidden="true" /><input id={field.name} className="journey-signup-input" type="text" name={field.name} placeholder={field.placeholder} value={formData[field.name]} onChange={handleChange} autoComplete={field.autocomplete} maxLength={80} required={field.required} /></div>

                </div>

              ))}

            </div>

            <div className="journey-signup-field">

              <label htmlFor="signup-email">Email Address <em>*</em></label>

              <div className="journey-signup-input-wrap"><Mail size={18} aria-hidden="true" /><input id="signup-email" className="journey-signup-input" type="email" name="email" placeholder="Enter your email address" value={formData.email} onChange={handleChange} autoComplete="email" required /></div>

            </div>

            <div className="journey-signup-field">

              <label htmlFor="signup-password">Password <em>*</em></label>

              <div className="journey-signup-input-wrap"><LockKeyhole size={18} aria-hidden="true" /><input id="signup-password" className="journey-signup-input journey-signup-password" type={showPassword ? "text" : "password"} name="password" placeholder="Create a strong password" value={formData.password} onChange={handleChange} autoComplete="new-password" required /><button type="button" className="journey-signup-eye" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>

            </div>

            <div className="journey-signup-field">

              <label htmlFor="signup-confirm">Confirm Password <em>*</em></label>

              <div className="journey-signup-input-wrap"><LockKeyhole size={18} aria-hidden="true" /><input id="signup-confirm" className="journey-signup-input journey-signup-password" type={showConfirmPassword ? "text" : "password"} name="confirmPassword" placeholder="Confirm your password" value={formData.confirmPassword} onChange={handleChange} autoComplete="new-password" required /><button type="button" className="journey-signup-eye" aria-label={showConfirmPassword ? "Hide password" : "Show password"} onClick={() => setShowConfirmPassword((value) => !value)}>{showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>

            </div>

            <div className="journey-signup-rules" aria-live="polite">

              <strong>Password Requirements</strong>

              <div className="journey-signup-rule-grid">{rules.map((rule) => <span key={rule.label} className={`journey-signup-rule ${rule.valid ? "valid" : ""}`}>{rule.valid ? <Check size={15} /> : <Circle size={15} />}{rule.label}</span>)}</div>

            </div>

            <button className="journey-signup-submit" type="submit" disabled={loading}><UserPlus size={21} />{loading ? "Creating Account..." : "Sign Up"}</button>

          </form>

          <p className="journey-signup-switch">Already have an account? <Link to="/login">Sign In</Link></p>

          <Link className="journey-signup-back" to="/"><Plane size={13} style={{ verticalAlign: "middle" }} /> Back to Home</Link>

        </section>

      </div>

    </div>

  );

}
