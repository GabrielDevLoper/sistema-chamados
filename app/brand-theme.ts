import type { CSSProperties } from "react";

type Rgb = { red: number; green: number; blue: number };

const FALLBACK_COLOR = "#1F5B55";

function parseHex(value: string): Rgb {
  const normalized = /^#[0-9a-f]{6}$/i.test(value) ? value : FALLBACK_COLOR;
  return {
    red: Number.parseInt(normalized.slice(1, 3), 16),
    green: Number.parseInt(normalized.slice(3, 5), 16),
    blue: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function toHex({ red, green, blue }: Rgb) {
  return `#${[red, green, blue]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function mix(color: Rgb, target: Rgb, amount: number): Rgb {
  return {
    red: color.red + (target.red - color.red) * amount,
    green: color.green + (target.green - color.green) * amount,
    blue: color.blue + (target.blue - color.blue) * amount,
  };
}

function luminance(color: Rgb) {
  const channels = [color.red, color.green, color.blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function readableText(color: Rgb) {
  const background = luminance(color);
  const whiteContrast = 1.05 / (background + 0.05);
  const darkContrast = (background + 0.05) / 0.05;
  return whiteContrast >= darkContrast ? "#FFFFFF" : "#10201D";
}

function rgba(color: Rgb, alpha: number) {
  return `rgba(${Math.round(color.red)}, ${Math.round(color.green)}, ${Math.round(color.blue)}, ${alpha})`;
}

export function brandThemeStyle(
  primaryColor: string,
  displayBackgroundUrl?: string,
): CSSProperties {
  const primary = parseHex(primaryColor);
  const black = parseHex("#000000");
  const white = parseHex("#FFFFFF");
  const primaryLuminance = luminance(primary);
  const strong = mix(primary, black, primaryLuminance > 0.42 ? 0.58 : 0.3);
  const deep = mix(strong, black, 0.24);
  const soft = mix(primary, white, 0.9);
  const muted = mix(primary, white, 0.74);
  const accent = primaryLuminance > 0.55 ? strong : primary;
  const highlight = mix(primary, white, primaryLuminance > 0.5 ? 0.15 : 0.48);

  return {
    "--brand-primary": toHex(primary),
    "--brand-strong": toHex(strong),
    "--brand-deep": toHex(deep),
    "--brand-soft": toHex(soft),
    "--brand-muted": toHex(muted),
    "--brand-accent": toHex(accent),
    "--brand-highlight": toHex(highlight),
    "--brand-on-primary": readableText(primary),
    "--brand-on-strong": readableText(strong),
    "--brand-glow": rgba(primary, 0.16),
    "--brand-glow-strong": rgba(primary, 0.42),
    "--brand-border": rgba(accent, 0.28),
    "--brand-shadow": `0 22px 60px ${rgba(strong, 0.16)}`,
    "--brand-sidebar": rgba(deep, 0.82),
    "--brand-display-background": displayBackgroundUrl
      ? `url("${displayBackgroundUrl}")`
      : "none",
    "--deep": toHex(strong),
    "--green": toHex(primary),
    "--mint": toHex(soft),
    "--gold": toHex(accent),
  } as CSSProperties;
}
