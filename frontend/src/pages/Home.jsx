import { Link } from "react-router-dom";
import {
  Clock,
  CheckSquare,
  MessageSquare,
  BarChart3,
  ShieldCheck,
  Building2,
  ArrowRight,
  Lock,
  CheckCircle2,
  FileSpreadsheet,
  Users,
  Award,
  CalendarCheck
} from "lucide-react";

function Home() {
  return (
    <div className="home-page">
      {/* HERO SECTION */}
      <section className="hero-section" id="home">
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-pill">
              <ShieldCheck size={14} />
              <span>Aravind &amp; Associates • Internal Practice Portal</span>
            </div>

            <h1 className="hero-headline">
              Smart Associate.
              <br />
              <span>CA Practice Management</span>
              <br />
              Elevated.
            </h1>

            <p className="hero-description">
              The unified internal operations portal for Aravind &amp; Associates.
              Manage daily article attendance, track client tax and audit engagements,
              communicate across engagement teams, and maintain practice compliance seamlessly.
            </p>

            <div className="hero-actions">
              <Link to="/login" className="btn btn-primary btn-lg">
                <Lock size={16} />
                <span>Access Staff Portal</span>
                <ArrowRight size={16} />
              </Link>

              <a href="#features" className="btn btn-secondary btn-lg">
                <span>Explore Modules</span>
              </a>
            </div>

            <div className="hero-meta-strip">
              <div className="hero-meta-item">
                <CheckCircle2 size={16} color="var(--success)" />
                <span>ICAI Article Compliance</span>
              </div>
              <div className="hero-meta-item">
                <CheckCircle2 size={16} color="var(--success)" />
                <span>GST &amp; Audit Workflows</span>
              </div>
              <div className="hero-meta-item">
                <CheckCircle2 size={16} color="var(--success)" />
                <span>Secure In-House Chat</span>
              </div>
            </div>
          </div>

          {/* DASHBOARD PREVIEW WIDGET */}
          <div className="hero-preview-card">
            <div className="preview-header">
              <div className="preview-title">
                <strong>Practice Operations Overview</strong>
                <span>Aravind &amp; Associates • Live Stream</span>
              </div>

              <div className="preview-status">
                <span className="live-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)" }}></span>
                <span>Office Active</span>
              </div>
            </div>

            <div className="preview-stats-row">
              <div className="preview-stat-box">
                <span>Associates</span>
                <strong>24</strong>
              </div>
              <div className="preview-stat-box">
                <span>Present</span>
                <strong style={{ color: "var(--success)" }}>18</strong>
              </div>
              <div className="preview-stat-box">
                <span>Filings Due</span>
                <strong style={{ color: "var(--primary-blue)" }}>12</strong>
              </div>
            </div>

            <div className="preview-progress-box">
              <div className="progress-info">
                <strong>Monthly Compliance Target</strong>
                <span>78% Achieved</span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: "78%" }}></div>
              </div>
            </div>

            <div className="preview-recent-activity">
              <div className="activity-badge-icon">
                <CheckCircle2 size={18} />
              </div>
              <div className="activity-text">
                <strong>Attendance Confirmed</strong>
                <span>18 associates &amp; articles logged in today</span>
              </div>
              <span className="badge badge-slate" style={{ fontSize: "11px" }}>09:15 AM</span>
            </div>
          </div>
        </div>
      </section>

      {/* CORE PLATFORM MODULES */}
      <section className="features-section" id="features">
        <div className="section-container">
          <div className="section-header">
            <div className="section-pill">
              <Award size={13} />
              <span>Integrated Modules</span>
            </div>
            <h2 className="section-title">Engineered for Chartered Accountants</h2>
            <p className="section-subtitle">
              Every feature is tailor-made to handle statutory timelines, client documentation,
              working hours logging, and team coordination.
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon-wrap">
                <Clock size={24} />
              </div>
              <h3>Biometric &amp; Daily Attendance</h3>
              <p>
                Precise daily check-in and check-out recording for articled clerks and
                audit staff with historical records and monthly attendance logs.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrap" style={{ background: "var(--purple-bg)", color: "var(--purple)" }}>
                <CheckSquare size={24} />
              </div>
              <h3>Client Work Tracking</h3>
              <p>
                Track Income Tax, GST, TDS returns, and statutory audit tasks.
                Monitor filing cut-offs, priority assignments, and client deliverables.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrap" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
                <MessageSquare size={24} />
              </div>
              <h3>Internal Team Messaging</h3>
              <p>
                Private, confidential associate-to-associate and audit team messaging.
                Coordinate tax queries and review notes instantly in real-time.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon-wrap" style={{ background: "var(--info-bg)", color: "var(--info)" }}>
                <BarChart3 size={24} />
              </div>
              <h3>Practice Compliance &amp; Review</h3>
              <p>
                Comprehensive management insights into task bottlenecks, pending reviews,
                partner sign-offs, and associate workload balance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRACTICE FOCUS / ABOUT FIRM */}
      <section className="practice-section" id="practice">
        <div className="section-container">
          <div className="practice-grid">
            <div className="practice-info">
              <div className="section-pill" style={{ alignSelf: "flex-start" }}>
                <Building2 size={13} />
                <span>About Aravind &amp; Associates</span>
              </div>
              <h2>Built to uphold highest professional standards.</h2>
              <p>
                Aravind &amp; Associates is a premier Chartered Accountant firm offering
                taxation advisory, statutory audits, corporate finance, and compliance services.
              </p>
              <p>
                Smart Associate modernizes our internal workflow so our team can spend less time
                chasing timesheets and more time delivering exceptional financial advisory and audit precision.
              </p>
              <div style={{ marginTop: "8px" }}>
                <Link to="/login" className="btn btn-primary">
                  <span>Sign In as Staff Associate</span>
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>

            <div className="firm-pillars">
              <div className="pillar-card">
                <span className="pillar-number">PILLAR 01</span>
                <strong>Confidentiality &amp; Security</strong>
                <span>All client data and engagement notes stay strictly within our firm boundary.</span>
              </div>

              <div className="pillar-card">
                <span className="pillar-number">PILLAR 02</span>
                <strong>Statutory Timeliness</strong>
                <span>Never miss a GST, Advance Tax, or MCA filing deadline with active task queues.</span>
              </div>

              <div className="pillar-card">
                <span className="pillar-number">PILLAR 03</span>
                <strong>Article Development</strong>
                <span>Track training hours, exposure across tax and audit fields, and continuous learning.</span>
              </div>

              <div className="pillar-card">
                <span className="pillar-number">PILLAR 04</span>
                <strong>Audit Precision</strong>
                <span>Structured working paper tracking, partner review checklists, and milestone sign-offs.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CALL TO ACTION */}
      <section className="cta-banner" id="contact">
        <div className="cta-container">
          <div className="cta-text">
            <h2>Ready to begin your work day?</h2>
            <p>Access your assigned tasks, submit attendance, and collaborate with your audit lead.</p>
          </div>

          <Link to="/login" className="cta-btn-white">
            Staff Portal Login →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer-section" id="about">
        <div className="footer-container">
          <div className="footer-top">
            <div className="footer-firm-info">
              <div className="footer-logo">
                <img src="/smart-audit-circle.png" alt="" className="footer-logo-image" />
                <span className="footer-firm-title">Aravind &amp; Associates</span>
              </div>
              <p className="footer-firm-desc">
                Chartered Accountants • Internal Staff Management Portal &amp; Practice Information System.
                Designed for staff, partners, and articled associates.
              </p>
            </div>

            <div style={{ display: "flex", gap: "40px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <strong style={{ color: "#ffffff", fontSize: "13px" }}>Navigation</strong>
                <a href="#home" style={{ fontSize: "12.5px" }}>Overview</a>
                <a href="#features" style={{ fontSize: "12.5px" }}>Platform Modules</a>
                <a href="#practice" style={{ fontSize: "12.5px" }}>Practice Focus</a>
                <Link to="/login" style={{ fontSize: "12.5px", color: "#93c5fd" }}>Staff Login</Link>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <strong style={{ color: "#ffffff", fontSize: "13px" }}>Security &amp; IT</strong>
                <Link to="/backend-test" style={{ fontSize: "12.5px" }}>System Diagnostic</Link>
                <span style={{ fontSize: "12.5px", color: "#64748b" }}>256-bit Encrypted</span>
                <span style={{ fontSize: "12.5px", color: "#64748b" }}>ICAI Compliant</span>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <span>&copy; {new Date().getFullYear()} Aravind &amp; Associates, Chartered Accountants. All rights reserved.</span>
            <span>Smart Associate v2.4 (Enterprise Edition)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Home;