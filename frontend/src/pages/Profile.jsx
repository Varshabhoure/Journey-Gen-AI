

import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import {

  ArrowLeft,

  CheckCircle2,

  CircleAlert,

  LoaderCircle,

  Mail,

  Save,

  ShieldCheck,

  UserRound,

} from "lucide-react";

import {

  getCurrentUser,

  updateCurrentUser,

} from "../services/aiService";

import "./Home.css";

const LOGO_PATH = "/journey-gen-ai-logo.png";

const readStoredUser = () => {

  try {

    const value = JSON.parse(localStorage.getItem("user") || "{}");

    return value && typeof value === "object" ? value : {};

  } catch {

    return {};

  }

};

const getProfileFields = (user) => ({

  first_name: user.first_name || user.firstName || "",

  middle_name: user.middle_name || user.middleName || "",

  last_name: user.last_name || user.lastName || "",

});

const getDisplayName = (user) => {

  const name = [

    user.first_name || user.firstName,

    user.middle_name || user.middleName,

    user.last_name || user.lastName,

  ]

    .filter(Boolean)

    .join(" ")

    .trim();

  return name || "Traveler";

};

const inputStyle = {

  width: "100%",

  minHeight: 40,

  borderRadius: 12,

  border: "1px solid rgba(174, 190, 224, 0.24)",

  background: "rgba(10, 18, 39, 0.65)",

  color: "#ffffff",

  padding: "8px 13px",

  fontSize: 14,

  outlineOffset: 3,

  boxSizing: "border-box",

};

const labelStyle = {

  display: "block",

  color: "#dce6ff",

  fontSize: 13,

  fontWeight: 700,

  marginBottom: 5,

};

function Profile() {

  const [user, setUser] = useState(readStoredUser);

  const [form, setForm] = useState(() =>

    getProfileFields(readStoredUser())

  );

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  useEffect(() => {

    let active = true;

    async function loadProfile() {

      try {

        const response = await getCurrentUser();

        const freshUser =

          response?.user ??

          response?.data?.user ??

          response?.data ??

          response;

        if (

          !active ||

          !freshUser ||

          typeof freshUser !== "object" ||

          Array.isArray(freshUser)

        ) {

          return;

        }

        const mergedUser = {

          ...readStoredUser(),

          ...freshUser,

        };

        localStorage.setItem("user", JSON.stringify(mergedUser));

        setUser(mergedUser);

        setForm(getProfileFields(mergedUser));

        setError("");

      } catch (err) {

        if (active) {

          setError(

            err.message ||

              "Unable to load your latest profile information."

          );

        }

      } finally {

        if (active) {

          setLoading(false);

        }

      }

    }

    loadProfile();

    return () => {

      active = false;

    };

  }, []);

  const handleChange = (event) => {

    const { name, value } = event.target;

    setForm((previous) => ({

      ...previous,

      [name]: value,

    }));

    setError("");

    setSuccess("");

  };

  const handleSubmit = async (event) => {

    event.preventDefault();

    if (saving) return;

    const cleaned = {

      first_name: form.first_name.trim(),

      middle_name: form.middle_name.trim(),

      last_name: form.last_name.trim(),

    };

    if (!cleaned.first_name) {

      setError("Please enter your first name.");

      return;

    }

    setSaving(true);

    setError("");

    setSuccess("");

    try {

      const response = await updateCurrentUser(cleaned);

      const updatedUser =

        response?.user ??

        response?.data?.user ??

        response?.data ??

        response;

      const mergedUser = {

        ...readStoredUser(),

        ...(updatedUser && typeof updatedUser === "object"

          ? updatedUser

          : {}),

        ...cleaned,

      };

      localStorage.setItem("user", JSON.stringify(mergedUser));

      setUser(mergedUser);

      setForm(getProfileFields(mergedUser));

      setSuccess("Your profile has been updated successfully.");

    } catch (err) {

      setError(

        err.message ||

          "Unable to save your changes. Please try again."

      );

    } finally {

      setSaving(false);

    }

  };

  const displayName = getDisplayName(user);

  const initials = displayName

    .split(/\s+/)

    .slice(0, 2)

    .map((part) => part.charAt(0).toUpperCase())

    .join("");

  return (

    <div

      className="jg-dark-home jg-profile-page"

      style={{

        minHeight: "100vh",

        background: "#080f24",

        color: "#ffffff",

        boxSizing: "border-box",

      }}

    >

      <style>

        {`

          .jg-profile-page {

            width: 100%;

            overflow-x: hidden;

          }

          .jg-profile-page .profile-name-grid {

            grid-template-columns: repeat(3, minmax(0, 1fr));

          }

          .jg-profile-page .profile-name-grid > div {

            min-width: 0;

          }

          .jg-profile-page .profile-brand {

            display: flex;

            align-items: center;

            gap: 10px;

            text-decoration: none;

            flex-shrink: 0;

          }

          .jg-profile-page .profile-brand-logo {

            width: 55px;

            height: 55px;

            object-fit: contain;

            border-radius: 12px;

            flex-shrink: 0;

          }

          .jg-profile-page .profile-brand-text {

            display: flex;

            flex-direction: column;

            align-items: flex-start;

            justify-content: center;

            line-height: 1.05;

            font-size: 20px;

            font-weight: 900;

            letter-spacing: -0.5px;

            white-space: nowrap;

          }

          .jg-profile-page .profile-brand-journey {

            color: #ffffff !important;

          }

          .jg-profile-page .profile-brand-genai {

            background: linear-gradient(

              90deg,

              #a78bfa 0%,

              #b76cff 50%,

              #e879f9 100%

            );

            -webkit-background-clip: text;

            background-clip: text;

            -webkit-text-fill-color: transparent;

            color: #b76cff;

          }

          .jg-profile-page .profile-card {

            background: linear-gradient(

              135deg,

              #202d57 0%,

              #17234b 100%

            );

            border: 1px solid rgba(174, 190, 224, 0.12);

            border-radius: 18px;

          }

          .jg-profile-page input::placeholder {

            color: #7584a6;

          }

          .jg-profile-page input:focus {

            outline: 2px solid #a78bfa;

            outline-offset: 1px;

          }

          .jg-profile-page .profile-save-button:hover:not(:disabled) {

            background: #895ff0 !important;

          }

          /* Global theme follows App.jsx: dark is the existing default. */
          :root[data-theme="light"] .jg-profile-page {
            background: #f6f7fd !important;
            color: #202a48 !important;
            color-scheme: light;
          }
          :root[data-theme="light"] .jg-profile-page .profile-card {
            background: #ffffff !important;
            border-color: #dce2f0 !important;
            box-shadow: 0 10px 30px rgba(34, 48, 89, .06);
          }
          :root[data-theme="light"] .jg-profile-page .profile-brand-journey {
            color: #202a48 !important;
            -webkit-text-fill-color: #202a48 !important;
          }
          :root[data-theme="light"] .jg-profile-page .profile-header > a:first-child,
          :root[data-theme="light"] .jg-profile-page h1,
          :root[data-theme="light"] .jg-profile-page h2,
          :root[data-theme="light"] .jg-profile-page label {
            color: #202a48 !important;
            -webkit-text-fill-color: #202a48 !important;
          }
          :root[data-theme="light"] .jg-profile-page section > p,
          :root[data-theme="light"] .jg-profile-page .profile-card p,
          :root[data-theme="light"] .jg-profile-page .profile-form-actions > div,
          :root[data-theme="light"] .jg-profile-page [role="status"] {
            color: #596781 !important;
          }
          :root[data-theme="light"] .jg-profile-page input {
            background: #f8f9ff !important;
            color: #202a48 !important;
            border-color: #d6ddef !important;
            color-scheme: light;
          }
          :root[data-theme="light"] .jg-profile-page input::placeholder {
            color: #7a859d !important;
          }
          :root[data-theme="light"] .jg-profile-page .profile-form-actions {
            border-top-color: #dce2f0 !important;
          }
          :root[data-theme="light"] .jg-profile-page [role="alert"] {
            color: #a11e46 !important;
            background: #fff1f3 !important;
            border-color: #f3b8c8 !important;
          }
          :root[data-theme="light"] .jg-profile-page .profile-save-button {
            color: #fff !important;
          }

          @media (max-width: 700px) {

            .jg-profile-page .profile-name-grid {

              grid-template-columns: 1fr;

            }

            .jg-profile-page .profile-brand-logo {

              width: 42px;

              height: 42px;

            }

            .jg-profile-page .profile-brand-text {

              font-size: 17px;

            }

            .jg-profile-page .profile-header {

              align-items: flex-start;

            }

            .jg-profile-page .profile-form-actions {

              align-items: stretch;

              flex-direction: column;

            }

            .jg-profile-page .profile-save-button {

              width: 100%;

            }

          }

          @media (min-width: 701px) and (max-width: 850px) {

            .jg-profile-page .profile-name-grid {

              grid-template-columns: repeat(2, minmax(0, 1fr));

            }

          }

        `}

      </style>

      <main

        style={{

          width: "100%",

          maxWidth: 1500,

          margin: "0 auto",

          padding:

            "clamp(8px, 1.4vh, 12px) clamp(16px, 3vw, 40px)",

          boxSizing: "border-box",

        }}

      >

        {/* HEADER */}

        <header

          className="profile-header"

          style={{

            display: "flex",

            justifyContent: "space-between",

            alignItems: "center",

            gap: 12,

            marginBottom: 9,

            flexWrap: "wrap",

          }}

        >

          <Link

            to="/"

            style={{

              display: "inline-flex",

              alignItems: "center",

              gap: 8,

              color: "#dce6ff",

              textDecoration: "none",

              fontWeight: 700,

              fontSize: 14,

            }}

          >

            <ArrowLeft size={18} />

            Back to Home

          </Link>

          {/* JOURNEY GEN AI LOGO + BRAND NAME */}

          <Link

            to="/"

            className="profile-brand"

            aria-label="Journey Gen AI Home"

          >

            <img

              src={LOGO_PATH}

              alt="Journey Gen AI logo"

              className="profile-brand-logo"

            />

            <span className="profile-brand-text">

              <span className="profile-brand-journey">

                Journey

              </span>

              <span className="profile-brand-genai">

                Gen AI

              </span>

            </span>

          </Link>

        </header>

        {/* PAGE TITLE */}

        <section style={{ marginBottom: 9 }}>

          <div

            style={{

              display: "flex",

              alignItems: "center",

              gap: 8,

              color: "#b88aff",

              fontSize: 12,

              fontWeight: 700,

              marginBottom: 4,

            }}

          >

            <UserRound size={16} />

            ACCOUNT SETTINGS

          </div>

          <h1

            style={{

              color: "#ffffff",

              fontSize: "clamp(26px, 3vw, 34px)",

              fontWeight: 850,

              letterSpacing: "-1px",

              margin: "0 0 3px",

              lineHeight: 1.15,

            }}

          >

            My Profile

          </h1>

          <p

            style={{

              color: "#aebee0",

              fontSize: 13,

              margin: 0,

              lineHeight: 1.5,

            }}

          >

            Manage your personal information and keep your

            Journey Gen AI account up to date.

          </p>

        </section>

        {/* ACCOUNT INFORMATION */}

        <section

          className="profile-card"

          style={{

            padding: "10px 18px",

            marginBottom: 9,

          }}

        >

          <div

            style={{

              display: "flex",

              alignItems: "center",

              gap: 14,

              flexWrap: "wrap",

            }}

          >

            <div

              style={{

                width: 50,

                height: 50,

                borderRadius: 14,

                display: "grid",

                placeItems: "center",

                background:

                  "linear-gradient(135deg, #7952db, #a875f5)",

                color: "#ffffff",

                fontSize: 21,

                fontWeight: 800,

                flexShrink: 0,

              }}

            >

              {initials}

            </div>

            <div style={{ minWidth: 0 }}>

              <h2

                style={{

                  color: "#ffffff",

                  fontSize: 20,

                  fontWeight: 800,

                  margin: "0 0 4px",

                }}

              >

                {displayName}

              </h2>

              <p

                style={{

                  display: "flex",

                  alignItems: "center",

                  gap: 7,

                  color: "#aebee0",

                  fontSize: 13,

                  margin: 0,

                  overflowWrap: "anywhere",

                }}

              >

                <Mail size={15} />

                {user.email || "Email unavailable"}

              </p>

            </div>

          </div>

        </section>

        {/* PERSONAL INFORMATION */}

        <section

          className="profile-card"

          style={{

            padding: "clamp(12px, 1.5vw, 16px)",

          }}

        >

          <div style={{ marginBottom: 10 }}>

            <h2

              style={{

                color: "#ffffff",

                fontSize: 20,

                fontWeight: 800,

                margin: "0 0 4px",

              }}

            >

              Personal Information

            </h2>

            <p

              style={{

                color: "#aebee0",

                fontSize: 13,

                lineHeight: 1.5,

                margin: 0,

              }}

            >

              Your name will appear in your Home page greeting

              and account profile.

            </p>

          </div>

          {loading ? (

            <div

              role="status"

              style={{

                display: "flex",

                alignItems: "center",

                gap: 10,

                color: "#aebee0",

                padding: "16px 0",

              }}

            >

              <LoaderCircle size={19} />

              Loading profile information...

            </div>

          ) : (

            <form onSubmit={handleSubmit}>

              {/* NAME FIELDS */}

              <div

                className="profile-name-grid"

                style={{

                  display: "grid",

                  gap: 12,

                  marginBottom: 10,

                }}

              >

                <div>

                  <label

                    htmlFor="profile-first-name"

                    style={labelStyle}

                  >

                    First Name *

                  </label>

                  <input

                    id="profile-first-name"

                    type="text"

                    name="first_name"

                    value={form.first_name}

                    onChange={handleChange}

                    required

                    maxLength={100}

                    autoComplete="given-name"

                    placeholder="Enter first name"

                    style={inputStyle}

                  />

                </div>

                <div>

                  <label

                    htmlFor="profile-middle-name"

                    style={labelStyle}

                  >

                    Middle Name (Optional)

                  </label>

                  <input

                    id="profile-middle-name"

                    type="text"

                    name="middle_name"

                    value={form.middle_name}

                    onChange={handleChange}

                    maxLength={100}

                    placeholder="Enter middle name"

                    style={inputStyle}

                  />

                </div>

                <div>

                  <label

                    htmlFor="profile-last-name"

                    style={labelStyle}

                  >

                    Last Name

                  </label>

                  <input

                    id="profile-last-name"

                    type="text"

                    name="last_name"

                    value={form.last_name}

                    onChange={handleChange}

                    maxLength={100}

                    autoComplete="family-name"

                    placeholder="Enter last name"

                    style={inputStyle}

                  />

                </div>

              </div>

              {/* EMAIL FIELD */}

              <div style={{ marginBottom: 10 }}>

                <label

                  htmlFor="profile-email"

                  style={labelStyle}

                >

                  Email Address

                </label>

                <input

                  id="profile-email"

                  type="email"

                  value={user.email || ""}

                  disabled

                  readOnly

                  style={{

                    ...inputStyle,

                    opacity: 0.65,

                    cursor: "not-allowed",

                  }}

                />

                <p

                  style={{

                    color: "#8393b7",

                    fontSize: 11,

                    margin: "5px 0 0",

                  }}

                >

                  Your email address cannot be changed here.

                </p>

              </div>

              {/* ERROR MESSAGE */}

              {error && (

                <div

                  role="alert"

                  style={{

                    display: "flex",

                    alignItems: "center",

                    gap: 9,

                    padding: 10,

                    borderRadius: 10,

                    marginBottom: 12,

                    background: "rgba(248, 113, 113, 0.1)",

                    border:

                      "1px solid rgba(248, 113, 113, 0.3)",

                    color: "#ffc4ce",

                    fontSize: 13,

                  }}

                >

                  <CircleAlert size={18} />

                  {error}

                </div>

              )}

              {/* SUCCESS MESSAGE */}

              {success && (

                <div

                  role="status"

                  style={{

                    display: "flex",

                    alignItems: "center",

                    gap: 9,

                    padding: 10,

                    borderRadius: 10,

                    marginBottom: 12,

                    background: "rgba(52, 211, 153, 0.1)",

                    border:

                      "1px solid rgba(52, 211, 153, 0.3)",

                    color: "#a7f3d0",

                    fontSize: 13,

                  }}

                >

                  <CheckCircle2 size={18} />

                  {success}

                </div>

              )}

              {/* SAVE BUTTON */}

              <div

                className="profile-form-actions"

                style={{

                  display: "flex",

                  alignItems: "center",

                  justifyContent: "space-between",

                  flexWrap: "wrap",

                  gap: 12,

                  borderTop:

                    "1px solid rgba(174,190,224,0.15)",

                  paddingTop: 10,

                }}

              >

                <div

                  style={{

                    display: "flex",

                    alignItems: "center",

                    gap: 8,

                    color: "#aebee0",

                    fontSize: 12,

                  }}

                >

                  <ShieldCheck

                    size={17}

                    color="#a78bfa"

                  />

                  Your changes are saved to your account.

                </div>

                <button

                  type="submit"

                  disabled={saving}

                  className="profile-save-button"

                  style={{

                    display: "inline-flex",

                    alignItems: "center",

                    justifyContent: "center",

                    gap: 9,

                    padding: "11px 20px",

                    border: "none",

                    borderRadius: 11,

                    background: saving

                      ? "#51416e"

                      : "#7952db",

                    color: "#ffffff",

                    fontSize: 14,

                    fontWeight: 800,

                    cursor: saving ? "wait" : "pointer",

                  }}

                >

                  {saving ? (

                    <LoaderCircle size={17} />

                  ) : (

                    <Save size={17} />

                  )}

                  {saving ? "Saving..." : "Save Changes"}

                </button>

              </div>

            </form>

          )}

        </section>

      </main>

    </div>

  );

}

export default Profile;
