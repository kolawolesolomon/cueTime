/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./website/**/*.{html,js}"],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                primary: "#4CAF50",
                "primary-dark": "#43A047",
                "primary-light": "#E8F5E9",
                "background-light": "#ffffff",
                "background-dark": "#121212",
                "text-light": "#333333",
                "text-dark": "#e0e0e0",
                "accent-dark": "#1E1E1E",
            },
            fontFamily: {
                display: ["Oswald", "sans-serif"],
                sans: ["Inter", "sans-serif"],
            },
            boxShadow: {
                'deep': '0 20px 40px -5px rgba(0, 0, 0, 0.1), 0 10px 20px -5px rgba(0, 0, 0, 0.04)',
                'button': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255,255,255,0.4)',
            }
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
        require('@tailwindcss/forms'),
    ],
}
