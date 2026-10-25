import type { ReactNode } from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";
import {
  MARKETING_URL,
  OPENTIP_BACKGROUND,
  OPENTIP_BLUE,
  OPENTIP_HAIRLINE,
  OPENTIP_INK,
  OPENTIP_MUTED,
} from "@/lib/brand";

const FONT_STACK =
  '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
const MONO_STACK =
  '"Geist Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace';

const textLinkStyle = {
  color: OPENTIP_BLUE,
  textDecoration: "underline",
  textUnderlineOffset: "2px",
} as const;

export function EmailLayout({
  preview,
  heading,
  children,
  appUrl,
  reason,
  preferences,
}: {
  preview: string;
  heading: string;
  children: ReactNode;
  appUrl: string;
  reason: string;
  preferences?: {
    manageUrl: string;
    unsubscribeUrl: string;
  };
}) {
  const baseUrl = appUrl.replace(/\/$/, "");
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <style>{`
          @media only screen and (max-width: 600px) {
            .email-card { padding: 24px !important; }
            .email-heading { font-size: 24px !important; }
            .email-button { width: 100% !important; }
          }
        `}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: OPENTIP_BACKGROUND,
          fontFamily: FONT_STACK,
          color: OPENTIP_INK,
        }}
      >
        <Container
          style={{
            width: "100%",
            maxWidth: "600px",
            margin: "0 auto",
            padding: "32px 16px",
          }}
        >
          <Section
            className="email-card"
            style={{
              backgroundColor: "#FFFFFF",
              border: `1px solid ${OPENTIP_HAIRLINE}`,
              borderRadius: "14px",
              padding: "32px",
            }}
          >
            <Section style={{ marginBottom: "32px" }}>
              <Link href={baseUrl} style={{ textDecoration: "none", color: OPENTIP_INK }}>
                <Img
                  src={`${baseUrl}/brand/mark-blue.png`}
                  width="32"
                  height="32"
                  alt="Opentip"
                  style={{
                    display: "inline-block",
                    verticalAlign: "middle",
                    marginRight: "9px",
                    borderRadius: "8px",
                  }}
                />
                <span
                  style={{
                    display: "inline-block",
                    verticalAlign: "middle",
                    fontSize: "15px",
                    fontWeight: 500,
                    letterSpacing: "-0.2px",
                  }}
                >
                  Opentip
                </span>
              </Link>
            </Section>

            <Heading
              as="h1"
              className="email-heading"
              style={{
                margin: "0 0 16px",
                fontSize: "28px",
                lineHeight: "34px",
                fontWeight: 500,
                letterSpacing: "-0.6px",
                color: OPENTIP_INK,
              }}
            >
              {heading}
            </Heading>

            {children}

            <Hr
              style={{
                borderColor: OPENTIP_HAIRLINE,
                borderTop: `1px solid ${OPENTIP_HAIRLINE}`,
                margin: "32px 0 20px",
              }}
            />
            <Text
              style={{
                margin: 0,
                fontSize: "12px",
                lineHeight: "19px",
                color: OPENTIP_MUTED,
              }}
            >
              {reason}
            </Text>
          </Section>

          <Section style={{ padding: "20px 8px 0", textAlign: "center" }}>
            <Text
              style={{
                margin: "0 0 6px",
                fontSize: "12px",
                lineHeight: "18px",
                color: OPENTIP_MUTED,
              }}
            >
              Docs that write themselves from your code.
            </Text>
            <Text
              style={{
                margin: "0 0 10px",
                fontSize: "12px",
                lineHeight: "18px",
                color: OPENTIP_MUTED,
              }}
            >
              <Link href={baseUrl} style={{ ...textLinkStyle, color: OPENTIP_MUTED }}>
                {baseUrl.replace(/^https?:\/\//, "")}
              </Link>
            </Text>
            <Text
              style={{
                margin: "0 0 8px",
                fontSize: "12px",
                lineHeight: "18px",
                color: OPENTIP_MUTED,
              }}
            >
              <Link href={`${MARKETING_URL}/terms`} style={{ ...textLinkStyle, color: OPENTIP_MUTED }}>
                Terms
              </Link>
              {"  ·  "}
              <Link href={`${MARKETING_URL}/privacy`} style={{ ...textLinkStyle, color: OPENTIP_MUTED }}>
                Privacy
              </Link>
              {"  ·  "}
              <Link
                href={`${MARKETING_URL}/subprocessors`}
                style={{ ...textLinkStyle, color: OPENTIP_MUTED }}
              >
                Subprocessors
              </Link>
            </Text>
            <Text
              style={{
                margin: "0 0 8px",
                fontSize: "12px",
                lineHeight: "18px",
                color: OPENTIP_MUTED,
              }}
            >
              <Link href="https://x.com/opentip_tech" style={{ ...textLinkStyle, color: OPENTIP_MUTED }}>
                X
              </Link>
              {"  ·  "}
              <Link href="https://github.com/opentiphq" style={{ ...textLinkStyle, color: OPENTIP_MUTED }}>
                GitHub
              </Link>
            </Text>
            {preferences ? (
              <Text
                style={{
                  margin: "0 0 8px",
                  fontSize: "12px",
                  lineHeight: "18px",
                  color: OPENTIP_MUTED,
                }}
              >
                <Link href={preferences.manageUrl} style={{ ...textLinkStyle, color: OPENTIP_MUTED }}>
                  Email preferences
                </Link>
                {"  ·  "}
                <Link href={preferences.unsubscribeUrl} style={{ ...textLinkStyle, color: OPENTIP_MUTED }}>
                  Unsubscribe
                </Link>
              </Text>
            ) : null}
            <Text
              style={{
                margin: 0,
                fontSize: "12px",
                lineHeight: "18px",
                color: OPENTIP_MUTED,
              }}
            >
              © {new Date().getFullYear()} Opentip
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailParagraph({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        margin: "0 0 16px",
        fontSize: "15px",
        lineHeight: "24px",
        color: OPENTIP_INK,
      }}
    >
      {children}
    </Text>
  );
}

export function EmailMuted({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        margin: "0 0 16px",
        fontSize: "13px",
        lineHeight: "21px",
        color: OPENTIP_MUTED,
      }}
    >
      {children}
    </Text>
  );
}

export function EmailButton({ href, label }: { href: string; label: string }) {
  return (
    <>
      <Section style={{ margin: "24px 0 18px" }}>
        <Button
          href={href}
          className="email-button"
          style={{
            display: "inline-block",
            backgroundColor: OPENTIP_BLUE,
            color: "#FFFFFF",
            fontSize: "14px",
            fontWeight: 500,
            lineHeight: "20px",
            padding: "12px 22px",
            borderRadius: "999px",
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          {label}
        </Button>
      </Section>
      <Text
        style={{
          margin: "0 0 16px",
          fontSize: "12px",
          lineHeight: "19px",
          color: OPENTIP_MUTED,
          wordBreak: "break-all",
        }}
      >
        Button not working? Paste this into your browser:
        <br />
        <Link href={href} style={textLinkStyle}>
          {href}
        </Link>
      </Text>
    </>
  );
}

export function EmailCode({ code }: { code: string }) {
  return (
    <Section
      style={{
        backgroundColor: "#F7F7FF",
        border: `1px solid ${OPENTIP_HAIRLINE}`,
        borderRadius: "12px",
        margin: "24px 0 18px",
        padding: "22px 16px",
        textAlign: "center",
      }}
    >
      <Text
        style={{
          margin: 0,
          fontFamily: MONO_STACK,
          fontSize: "34px",
          lineHeight: "40px",
          fontWeight: 500,
          letterSpacing: "7px",
          color: OPENTIP_INK,
        }}
      >
        {code}
      </Text>
    </Section>
  );
}
