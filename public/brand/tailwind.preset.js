/** Opuntia Den — Tailwind preset.
 *  Uso: en tailwind.config.js →  presets: [require("./brand/tailwind.preset.js")]
 *  (Tailwind v4: copia los valores a @theme en el CSS global.)
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        od: {
          crema: "#EAE3D7", papel: "#F4F0E9", tinta: "#3A3029", noche: "#2E2924",
          tuna: "#A8455C", gris: "#6E6359", linea: "#CBBFAE", "arena-texto": "#C9C0B2",
          "punto-oscuro": "#6B6158", kraft: "#C4A47C", olivo: "#5C6449",
          hueso: "#EFE8DC", lino: "#E3D8C6", arena: "#D8CBB5",
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', '"Iowan Old Style"', "Georgia", "serif"],
        sans: ["Inter", "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
      },
      letterSpacing: { label: "0.22em" },
      borderRadius: { pill: "999px" },
      boxShadow: { flat: "3px 3px 0 rgba(51,36,20,0.10)" },
    },
  },
};
