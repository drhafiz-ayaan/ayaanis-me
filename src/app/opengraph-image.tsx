import { ImageResponse } from "next/og";
import { identity, roles, publications, ventures } from "@/content/profile";

/**
 * Link preview card.
 *
 * Without this, dropping the domain into WhatsApp or LinkedIn produces a bare
 * link — the 3D landing cannot be screenshotted by a crawler. Rendered at
 * build time from the same content module, so the numbers can never drift
 * from what the site actually claims.
 */

export const alt = `${identity.fullName} — AI, Robotics & Digital Twins`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const stats = [
    { v: String(publications.length), k: "PAPERS" },
    {
      v: String(publications.filter((p) => p.status === "published").length),
      k: "PUBLISHED",
    },
    { v: String(ventures.length), k: "VENTURES" },
    { v: "2", k: "LABS" },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "68px 76px",
          background:
            "radial-gradient(1100px 620px at 72% 18%, #0e3a4a 0%, #070d18 55%, #04060b 100%)",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* engineering grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(34,211,238,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.09) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 15,
              height: 15,
              borderRadius: 99,
              background: "#22d3ee",
              display: "flex",
            }}
          />
          <div
            style={{
              fontSize: 23,
              letterSpacing: 7,
              color: "#7dd3fc",
              display: "flex",
            }}
          >
            {identity.location.toUpperCase()} · {identity.role.toUpperCase()}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 122,
              fontWeight: 700,
              color: "#eaf2fb",
              letterSpacing: -3,
              lineHeight: 1,
              display: "flex",
            }}
          >
            {identity.fullName}
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: 31,
              color: "#9fb3cc",
              letterSpacing: 3,
              display: "flex",
            }}
          >
            {roles.join("  /  ")}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 44 }}>
            {stats.map((s) => (
              <div
                key={s.k}
                style={{ display: "flex", alignItems: "baseline", gap: 11 }}
              >
                <div
                  style={{ fontSize: 47, fontWeight: 700, color: "#22d3ee", display: "flex" }}
                >
                  {s.v}
                </div>
                <div
                  style={{ fontSize: 19, letterSpacing: 3.5, color: "#6b7d96", display: "flex" }}
                >
                  {s.k}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 26, letterSpacing: 3, color: "#7dd3fc", display: "flex" }}>
            {identity.domain}
          </div>
        </div>
      </div>
    ),
    size
  );
}
