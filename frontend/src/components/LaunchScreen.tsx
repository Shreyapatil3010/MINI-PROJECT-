import React, { useEffect, useState, useRef } from "react";

interface Props {
  onComplete: () => void;
  duration?: number; // ms
}

const LaunchScreen: React.FC<Props> = ({ onComplete, duration = 3200 }) => {
  const [phase, setPhase] = useState<"enter" | "visible" | "exit">("enter");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  /* ── Particle canvas ─────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    type Particle = {
      x: number; y: number; vx: number; vy: number;
      r: number; alpha: number; color: string;
    };

    const colors = ["#10b981", "#3b82f6", "#6366f1", "#34d399", "#60a5fa"];
    const particles: Particle[] = Array.from({ length: 90 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 0.5,
      alpha: Math.random() * 0.6 + 0.1,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  /* ── Phase timing ────────────────────────────────────────── */
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("visible"), 100);
    const t2 = setTimeout(() => setPhase("exit"), duration - 700);
    const t3 = setTimeout(() => onComplete(), duration);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [duration, onComplete]);

  const visible = phase === "visible";
  const exiting = phase === "exit";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "radial-gradient(ellipse at 30% 40%, #0a1628 0%, #060d1a 60%, #020609 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        opacity: exiting ? 0 : 1,
        transition: exiting ? "opacity 0.7s cubic-bezier(0.4,0,0.2,1)" : "none",
      }}
    >
      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />

      {/* Ambient light blobs */}
      <div style={{
        position: "absolute", top: "10%", left: "15%",
        width: 500, height: 500,
        background: "radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)",
        borderRadius: "50%", pointerEvents: "none",
        animation: "blobFloat 6s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", bottom: "10%", right: "10%",
        width: 400, height: 400,
        background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
        borderRadius: "50%", pointerEvents: "none",
        animation: "blobFloat 8s ease-in-out infinite reverse",
      }} />
      <div style={{
        position: "absolute", top: "40%", right: "20%",
        width: 300, height: 300,
        background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)",
        borderRadius: "50%", pointerEvents: "none",
        animation: "blobFloat 7s ease-in-out infinite 2s",
      }} />

      {/* Floating document cards */}
      {[
        { top: "12%", left: "8%",  rotate: "-15deg", delay: "0.4s",  scale: 0.85 },
        { top: "20%", right: "9%", rotate: "12deg",  delay: "0.7s",  scale: 0.75 },
        { bottom: "22%", left: "6%",  rotate: "8deg",  delay: "1s",    scale: 0.7  },
        { bottom: "15%", right: "8%", rotate: "-10deg", delay: "0.5s", scale: 0.8  },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            ...pos,
            width: 88,
            height: 112,
            background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: 10,
            backdropFilter: "blur(8px)",
            transform: `rotate(${pos.rotate}) scale(${visible ? pos.scale : 0.3})`,
            opacity: visible ? 0.75 : 0,
            transition: `all 0.9s cubic-bezier(0.34,1.56,0.64,1) ${pos.delay}`,
            animation: visible ? `docFloat${i} ${4 + i}s ease-in-out infinite ${pos.delay}` : "none",
            padding: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
          }}
        >
          {/* Mini doc lines */}
          {[0,1,2,3,4].map(l => (
            <div key={l} style={{
              height: 2, borderRadius: 2,
              marginBottom: 6,
              width: `${l === 0 ? 70 : l === 2 ? 55 : 80}%`,
              background: l === 0
                ? "linear-gradient(90deg, #10b981, #3b82f6)"
                : "rgba(255,255,255,0.12)",
            }} />
          ))}
          <div style={{
            marginTop: 8,
            display: "flex", gap: 3, alignItems: "flex-end", height: 28,
          }}>
            {[60,90,45,75,55].map((h, bi) => (
              <div key={bi} style={{
                flex: 1, height: `${h}%`, borderRadius: "2px 2px 0 0",
                background: bi === 3
                  ? "rgba(16,185,129,0.6)"
                  : "rgba(59,130,246,0.3)",
              }} />
            ))}
          </div>
        </div>
      ))}

      {/* ── Central 3D Orb ── */}
      <div
        style={{
          position: "relative",
          width: 160,
          height: 160,
          marginBottom: 40,
          transform: visible ? "scale(1) translateY(0)" : "scale(0.4) translateY(40px)",
          opacity: visible ? 1 : 0,
          transition: "all 1s cubic-bezier(0.34,1.56,0.64,1) 0.1s",
        }}
      >
        {/* Outer glow rings */}
        {[1, 0.6, 0.3].map((opacity, i) => (
          <div key={i} style={{
            position: "absolute",
            inset: -(i * 18),
            borderRadius: "50%",
            border: `1px solid rgba(16,185,129,${opacity * 0.3})`,
            animation: `ringPulse ${2 + i * 0.5}s ease-in-out infinite ${i * 0.3}s`,
            boxShadow: `0 0 ${20 + i * 15}px rgba(16,185,129,${opacity * 0.1})`,
          }} />
        ))}

        {/* Orbiting ring */}
        <div style={{
          position: "absolute",
          inset: -24,
          borderRadius: "50%",
          border: "1.5px solid rgba(99,102,241,0.4)",
          animation: "orbitRing 4s linear infinite",
          boxShadow: "0 0 20px rgba(99,102,241,0.2)",
        }}>
          {/* Orbit dot */}
          <div style={{
            position: "absolute",
            top: -4, left: "50%",
            width: 8, height: 8,
            background: "#6366f1",
            borderRadius: "50%",
            boxShadow: "0 0 12px #6366f1",
            transform: "translateX(-50%)",
          }} />
        </div>

        {/* Second orbiting ring */}
        <div style={{
          position: "absolute",
          inset: -14,
          borderRadius: "50%",
          border: "1px solid rgba(59,130,246,0.3)",
          animation: "orbitRing 6s linear infinite reverse",
        }}>
          <div style={{
            position: "absolute",
            bottom: -3, left: "50%",
            width: 6, height: 6,
            background: "#3b82f6",
            borderRadius: "50%",
            boxShadow: "0 0 10px #3b82f6",
            transform: "translateX(-50%)",
          }} />
        </div>

        {/* Main orb sphere */}
        <div style={{
          width: 160, height: 160,
          borderRadius: "50%",
          background: `
            radial-gradient(circle at 35% 35%,
              rgba(52,211,153,0.9) 0%,
              rgba(16,185,129,0.7) 20%,
              rgba(5,150,105,0.5) 40%,
              rgba(6,78,59,0.4) 60%,
              rgba(2,44,34,0.8) 80%,
              rgba(1,20,15,0.95) 100%
            )
          `,
          boxShadow: `
            0 0 60px rgba(16,185,129,0.4),
            0 0 120px rgba(16,185,129,0.15),
            inset 0 0 60px rgba(0,0,0,0.5),
            inset -20px -20px 40px rgba(0,0,0,0.4),
            inset 15px 15px 30px rgba(52,211,153,0.15)
          `,
          animation: "orbRotate 8s linear infinite",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Shine highlight */}
          <div style={{
            position: "absolute",
            top: "12%", left: "18%",
            width: "35%", height: "25%",
            background: "radial-gradient(ellipse, rgba(255,255,255,0.25) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(4px)",
          }} />
          {/* Inner glow */}
          <div style={{
            position: "absolute",
            inset: "20%",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(52,211,153,0.3) 0%, transparent 70%)",
            animation: "innerGlow 3s ease-in-out infinite",
          }} />
          {/* Grid lines on orb */}
          <div style={{
            position: "absolute", inset: 0,
            borderRadius: "50%",
            background: `
              repeating-linear-gradient(
                0deg,
                transparent,
                transparent 18px,
                rgba(16,185,129,0.08) 18px,
                rgba(16,185,129,0.08) 19px
              )
            `,
          }} />
        </div>

        {/* Center icon */}
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <polyline
              points="6,38 16,24 26,30 36,14 46,20"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="80"
              strokeDashoffset="0"
              style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.8))" }}
            />
            <circle cx="46" cy="20" r="4" fill="#34d399"
              style={{ filter: "drop-shadow(0 0 8px #34d399)" }} />
          </svg>
        </div>
      </div>

      {/* ── Text Section ── */}
      <div style={{ textAlign: "center", position: "relative", zIndex: 2 }}>
        {/* App name */}
        <div style={{
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: "-0.5px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          background: "linear-gradient(135deg, #ffffff 0%, #d1fae5 40%, #6ee7b7 70%, #ffffff 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          transform: visible ? "translateY(0)" : "translateY(30px)",
          opacity: visible ? 1 : 0,
          transition: "all 0.9s cubic-bezier(0.34,1.56,0.64,1) 0.5s",
          textShadow: "none",
          lineHeight: 1.1,
        }}>
          Financial Document
        </div>
        <div style={{
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: "-0.5px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          background: "linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          transform: visible ? "translateY(0)" : "translateY(30px)",
          opacity: visible ? 1 : 0,
          transition: "all 0.9s cubic-bezier(0.34,1.56,0.64,1) 0.65s",
          lineHeight: 1.2,
          marginBottom: 14,
        }}>
          Analyst
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: 15,
          color: "#94a3b8",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontWeight: 400,
          letterSpacing: "0.3px",
          transform: visible ? "translateY(0)" : "translateY(20px)",
          opacity: visible ? 1 : 0,
          transition: "all 0.8s ease 0.9s",
          marginBottom: 8,
        }}>
          Turn Financial Documents Into Intelligent Insights
        </div>

        {/* Sub tagline */}
        <div style={{
          fontSize: 12,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontWeight: 600,
          letterSpacing: "3px",
          textTransform: "uppercase",
          background: "linear-gradient(90deg, #6366f1, #10b981, #3b82f6)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          transform: visible ? "translateY(0)" : "translateY(20px)",
          opacity: visible ? 1 : 0,
          transition: "all 0.8s ease 1.1s",
          marginBottom: 40,
        }}>
          Analyze · Compare · Discover
        </div>

        {/* Feature pills */}
        <div style={{
          display: "flex",
          gap: 10,
          justifyContent: "center",
          flexWrap: "wrap",
          marginBottom: 48,
          transform: visible ? "translateY(0)" : "translateY(20px)",
          opacity: visible ? 1 : 0,
          transition: "all 0.8s ease 1.3s",
        }}>
          {[
            { icon: "📄", label: "PDF Analysis" },
            { icon: "🤖", label: "AI Insights" },
            { icon: "📊", label: "Auto Charts" },
            { icon: "⚖️", label: "Doc Compare" },
          ].map((f) => (
            <div key={f.label} style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: 20,
              fontSize: 12,
              color: "#cbd5e1",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              backdropFilter: "blur(8px)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}>
              <span>{f.icon}</span>
              <span>{f.label}</span>
            </div>
          ))}
        </div>

        {/* Loading bar */}
        <div style={{
          transform: visible ? "translateY(0)" : "translateY(20px)",
          opacity: visible ? 1 : 0,
          transition: "all 0.8s ease 1.5s",
        }}>
          <div style={{
            width: 200,
            height: 3,
            background: "rgba(255,255,255,0.08)",
            borderRadius: 2,
            margin: "0 auto 10px",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              borderRadius: 2,
              background: "linear-gradient(90deg, #10b981, #3b82f6, #6366f1)",
              animation: "loadBar 2.5s ease-in-out forwards",
              boxShadow: "0 0 10px rgba(16,185,129,0.6)",
            }} />
          </div>
          <div style={{
            fontSize: 11,
            color: "#475569",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            animation: "textPulse 1.5s ease-in-out infinite",
          }}>
            Initializing AI Engine...
          </div>
        </div>
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes blobFloat {
          0%, 100% { transform: translate(0,0) scale(1); }
          33%       { transform: translate(20px,-15px) scale(1.05); }
          66%       { transform: translate(-10px,10px) scale(0.97); }
        }
        @keyframes ringPulse {
          0%, 100% { transform: scale(1);    opacity: 0.6; }
          50%       { transform: scale(1.08); opacity: 0.2; }
        }
        @keyframes orbitRing {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes orbRotate {
          from { filter: hue-rotate(0deg); }
          to   { filter: hue-rotate(30deg); }
        }
        @keyframes innerGlow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.1); }
        }
        @keyframes loadBar {
          0%   { width: 0%; }
          20%  { width: 25%; }
          50%  { width: 60%; }
          80%  { width: 85%; }
          100% { width: 100%; }
        }
        @keyframes textPulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        @keyframes docFloat0 {
          0%, 100% { transform: rotate(-15deg) translateY(0px) scale(0.85); }
          50%       { transform: rotate(-13deg) translateY(-10px) scale(0.85); }
        }
        @keyframes docFloat1 {
          0%, 100% { transform: rotate(12deg) translateY(0px) scale(0.75); }
          50%       { transform: rotate(14deg) translateY(-8px) scale(0.75); }
        }
        @keyframes docFloat2 {
          0%, 100% { transform: rotate(8deg) translateY(0px) scale(0.7); }
          50%       { transform: rotate(6deg) translateY(-12px) scale(0.7); }
        }
        @keyframes docFloat3 {
          0%, 100% { transform: rotate(-10deg) translateY(0px) scale(0.8); }
          50%       { transform: rotate(-12deg) translateY(-9px) scale(0.8); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
};

export default LaunchScreen;
