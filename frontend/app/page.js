"use client";

import { useState, useCallback, useRef } from "react";

/* ── Category → emoji map for visual flair ────────────────── */
const CATEGORY_ICONS = {
  ACCOUNTANT: "📊",
  ADVOCATE: "⚖️",
  AGRICULTURE: "🌾",
  APPAREL: "👗",
  ARTS: "🎨",
  AUTOMOBILE: "🚗",
  AVIATION: "✈️",
  BANKING: "🏦",
  BPO: "📞",
  "BUSINESS-DEVELOPMENT": "📈",
  CHEF: "👨‍🍳",
  CONSTRUCTION: "🏗️",
  CONSULTANT: "💼",
  DESIGNER: "🎯",
  "DIGITAL-MEDIA": "📱",
  ENGINEERING: "⚙️",
  FINANCE: "💰",
  FITNESS: "💪",
  HEALTHCARE: "🏥",
  HR: "👥",
  "INFORMATION-TECHNOLOGY": "💻",
  "PUBLIC-RELATIONS": "📣",
  SALES: "🤝",
  TEACHER: "📚",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"];

export default function Home() {
  const [mode, setMode] = useState("paste"); // "paste" or "upload"
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  /* ── Analyze via text paste ──────────────────────────────── */
  const handleAnalyzeText = useCallback(async () => {
    if (!text.trim() || text.trim().length < 20) {
      setError("Please enter at least 20 characters of resume text.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`${API_URL}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `Server error (${res.status})`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot reach the API server. Make sure the backend is running on port 8000."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }, [text]);

  /* ── Analyze via file upload ─────────────────────────────── */
  const handleAnalyzeFile = useCallback(async () => {
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_URL}/predict/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `Server error (${res.status})`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot reach the API server. Make sure the backend is running on port 8000."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }, [file]);

  /* ── Dispatch analyze based on active mode ───────────────── */
  const handleAnalyze = mode === "paste" ? handleAnalyzeText : handleAnalyzeFile;

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleAnalyze();
    }
  };

  /* ── File selection helpers ──────────────────────────────── */
  const validateAndSetFile = (f) => {
    const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file type: "${ext}". Please upload a PDF, DOCX, or TXT file.`);
      return;
    }
    setError("");
    setFile(f);
    setResult(null);
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) validateAndSetFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) validateAndSetFile(f);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const removeFile = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const canAnalyze =
    mode === "paste" ? text.trim().length >= 20 : file !== null;

  /* ── File size formatter ─────────────────────────────────── */
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="app-wrapper">
      {/* ── Nav ──────────────────────────────────────────── */}
      <nav className="nav">
        <div className="container nav-inner">
          <div className="nav-logo">🧠</div>
          <span className="nav-title">ResumeAI</span>
          <span className="nav-badge">DistilBERT</span>
        </div>
      </nav>

      <main className="container">
        {/* ── Hero ────────────────────────────────────────── */}
        <section className="hero">
          <div className="hero-eyebrow">
            <span>⚡</span> AI-Powered Classification
          </div>
          <h1>
            Classify Resumes with{" "}
            <span className="gradient-text">Machine Learning</span>
          </h1>
          <p>
            Paste resume text or upload a file and our fine-tuned DistilBERT
            model will predict the best-matching job category across 24
            industries.
          </p>
        </section>

        {/* ── Mode Toggle ────────────────────────────────── */}
        <div className="mode-toggle">
          <button
            className={`mode-btn ${mode === "paste" ? "active" : ""}`}
            onClick={() => { setMode("paste"); setError(""); setResult(null); }}
            id="mode-paste"
          >
            📝 Paste Text
          </button>
          <button
            className={`mode-btn ${mode === "upload" ? "active" : ""}`}
            onClick={() => { setMode("upload"); setError(""); setResult(null); }}
            id="mode-upload"
          >
            📄 Upload File
          </button>
        </div>

        {/* ── Input Card ─────────────────────────────────── */}
        <div className="glass-card">
          {mode === "paste" ? (
            <>
              <div className="card-label">
                <span className="dot" />
                Resume Text
              </div>
              <textarea
                id="resume-input"
                className="resume-textarea"
                placeholder={"Paste your resume text here…\n\nExample: Experienced software engineer with 5+ years in Python, React, and cloud infrastructure. Led a team of 8 developers to deliver a microservices platform…"}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
              />
              <div className="textarea-footer">
                <span className="char-count">
                  {text.length.toLocaleString()} characters
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="card-label">
                <span className="dot" />
                Upload Resume
              </div>

              {!file ? (
                <div
                  className={`upload-zone ${dragging ? "dragging" : ""}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  id="upload-zone"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.docx,.txt"
                    hidden
                  />
                  <div className="upload-icon">📁</div>
                  <div className="upload-text">
                    <strong>Drop your resume here</strong> or click to browse
                  </div>
                  <div className="upload-hint">
                    Supports PDF, DOCX, and TXT files
                  </div>
                </div>
              ) : (
                <div className="file-preview">
                  <div className="file-info">
                    <div className="file-icon">
                      {file.name.endsWith(".pdf")
                        ? "📕"
                        : file.name.endsWith(".docx")
                        ? "📘"
                        : "📄"}
                    </div>
                    <div className="file-details">
                      <div className="file-name">{file.name}</div>
                      <div className="file-size">{formatSize(file.size)}</div>
                    </div>
                    <button
                      className="file-remove"
                      onClick={removeFile}
                      title="Remove file"
                      id="remove-file-btn"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Analyze Button ─────────────────────────────── */}
          <div className="textarea-footer" style={{ marginTop: 12 }}>
            <div />
            <button
              id="analyze-btn"
              className="btn-analyze"
              onClick={handleAnalyze}
              disabled={loading || !canAnalyze}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Analyzing…
                </>
              ) : (
                <>🔍 Analyze Resume</>
              )}
            </button>
          </div>
        </div>

        {/* ── Error ──────────────────────────────────────── */}
        {error && (
          <div className="error-banner" role="alert" id="error-banner">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {/* ── Results ────────────────────────────────────── */}
        {result && (
          <div className="results-section" id="results-section">
            <div className="glass-card">
              {/* Extracted text preview (file upload only) */}
              {result.extracted_text && (
                <div className="extracted-preview">
                  <div className="card-label">
                    <span className="dot" style={{ background: "var(--success)" }} />
                    Extracted Text Preview
                  </div>
                  <div className="extracted-text">{result.extracted_text}</div>
                </div>
              )}

              {/* Primary prediction */}
              <div className="primary-result">
                <div className="result-icon">
                  {CATEGORY_ICONS[result.predicted_category] || "📄"}
                </div>
                <div className="result-details">
                  <div className="result-label">Predicted Category</div>
                  <div className="result-category">
                    {formatCategory(result.predicted_category)}
                  </div>
                </div>
                <div className="result-confidence-badge">
                  {(result.confidence * 100).toFixed(1)}%
                </div>
              </div>

              {/* Top-5 bar chart */}
              <div className="categories-header">
                <span className="dot" style={{ background: "var(--accent-end)" }} />
                Top Predictions
              </div>

              {result.top_categories.map((cat, i) => (
                <div className="category-row" key={cat.category}>
                  <span className="category-rank">{i + 1}</span>
                  <span className="category-name" title={formatCategory(cat.category)}>
                    {CATEGORY_ICONS[cat.category] || "📄"}{" "}
                    {formatCategory(cat.category)}
                  </span>
                  <div className="category-bar-track">
                    <div
                      className={`category-bar-fill rank-${i + 1}`}
                      style={{
                        width: `${Math.max(cat.confidence * 100, 2)}%`,
                      }}
                    />
                  </div>
                  <span className="category-pct">
                    {(cat.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="footer">
        Built with <span>♥</span> — DistilBERT · FastAPI · Next.js
      </footer>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────── */
function formatCategory(raw) {
  return raw
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
