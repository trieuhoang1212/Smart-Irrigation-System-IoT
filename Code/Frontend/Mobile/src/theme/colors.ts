export const colors = {
  canvas: "#f5f7f3",
  surface: "#ffffff",
  ink: "#1d2b24",
  inkSoft: "#3c4d43",
  muted: "#6d7c73",
  faint: "#93a097",
  line: "#e3e8e1",
  lineSoft: "#edf1eb",
  green: "#2f6f4e",
  greenStrong: "#235c40",
  greenSoft: "#eef3ec",
  deep: "#17362a",
  amber: "#a5762c",
  amberSoft: "#faf3e6",
  red: "#a44b4b",
  redSoft: "#fbefee",
  blue: "#3d6f8c",
  blueSoft: "#eef4f8",
  white: "#ffffff",
} as const;

export type ColorName = keyof typeof colors;
