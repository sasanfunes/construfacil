import type { CSSProperties, ReactNode } from "react";

/**
 * Piezas de correo. Los clientes de correo no entienden CSS moderno: todo va en línea,
 * con tablas para el ancho y los colores de la paleta B1 escritos tal cual.
 */
export const EMAIL_COLORS = {
  ivory: "#fbf7f1",
  night: "#0e2749",
  tile: "#c2512f",
  ink: "#0b1e3b",
  muted: "#4a5873",
  border: "#e8dfd0",
  white: "#ffffff",
} as const;

const font = "Verdana, Arial, Helvetica, sans-serif";

export function EmailLayout({
  lang,
  preview,
  brand,
  footer,
  notice,
  children,
}: {
  lang: string;
  preview: string;
  brand: string;
  footer: string;
  notice?: string;
  children: ReactNode;
}) {
  return (
    <html lang={lang}>
      {/* Es un correo, no una página de Next: aquí sí va <head>. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: EMAIL_COLORS.ivory, fontFamily: font }}>
        <div style={{ display: "none", maxHeight: 0, overflow: "hidden" }}>{preview}</div>
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ backgroundColor: EMAIL_COLORS.ivory }}
        >
          <tbody>
            <tr>
              <td align="center" style={{ padding: "24px 12px" }}>
                <table
                  role="presentation"
                  width="100%"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{ maxWidth: 560 }}
                >
                  <tbody>
                    <tr>
                      <td
                        style={{
                          backgroundColor: EMAIL_COLORS.night,
                          padding: "18px 24px",
                          borderRadius: "16px 16px 0 0",
                        }}
                      >
                        <span style={{ color: EMAIL_COLORS.white, fontSize: 20, fontWeight: 700 }}>
                          {brand}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          backgroundColor: EMAIL_COLORS.white,
                          padding: "28px 24px",
                          border: `1px solid ${EMAIL_COLORS.border}`,
                          borderTop: "none",
                          borderRadius: "0 0 16px 16px",
                          color: EMAIL_COLORS.ink,
                          fontSize: 16,
                          lineHeight: "1.6",
                        }}
                      >
                        {children}
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          padding: "16px 8px",
                          color: EMAIL_COLORS.muted,
                          fontSize: 12,
                          lineHeight: "1.5",
                        }}
                      >
                        {notice ? <p style={{ margin: "0 0 8px" }}>{notice}</p> : null}
                        <p style={{ margin: 0 }}>{footer}</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

export function P({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <p style={{ margin: "0 0 16px", ...style }}>{children}</p>;
}

export function H({ children }: { children: ReactNode }) {
  return <h2 style={{ margin: "8px 0 12px", fontSize: 18, color: EMAIL_COLORS.night }}>{children}</h2>;
}

/** Botón principal (teja). Un enlace con aspecto de botón: funciona en todos los clientes. */
export function ButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <p style={{ margin: "8px 0 24px" }}>
      <a
        href={href}
        style={{
          display: "inline-block",
          backgroundColor: EMAIL_COLORS.tile,
          color: EMAIL_COLORS.white,
          padding: "12px 24px",
          borderRadius: 999,
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        {children}
      </a>
    </p>
  );
}

export function Rows({ rows }: { rows: ReadonlyArray<readonly [string, string]> }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: "0 0 20px" }}>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <td
              style={{
                padding: "8px 12px 8px 0",
                color: EMAIL_COLORS.muted,
                verticalAlign: "top",
                width: "40%",
              }}
            >
              {label}
            </td>
            <td style={{ padding: "8px 0", fontWeight: 700, verticalAlign: "top" }}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
